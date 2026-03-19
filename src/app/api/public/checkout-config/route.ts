import { NextResponse } from "next/server"
import { getSiteSettings } from "@/lib/site-settings"
import { getPublicCheckoutConfig } from "@/lib/public-checkout-config"

export const revalidate = 0

export async function GET() {
  try {
    const settings = await getSiteSettings()
    const payload = getPublicCheckoutConfig(settings)

    if (process.env.NODE_ENV !== "production") {
      console.info("[checkout-config] db payment state", {
        stripeEnabled: settings.stripeEnabled,
        paypalEnabled: settings.paypalEnabled,
        paytrEnabled: settings.paytrEnabled,
        googlePayEnabled: settings.googlePayEnabled,
        applePayEnabled: settings.applePayEnabled,
        hasStripeSecretKey: Boolean(settings.stripeSecretKey),
        hasPayPalClientId: Boolean(settings.paypalClientId),
        hasPayPalClientSecret: Boolean(settings.paypalClientSecret),
        hasPaytrMerchantId: Boolean(settings.paytrMerchantId),
        hasPaytrMerchantKey: Boolean(settings.paytrMerchantKey),
        hasPaytrMerchantSalt: Boolean(settings.paytrMerchantSalt),
      })
      console.info("[checkout-config] filtered providers", payload.paymentProviders.map((provider) => provider.key))
      console.info("[checkout-config] public response", payload)
    }

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    })
  } catch (error) {
    console.error("Error fetching checkout config:", error)
    return NextResponse.json({ error: "Failed to fetch checkout config" }, { status: 500 })
  }
}
