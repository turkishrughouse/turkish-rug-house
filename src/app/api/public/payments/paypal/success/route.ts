import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSiteSettings } from "@/lib/site-settings"
import { notifyOrderUpdate } from "@/lib/customer-messaging"
import { grantReviewRightForOrder } from "@/lib/review-access"
import { saveOrderDetails } from "@/lib/order-details"

async function getPayPalToken(clientId: string, clientSecret: string, sandbox: boolean) {
  const base = sandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com"
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  })
  const json = await res.json().catch(() => null as null | { access_token?: string })
  if (!res.ok || !json?.access_token) throw new Error("PayPal token request failed")
  return { base, token: json.access_token }
}

export async function GET(req: NextRequest) {
  try {
    const orderId = req.nextUrl.searchParams.get("orderId") || ""
    const paypalOrderId = req.nextUrl.searchParams.get("token") || ""
    if (!orderId || !paypalOrderId) {
      return NextResponse.redirect(new URL("/basket?payment=failed", req.nextUrl.origin))
    }

    const settings = await getSiteSettings()
    if (!settings.paypalClientId || !settings.paypalClientSecret) {
      return NextResponse.redirect(new URL("/basket?payment=failed", req.nextUrl.origin))
    }

    const { base, token } = await getPayPalToken(settings.paypalClientId, settings.paypalClientSecret, settings.paypalMode !== "live")
    const captureRes = await fetch(`${base}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })
    const capture = await captureRes.json().catch(() => null as null | { status?: string })
    if (!captureRes.ok || (capture?.status !== "COMPLETED" && capture?.status !== "APPROVED")) {
      return NextResponse.redirect(new URL(`/basket?payment=failed&order=${encodeURIComponent(orderId)}`, req.nextUrl.origin))
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: "PAID" },
      select: { orderNumber: true },
    })
    await prisma.orderEvent.create({
      data: {
        orderId,
        type: "PAYMENT",
        title: "Payment received",
        description: "PayPal payment captured",
        actorType: "SYSTEM",
        isAdmin: false,
      },
    })
    await saveOrderDetails(orderId, {
      paymentStatus: "PAID",
      paymentMethod: "PAYPAL",
      paymentReference: paypalOrderId,
      invoiceIssuedAt: new Date().toISOString(),
    })
    await notifyOrderUpdate(orderId, "Order received", `Your payment for ${updated.orderNumber} was completed.`, "/account", "CREATE")
    await grantReviewRightForOrder(orderId)

    return NextResponse.redirect(new URL("/account?payment=success", req.nextUrl.origin))
  } catch {
    return NextResponse.redirect(new URL("/basket?payment=failed", req.nextUrl.origin))
  }
}
