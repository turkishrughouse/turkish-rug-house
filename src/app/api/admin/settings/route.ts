import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSiteSettings, saveSiteSettings } from "@/lib/site-settings"

const homePromoSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  categoryId: z.string().optional(),
})

const homeFeatureItemSchema = z.object({
  id: z.string().min(1),
  icon: z.enum(["plane", "cart", "support", "truck"]),
  title: z.string().min(1),
  subtitle: z.string().optional(),
})

const settingsSchema = z.object({
  siteName: z.string().min(1).optional(),
  defaultMetaTitle: z.string().optional(),
  defaultMetaDescription: z.string().optional(),
  brandPrimary: z.string().min(1).optional(),
  brandSecondary: z.string().min(1).optional(),
  siteTagline: z.string().optional(),
  supportEmail: z.string().optional(),
  supportPhone: z.string().optional(),
  footerSocialLinks: z.array(z.object({
    platform: z.enum(["facebook", "x", "instagram", "youtube", "tiktok", "linkedin", "pinterest"]),
    label: z.string().min(1),
    url: z.string().min(1),
  })).optional(),
  contactHeroTitle: z.string().optional(),
  contactHeroDescription: z.string().optional(),
  contactLocationLabel: z.string().optional(),
  contactLocationUrl: z.string().optional(),
  contactTeamCardTitle: z.string().optional(),
  contactTeamCardCtaLabel: z.string().optional(),
  contactTeamCardCtaUrl: z.string().optional(),
  contactTeamCardImage: z.string().optional(),
  defaultLanguage: z.string().min(1).optional(),
  defaultCurrency: z.string().min(1).optional(),
  maintenanceMode: z.boolean().optional(),
  maintenanceTitle: z.string().optional(),
  maintenanceMessage: z.string().optional(),
  maintenanceImageUrl: z.string().optional(),
  maintenanceSocialLinks: z.array(z.object({
    platform: z.enum(["facebook", "x", "instagram", "youtube", "tiktok", "linkedin", "pinterest"]),
    label: z.string().min(1),
    url: z.string().min(1),
  })).optional(),
  shopByCategoryIds: z.array(z.string()).max(8).optional(),
  categoryCardRadiusLinked: z.boolean().optional(),
  categoryCardRadiusTopLeft: z.number().int().min(0).max(200).optional(),
  categoryCardRadiusTopRight: z.number().int().min(0).max(200).optional(),
  categoryCardRadiusBottomRight: z.number().int().min(0).max(200).optional(),
  categoryCardRadiusBottomLeft: z.number().int().min(0).max(200).optional(),
  collectionCategoryIds: z.array(z.string()).max(7).optional(),
  collectionSectionTitle: z.string().optional(),
  reviewShowcaseEnabled: z.boolean().optional(),
  reviewShowcaseTitle: z.string().optional(),
  reviewShowcaseSubtitle: z.string().optional(),
  homeFeatureItems: z.array(homeFeatureItemSchema).max(4).optional(),
  homePromoSections: z.array(homePromoSectionSchema).optional(),
  homePromoSectionTitle: z.string().optional(),
  homePromoCategoryId: z.string().optional(),
  storeAddressLine1: z.string().optional(),
  storeAddressLine2: z.string().optional(),
  storeCity: z.string().optional(),
  storeCountryState: z.string().optional(),
  storePostcode: z.string().optional(),
  sellingLocationMode: z.enum(["all", "specific"]).optional(),
  sellingCountries: z.array(z.string()).optional(),
  shippingLocationMode: z.enum(["all-sell", "specific"]).optional(),
  defaultCustomerLocation: z.enum(["shop-country", "no-location", "geolocate"]).optional(),
  enableAddressAutocomplete: z.boolean().optional(),
  enableTaxes: z.boolean().optional(),
  enableCoupons: z.boolean().optional(),
  sequentialCoupons: z.boolean().optional(),
  currencyPosition: z.enum(["left", "right", "left-space", "right-space"]).optional(),
  thousandSeparator: z.string().optional(),
  decimalSeparator: z.string().optional(),
  numberOfDecimals: z.number().int().min(0).max(4).optional(),
  requirePhoneAtCheckout: z.boolean().optional(),
  requireAddressAtCheckout: z.boolean().optional(),
  enableGuestCheckout: z.boolean().optional(),
  accountCreationDuringCheckout: z.boolean().optional(),
  accountCreationOnMyAccountPage: z.boolean().optional(),
  sendPasswordSetupLink: z.boolean().optional(),
  removePersonalDataOnErasureRequest: z.boolean().optional(),
  removeDownloadsOnErasureRequest: z.boolean().optional(),
  allowBulkPersonalDataRemoval: z.boolean().optional(),
  hideOutOfStockOnShop: z.boolean().optional(),
  showCatalogMode: z.enum(["normal", "catalog"]).optional(),
  flatShippingRate: z.number().min(0).optional(),
  localPickupRate: z.number().min(0).optional(),
  checkoutEnabled: z.boolean().optional(),
  outgoingMailHost: z.string().optional(),
  outgoingMailPort: z.number().int().min(1).max(65535).optional(),
  outgoingMailSecure: z.boolean().optional(),
  outgoingMailUser: z.string().optional(),
  outgoingMailPassword: z.string().optional(),
  outgoingMailFromName: z.string().optional(),
  outgoingMailFromEmail: z.string().optional(),
  outgoingMailReplyTo: z.string().optional(),
  incomingMailHost: z.string().optional(),
  incomingMailPort: z.number().int().min(1).max(65535).optional(),
  incomingMailSecure: z.boolean().optional(),
  incomingMailUser: z.string().optional(),
  incomingMailPassword: z.string().optional(),
  incomingMailProtocol: z.enum(["imap", "pop3"]).optional(),
  orderEmailAdminRecipients: z.string().optional(),
  sendOrderEmailOnCreate: z.boolean().optional(),
  sendOrderEmailOnCancelled: z.boolean().optional(),
  sendOrderEmailOnStatusChange: z.boolean().optional(),
  sendOrderEmailOnFulfillment: z.boolean().optional(),
  stripeEnabled: z.boolean().optional(),
  stripePublishableKey: z.string().optional(),
  stripeSecretKey: z.string().optional(),
  stripeWebhookSecret: z.string().optional(),
  stripeAllowedIps: z.string().optional(),
  googlePayEnabled: z.boolean().optional(),
  googlePayMerchantId: z.string().optional(),
  googlePayMerchantName: z.string().optional(),
  googlePayApiKey: z.string().optional(),
  googlePayApiSecret: z.string().optional(),
  googlePayAllowedIps: z.string().optional(),
  applePayEnabled: z.boolean().optional(),
  applePayMerchantId: z.string().optional(),
  applePayMerchantName: z.string().optional(),
  applePayApiKey: z.string().optional(),
  applePayApiSecret: z.string().optional(),
  applePayDomain: z.string().optional(),
  applePayAllowedIps: z.string().optional(),
  paypalEnabled: z.boolean().optional(),
  paypalClientId: z.string().optional(),
  paypalClientSecret: z.string().optional(),
  paypalMode: z.enum(["sandbox", "live"]).optional(),
  paypalAllowedIps: z.string().optional(),
  paytrEnabled: z.boolean().optional(),
  paytrMerchantId: z.string().optional(),
  paytrMerchantKey: z.string().optional(),
  paytrMerchantSalt: z.string().optional(),
  paytrMerchantOkUrl: z.string().optional(),
  paytrMerchantFailUrl: z.string().optional(),
  paymentDefaultProvider: z.enum(["stripe", "paypal", "gpay", "applepay", "paytr"]).optional(),
  autoCarrierRates: z.boolean().optional(),
  dhlEnabled: z.boolean().optional(),
  dhlApiKey: z.string().optional(),
  dhlApiSecret: z.string().optional(),
  dhlAccountNumber: z.string().optional(),
  dhlUseSandbox: z.boolean().optional(),
  upsEnabled: z.boolean().optional(),
  upsClientId: z.string().optional(),
  upsClientSecret: z.string().optional(),
  upsAccountNumber: z.string().optional(),
  upsUseSandbox: z.boolean().optional(),
  fedexEnabled: z.boolean().optional(),
  fedexApiKey: z.string().optional(),
  fedexApiSecret: z.string().optional(),
  fedexAccountNumber: z.string().optional(),
  fedexUseSandbox: z.boolean().optional(),
})

export async function GET() {
  try {
    const data = await getSiteSettings()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching site settings:", error)
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const result = settingsSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid data", details: result.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const current = await getSiteSettings()
    const saved = await saveSiteSettings({ ...current, ...result.data })
    return NextResponse.json(saved)
  } catch (error) {
    console.error("Error saving site settings:", error)
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 })
  }
}
