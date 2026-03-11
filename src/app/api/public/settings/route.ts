import { NextResponse } from "next/server"
import { getSiteSettings } from "@/lib/site-settings"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const data = await getSiteSettings()
    return NextResponse.json({
      siteName: data.siteName,
      brandPrimary: data.brandPrimary,
      brandSecondary: data.brandSecondary,
      siteTagline: data.siteTagline,
      supportEmail: data.supportEmail,
      supportPhone: data.supportPhone,
      maintenanceMode: data.maintenanceMode,
      maintenanceTitle: data.maintenanceTitle,
      maintenanceMessage: data.maintenanceMessage,
      maintenanceImageUrl: data.maintenanceImageUrl,
      maintenanceSocialLinks: data.maintenanceSocialLinks,
      footerSocialLinks: data.footerSocialLinks,
      shopByCategoryIds: data.shopByCategoryIds,
      categoryCardRadiusLinked: data.categoryCardRadiusLinked,
      categoryCardRadiusTopLeft: data.categoryCardRadiusTopLeft,
      categoryCardRadiusTopRight: data.categoryCardRadiusTopRight,
      categoryCardRadiusBottomRight: data.categoryCardRadiusBottomRight,
      categoryCardRadiusBottomLeft: data.categoryCardRadiusBottomLeft,
      homeFeatureItems: data.homeFeatureItems,
      defaultCurrency: data.defaultCurrency,
      currencyPosition: data.currencyPosition,
      thousandSeparator: data.thousandSeparator,
      decimalSeparator: data.decimalSeparator,
      numberOfDecimals: data.numberOfDecimals,
      enableCoupons: data.enableCoupons,
      enableTaxes: data.enableTaxes,
      requirePhoneAtCheckout: data.requirePhoneAtCheckout,
      requireAddressAtCheckout: data.requireAddressAtCheckout,
      enableGuestCheckout: data.enableGuestCheckout,
      accountCreationDuringCheckout: data.accountCreationDuringCheckout,
      accountCreationOnMyAccountPage: data.accountCreationOnMyAccountPage,
      sendPasswordSetupLink: data.sendPasswordSetupLink,
      checkoutEnabled: data.checkoutEnabled,
      flatShippingRate: data.flatShippingRate,
      localPickupRate: data.localPickupRate,
      shippingLocationMode: data.shippingLocationMode,
      stripeEnabled: data.stripeEnabled,
      stripePublishableKey: data.stripePublishableKey,
      googlePayEnabled: data.googlePayEnabled,
      applePayEnabled: data.applePayEnabled,
      paypalEnabled: data.paypalEnabled,
      paytrEnabled: data.paytrEnabled,
      paymentDefaultProvider: data.paymentDefaultProvider,
      autoCarrierRates: data.autoCarrierRates,
      dhlEnabled: data.dhlEnabled,
      upsEnabled: data.upsEnabled,
      fedexEnabled: data.fedexEnabled,
    })
  } catch (error) {
    console.error("Error fetching public settings:", error)
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 })
  }
}
