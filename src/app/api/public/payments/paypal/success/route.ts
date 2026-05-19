import { NextRequest, NextResponse } from "next/server"
import { getSiteSettings } from "@/lib/site-settings"
import { finalizePaidOrder } from "@/lib/payment-orders"
import { getSiteUrl } from "@/lib/site-url"

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
      return NextResponse.redirect(new URL("/basket?payment=failed", getSiteUrl()))
    }

    const settings = await getSiteSettings()
    if (!settings.paypalClientId || !settings.paypalClientSecret) {
      return NextResponse.redirect(new URL("/basket?payment=failed", getSiteUrl()))
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
      return NextResponse.redirect(new URL(`/basket?payment=failed&order=${encodeURIComponent(orderId)}`, getSiteUrl()))
    }

    await finalizePaidOrder({
      orderId,
      paymentMethod: "PAYPAL",
      paymentReference: paypalOrderId,
      eventDescription: "PayPal payment captured",
    })
    return NextResponse.redirect(new URL(`/checkout/success?order=${encodeURIComponent(orderId)}`, getSiteUrl()))
  } catch {
    return NextResponse.redirect(new URL("/basket?payment=failed", getSiteUrl()))
  }
}
