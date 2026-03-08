import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSiteSettings } from "@/lib/site-settings"
import { notifyOrderUpdate } from "@/lib/customer-messaging"
import { grantReviewRightForOrder } from "@/lib/review-access"

export async function GET(req: NextRequest) {
  try {
    const orderId = req.nextUrl.searchParams.get("orderId") || ""
    const sessionId = req.nextUrl.searchParams.get("session_id") || ""
    if (!orderId || !sessionId) {
      return NextResponse.redirect(new URL("/basket?payment=failed", req.nextUrl.origin))
    }

    const settings = await getSiteSettings()
    if (!settings.stripeSecretKey) {
      return NextResponse.redirect(new URL("/basket?payment=failed", req.nextUrl.origin))
    }

    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${settings.stripeSecretKey}` },
    })
    const json = await res.json().catch(() => null as null | { payment_status?: string })
    if (!res.ok || json?.payment_status !== "paid") {
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
        description: "Stripe checkout completed",
        actorType: "SYSTEM",
        isAdmin: false,
      },
    })

    await notifyOrderUpdate(orderId, "Order received", `Your payment for ${updated.orderNumber} was completed.`, "/account", "CREATE")
    await grantReviewRightForOrder(orderId)
    return NextResponse.redirect(new URL("/account?payment=success", req.nextUrl.origin))
  } catch {
    return NextResponse.redirect(new URL("/basket?payment=failed", req.nextUrl.origin))
  }
}
