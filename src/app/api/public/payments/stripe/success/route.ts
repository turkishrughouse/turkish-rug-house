import { NextRequest, NextResponse } from "next/server"
import { getSingleOrderDetails } from "@/lib/order-details"
import { getSiteSettings } from "@/lib/site-settings"
import { finalizePaidOrder } from "@/lib/payment-orders"
import { getSiteUrl } from "@/lib/site-url"

export async function GET(req: NextRequest) {
  try {
    const orderId = req.nextUrl.searchParams.get("orderId") || ""
    const sessionId = req.nextUrl.searchParams.get("session_id") || ""
    if (!orderId || !sessionId) {
      return NextResponse.redirect(new URL("/basket?payment=failed", getSiteUrl()))
    }

    const settings = await getSiteSettings()
    if (!settings.stripeSecretKey) {
      return NextResponse.redirect(new URL("/basket?payment=failed", getSiteUrl()))
    }

    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${settings.stripeSecretKey}` },
    })
    const json = await res.json().catch(() => null as null | {
      id?: string
      payment_status?: string
      payment_intent?: string
      metadata?: { orderId?: string }
    })
    if (!res.ok || json?.payment_status !== "paid") {
      return NextResponse.redirect(new URL(`/basket?payment=failed&order=${encodeURIComponent(orderId)}`, getSiteUrl()))
    }

    const details = await getSingleOrderDetails(orderId)
    if ((details.paymentStatus || "").toUpperCase() !== "PAID") {
      if ((json?.metadata?.orderId || "") !== orderId) {
        return NextResponse.redirect(new URL(`/basket?payment=failed&order=${encodeURIComponent(orderId)}`, getSiteUrl()))
      }

      await finalizePaidOrder({
        orderId,
        paymentMethod: "STRIPE",
        paymentReference: json?.id || sessionId,
        paymentSessionId: json?.id || sessionId,
        paymentIntentId: typeof json?.payment_intent === "string" ? json.payment_intent : null,
        eventDescription: "Stripe checkout success redirect verified payment as a fallback sync",
      })
    }
    return NextResponse.redirect(new URL(`/checkout/success?order=${encodeURIComponent(orderId)}`, getSiteUrl()))
  } catch {
    return NextResponse.redirect(new URL("/basket?payment=failed", getSiteUrl()))
  }
}
