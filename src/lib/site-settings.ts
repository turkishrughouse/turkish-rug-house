import { prisma } from "@/lib/db"

export type FooterSocialLink = {
  platform: "facebook" | "x" | "instagram" | "youtube" | "tiktok" | "linkedin" | "pinterest"
  label: string
  url: string
}

export type HomePromoSection = {
  id: string
  title: string
  categoryId: string
}

export type HomeFeatureItem = {
  id: string
  icon: "plane" | "cart" | "support" | "truck"
  title: string
  subtitle: string
}

export type SiteSettings = {
  siteName: string
  brandPrimary: string
  brandSecondary: string
  siteTagline: string
  supportEmail: string
  supportPhone: string
  footerSocialLinks: FooterSocialLink[]
  contactHeroTitle: string
  contactHeroDescription: string
  contactLocationLabel: string
  contactLocationUrl: string
  contactTeamCardTitle: string
  contactTeamCardCtaLabel: string
  contactTeamCardCtaUrl: string
  contactTeamCardImage: string
  defaultLanguage: string
  defaultCurrency: string
  maintenanceMode: boolean
  maintenanceTitle: string
  maintenanceMessage: string
  maintenanceImageUrl: string
  shopByCategoryIds: string[]
  categoryCardRadiusLinked: boolean
  categoryCardRadiusTopLeft: number
  categoryCardRadiusTopRight: number
  categoryCardRadiusBottomRight: number
  categoryCardRadiusBottomLeft: number
  collectionCategoryIds: string[]
  collectionSectionTitle: string
  reviewShowcaseEnabled: boolean
  reviewShowcaseTitle: string
  reviewShowcaseSubtitle: string
  homeFeatureItems: HomeFeatureItem[]
  homePromoSections: HomePromoSection[]
  homePromoSectionTitle: string
  homePromoCategoryId: string
  storeAddressLine1: string
  storeAddressLine2: string
  storeCity: string
  storeCountryState: string
  storePostcode: string
  sellingLocationMode: "all" | "specific"
  sellingCountries: string[]
  shippingLocationMode: "all-sell" | "specific"
  defaultCustomerLocation: "shop-country" | "no-location" | "geolocate"
  enableAddressAutocomplete: boolean
  enableTaxes: boolean
  enableCoupons: boolean
  sequentialCoupons: boolean
  currencyPosition: "left" | "right" | "left-space" | "right-space"
  thousandSeparator: string
  decimalSeparator: string
  numberOfDecimals: number
  requirePhoneAtCheckout: boolean
  requireAddressAtCheckout: boolean
  enableGuestCheckout: boolean
  accountCreationDuringCheckout: boolean
  accountCreationOnMyAccountPage: boolean
  sendPasswordSetupLink: boolean
  removePersonalDataOnErasureRequest: boolean
  removeDownloadsOnErasureRequest: boolean
  allowBulkPersonalDataRemoval: boolean
  hideOutOfStockOnShop: boolean
  showCatalogMode: "normal" | "catalog"
  flatShippingRate: number
  localPickupRate: number
  checkoutEnabled: boolean
  outgoingMailHost: string
  outgoingMailPort: number
  outgoingMailSecure: boolean
  outgoingMailUser: string
  outgoingMailPassword: string
  outgoingMailFromName: string
  outgoingMailFromEmail: string
  outgoingMailReplyTo: string
  incomingMailHost: string
  incomingMailPort: number
  incomingMailSecure: boolean
  incomingMailUser: string
  incomingMailPassword: string
  incomingMailProtocol: "imap" | "pop3"
  orderEmailAdminRecipients: string
  sendOrderEmailOnCreate: boolean
  sendOrderEmailOnCancelled: boolean
  sendOrderEmailOnStatusChange: boolean
  sendOrderEmailOnFulfillment: boolean
  stripeEnabled: boolean
  stripePublishableKey: string
  stripeSecretKey: string
  stripeWebhookSecret: string
  stripeAllowedIps: string
  googlePayEnabled: boolean
  googlePayMerchantId: string
  googlePayMerchantName: string
  googlePayApiKey: string
  googlePayApiSecret: string
  googlePayAllowedIps: string
  applePayEnabled: boolean
  applePayMerchantId: string
  applePayMerchantName: string
  applePayApiKey: string
  applePayApiSecret: string
  applePayDomain: string
  applePayAllowedIps: string
  paypalEnabled: boolean
  paypalClientId: string
  paypalClientSecret: string
  paypalMode: "sandbox" | "live"
  paypalAllowedIps: string
  paytrEnabled: boolean
  paytrMerchantId: string
  paytrMerchantKey: string
  paytrMerchantSalt: string
  paytrMerchantOkUrl: string
  paytrMerchantFailUrl: string
  paymentDefaultProvider: "stripe" | "paypal" | "gpay" | "applepay" | "paytr"
  autoCarrierRates: boolean
  dhlEnabled: boolean
  dhlApiKey: string
  dhlApiSecret: string
  dhlAccountNumber: string
  dhlUseSandbox: boolean
  upsEnabled: boolean
  upsClientId: string
  upsClientSecret: string
  upsAccountNumber: string
  upsUseSandbox: boolean
  fedexEnabled: boolean
  fedexApiKey: string
  fedexApiSecret: string
  fedexAccountNumber: string
  fedexUseSandbox: boolean
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteName: "Turkish Rug House",
  brandPrimary: "Turkish",
  brandSecondary: "Rug House",
  siteTagline: "Authentic, hand-knotted rugs from Anatolia.",
  supportEmail: "info@turkishrughouse.com",
  supportPhone: "+1 (555) 000-0000",
  footerSocialLinks: [],
  contactHeroTitle: "Connect with Our Team of Experts",
  contactHeroDescription: "Contact our team of excellence-driven experts today to bring your project to life.",
  contactLocationLabel: "See Our Locations",
  contactLocationUrl: "/info/contact",
  contactTeamCardTitle: "Want to Join Our Talented Team?",
  contactTeamCardCtaLabel: "Visit Our Job Board",
  contactTeamCardCtaUrl: "#",
  contactTeamCardImage: "",
  defaultLanguage: "English",
  defaultCurrency: "USD",
  maintenanceMode: false,
  maintenanceTitle: "Web sitemiz yapim asamasindadir",
  maintenanceMessage: "Daha guclu bir deneyim icin altyapimizi guncelliyoruz. Lutfen kisa bir sure sonra tekrar ziyaret edin.",
  maintenanceImageUrl: "/uploads/pages/maintenance-default.jpg",
  shopByCategoryIds: [],
  categoryCardRadiusLinked: true,
  categoryCardRadiusTopLeft: 15,
  categoryCardRadiusTopRight: 15,
  categoryCardRadiusBottomRight: 15,
  categoryCardRadiusBottomLeft: 15,
  collectionCategoryIds: [],
  collectionSectionTitle: "Shop by Collection",
  reviewShowcaseEnabled: false,
  reviewShowcaseTitle: "Over 210,000 Five-Star Reviews",
  reviewShowcaseSubtitle: "Explore the rugs everyone's raving about.",
  homeFeatureItems: [
    { id: "feature-shipping", icon: "plane", title: "Worldwide Free", subtitle: "Shipping" },
    { id: "feature-price", icon: "cart", title: "Best Price", subtitle: "Commitment" },
    { id: "feature-support", icon: "support", title: "7/24 Support", subtitle: "" },
    { id: "feature-return", icon: "truck", title: "Easy Return", subtitle: "" },
  ],
  homePromoSections: [],
  homePromoSectionTitle: "Most Popular",
  homePromoCategoryId: "",
  storeAddressLine1: "",
  storeAddressLine2: "",
  storeCity: "",
  storeCountryState: "TR-34",
  storePostcode: "",
  sellingLocationMode: "all",
  sellingCountries: [],
  shippingLocationMode: "all-sell",
  defaultCustomerLocation: "shop-country",
  enableAddressAutocomplete: false,
  enableTaxes: false,
  enableCoupons: true,
  sequentialCoupons: false,
  currencyPosition: "left",
  thousandSeparator: ".",
  decimalSeparator: ",",
  numberOfDecimals: 2,
  requirePhoneAtCheckout: true,
  requireAddressAtCheckout: true,
  enableGuestCheckout: true,
  accountCreationDuringCheckout: true,
  accountCreationOnMyAccountPage: true,
  sendPasswordSetupLink: true,
  removePersonalDataOnErasureRequest: true,
  removeDownloadsOnErasureRequest: false,
  allowBulkPersonalDataRemoval: false,
  hideOutOfStockOnShop: false,
  showCatalogMode: "normal",
  flatShippingRate: 20,
  localPickupRate: 25,
  checkoutEnabled: true,
  outgoingMailHost: "",
  outgoingMailPort: 465,
  outgoingMailSecure: true,
  outgoingMailUser: "",
  outgoingMailPassword: "",
  outgoingMailFromName: "Turkish Rug House",
  outgoingMailFromEmail: "info@turkishrughouse.com",
  outgoingMailReplyTo: "",
  incomingMailHost: "",
  incomingMailPort: 993,
  incomingMailSecure: true,
  incomingMailUser: "",
  incomingMailPassword: "",
  incomingMailProtocol: "imap",
  orderEmailAdminRecipients: "",
  sendOrderEmailOnCreate: true,
  sendOrderEmailOnCancelled: true,
  sendOrderEmailOnStatusChange: true,
  sendOrderEmailOnFulfillment: true,
  stripeEnabled: false,
  stripePublishableKey: "",
  stripeSecretKey: "",
  stripeWebhookSecret: "",
  stripeAllowedIps: "",
  googlePayEnabled: false,
  googlePayMerchantId: "",
  googlePayMerchantName: "",
  googlePayApiKey: "",
  googlePayApiSecret: "",
  googlePayAllowedIps: "",
  applePayEnabled: false,
  applePayMerchantId: "",
  applePayMerchantName: "",
  applePayApiKey: "",
  applePayApiSecret: "",
  applePayDomain: "",
  applePayAllowedIps: "",
  paypalEnabled: false,
  paypalClientId: "",
  paypalClientSecret: "",
  paypalMode: "sandbox",
  paypalAllowedIps: "",
  paytrEnabled: false,
  paytrMerchantId: "",
  paytrMerchantKey: "",
  paytrMerchantSalt: "",
  paytrMerchantOkUrl: "",
  paytrMerchantFailUrl: "",
  paymentDefaultProvider: "stripe",
  autoCarrierRates: false,
  dhlEnabled: false,
  dhlApiKey: "",
  dhlApiSecret: "",
  dhlAccountNumber: "",
  dhlUseSandbox: true,
  upsEnabled: false,
  upsClientId: "",
  upsClientSecret: "",
  upsAccountNumber: "",
  upsUseSandbox: true,
  fedexEnabled: false,
  fedexApiKey: "",
  fedexApiSecret: "",
  fedexAccountNumber: "",
  fedexUseSandbox: true,
}

const SETTINGS_KEY = "site_settings"

function normalizeSettings(input: unknown): SiteSettings {
  const raw = (input && typeof input === "object" ? input : {}) as Partial<SiteSettings>
  const legacyRaw = raw as Partial<SiteSettings> & {
    categoryCardRadiusEnabled?: unknown
    categoryCardRadius?: unknown
  }
  return {
    siteName: typeof raw.siteName === "string" && raw.siteName.trim() ? raw.siteName.trim() : DEFAULT_SITE_SETTINGS.siteName,
    brandPrimary: typeof raw.brandPrimary === "string" && raw.brandPrimary.trim() ? raw.brandPrimary.trim() : DEFAULT_SITE_SETTINGS.brandPrimary,
    brandSecondary: typeof raw.brandSecondary === "string" && raw.brandSecondary.trim() ? raw.brandSecondary.trim() : DEFAULT_SITE_SETTINGS.brandSecondary,
    siteTagline: typeof raw.siteTagline === "string" ? raw.siteTagline.trim() : DEFAULT_SITE_SETTINGS.siteTagline,
    supportEmail: typeof raw.supportEmail === "string" ? raw.supportEmail.trim() : DEFAULT_SITE_SETTINGS.supportEmail,
    supportPhone: typeof raw.supportPhone === "string" ? raw.supportPhone.trim() : DEFAULT_SITE_SETTINGS.supportPhone,
    footerSocialLinks: Array.isArray(raw.footerSocialLinks)
      ? raw.footerSocialLinks
          .map((item) => {
            if (!item || typeof item !== "object") return null
            const platform = (item as { platform?: unknown }).platform
            const label = (item as { label?: unknown }).label
            const url = (item as { url?: unknown }).url
            if (
              platform !== "facebook" &&
              platform !== "x" &&
              platform !== "instagram" &&
              platform !== "youtube" &&
              platform !== "tiktok" &&
              platform !== "linkedin" &&
              platform !== "pinterest"
            ) {
              return null
            }
            if (typeof label !== "string" || !label.trim()) return null
            if (typeof url !== "string" || !url.trim()) return null
            return {
              platform,
              label: label.trim(),
              url: url.trim(),
            } as FooterSocialLink
          })
          .filter((item): item is FooterSocialLink => Boolean(item))
      : DEFAULT_SITE_SETTINGS.footerSocialLinks,
    contactHeroTitle:
      typeof raw.contactHeroTitle === "string" && raw.contactHeroTitle.trim().length > 0
        ? raw.contactHeroTitle.trim()
        : DEFAULT_SITE_SETTINGS.contactHeroTitle,
    contactHeroDescription:
      typeof raw.contactHeroDescription === "string" && raw.contactHeroDescription.trim().length > 0
        ? raw.contactHeroDescription.trim()
        : DEFAULT_SITE_SETTINGS.contactHeroDescription,
    contactLocationLabel:
      typeof raw.contactLocationLabel === "string" && raw.contactLocationLabel.trim().length > 0
        ? raw.contactLocationLabel.trim()
        : DEFAULT_SITE_SETTINGS.contactLocationLabel,
    contactLocationUrl:
      typeof raw.contactLocationUrl === "string" && raw.contactLocationUrl.trim().length > 0
        ? raw.contactLocationUrl.trim()
        : DEFAULT_SITE_SETTINGS.contactLocationUrl,
    contactTeamCardTitle:
      typeof raw.contactTeamCardTitle === "string" && raw.contactTeamCardTitle.trim().length > 0
        ? raw.contactTeamCardTitle.trim()
        : DEFAULT_SITE_SETTINGS.contactTeamCardTitle,
    contactTeamCardCtaLabel:
      typeof raw.contactTeamCardCtaLabel === "string" && raw.contactTeamCardCtaLabel.trim().length > 0
        ? raw.contactTeamCardCtaLabel.trim()
        : DEFAULT_SITE_SETTINGS.contactTeamCardCtaLabel,
    contactTeamCardCtaUrl:
      typeof raw.contactTeamCardCtaUrl === "string" && raw.contactTeamCardCtaUrl.trim().length > 0
        ? raw.contactTeamCardCtaUrl.trim()
        : DEFAULT_SITE_SETTINGS.contactTeamCardCtaUrl,
    contactTeamCardImage:
      typeof raw.contactTeamCardImage === "string" ? raw.contactTeamCardImage.trim() : DEFAULT_SITE_SETTINGS.contactTeamCardImage,
    defaultLanguage: typeof raw.defaultLanguage === "string" && raw.defaultLanguage.trim() ? raw.defaultLanguage.trim() : DEFAULT_SITE_SETTINGS.defaultLanguage,
    defaultCurrency: typeof raw.defaultCurrency === "string" && raw.defaultCurrency.trim() ? raw.defaultCurrency.trim() : DEFAULT_SITE_SETTINGS.defaultCurrency,
    maintenanceMode: Boolean(raw.maintenanceMode),
    maintenanceTitle:
      typeof raw.maintenanceTitle === "string" && raw.maintenanceTitle.trim().length > 0
        ? raw.maintenanceTitle.trim()
        : DEFAULT_SITE_SETTINGS.maintenanceTitle,
    maintenanceMessage:
      typeof raw.maintenanceMessage === "string" && raw.maintenanceMessage.trim().length > 0
        ? raw.maintenanceMessage.trim()
        : DEFAULT_SITE_SETTINGS.maintenanceMessage,
    maintenanceImageUrl:
      typeof raw.maintenanceImageUrl === "string" && raw.maintenanceImageUrl.trim().length > 0
        ? raw.maintenanceImageUrl.trim()
        : DEFAULT_SITE_SETTINGS.maintenanceImageUrl,
    shopByCategoryIds: Array.isArray(raw.shopByCategoryIds)
      ? Array.from(new Set(raw.shopByCategoryIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0))).slice(0, 8)
      : Array.isArray((raw as { homeCategoryIds?: unknown }).homeCategoryIds)
        ? Array.from(new Set(((raw as { homeCategoryIds: unknown[] }).homeCategoryIds).filter((id): id is string => typeof id === "string" && id.trim().length > 0))).slice(0, 8)
      : [],
    categoryCardRadiusLinked:
      raw.categoryCardRadiusLinked !== undefined
        ? Boolean(raw.categoryCardRadiusLinked)
        : legacyRaw.categoryCardRadiusEnabled !== undefined
          ? true
          : DEFAULT_SITE_SETTINGS.categoryCardRadiusLinked,
    categoryCardRadiusTopLeft:
      typeof raw.categoryCardRadiusTopLeft === "number" && Number.isFinite(raw.categoryCardRadiusTopLeft)
        ? Math.max(0, Math.min(200, Math.round(raw.categoryCardRadiusTopLeft)))
        : typeof legacyRaw.categoryCardRadius === "number" && Number.isFinite(legacyRaw.categoryCardRadius)
          ? Math.max(0, Math.min(200, Math.round(legacyRaw.categoryCardRadius)))
          : DEFAULT_SITE_SETTINGS.categoryCardRadiusTopLeft,
    categoryCardRadiusTopRight:
      typeof raw.categoryCardRadiusTopRight === "number" && Number.isFinite(raw.categoryCardRadiusTopRight)
        ? Math.max(0, Math.min(200, Math.round(raw.categoryCardRadiusTopRight)))
        : typeof legacyRaw.categoryCardRadius === "number" && Number.isFinite(legacyRaw.categoryCardRadius)
          ? Math.max(0, Math.min(200, Math.round(legacyRaw.categoryCardRadius)))
          : DEFAULT_SITE_SETTINGS.categoryCardRadiusTopRight,
    categoryCardRadiusBottomRight:
      typeof raw.categoryCardRadiusBottomRight === "number" && Number.isFinite(raw.categoryCardRadiusBottomRight)
        ? Math.max(0, Math.min(200, Math.round(raw.categoryCardRadiusBottomRight)))
        : typeof legacyRaw.categoryCardRadius === "number" && Number.isFinite(legacyRaw.categoryCardRadius)
          ? Math.max(0, Math.min(200, Math.round(legacyRaw.categoryCardRadius)))
          : DEFAULT_SITE_SETTINGS.categoryCardRadiusBottomRight,
    categoryCardRadiusBottomLeft:
      typeof raw.categoryCardRadiusBottomLeft === "number" && Number.isFinite(raw.categoryCardRadiusBottomLeft)
        ? Math.max(0, Math.min(200, Math.round(raw.categoryCardRadiusBottomLeft)))
        : typeof legacyRaw.categoryCardRadius === "number" && Number.isFinite(legacyRaw.categoryCardRadius)
          ? Math.max(0, Math.min(200, Math.round(legacyRaw.categoryCardRadius)))
          : DEFAULT_SITE_SETTINGS.categoryCardRadiusBottomLeft,
    collectionCategoryIds: Array.isArray(raw.collectionCategoryIds)
      ? Array.from(new Set(raw.collectionCategoryIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0))).slice(0, 7)
      : [],
    collectionSectionTitle:
      typeof raw.collectionSectionTitle === "string" && raw.collectionSectionTitle.trim().length > 0
        ? raw.collectionSectionTitle.trim()
        : DEFAULT_SITE_SETTINGS.collectionSectionTitle,
    reviewShowcaseEnabled:
      raw.reviewShowcaseEnabled !== undefined
        ? Boolean(raw.reviewShowcaseEnabled)
        : DEFAULT_SITE_SETTINGS.reviewShowcaseEnabled,
    reviewShowcaseTitle:
      typeof raw.reviewShowcaseTitle === "string" && raw.reviewShowcaseTitle.trim().length > 0
        ? raw.reviewShowcaseTitle.trim()
        : DEFAULT_SITE_SETTINGS.reviewShowcaseTitle,
    reviewShowcaseSubtitle:
      typeof raw.reviewShowcaseSubtitle === "string" && raw.reviewShowcaseSubtitle.trim().length > 0
        ? raw.reviewShowcaseSubtitle.trim()
        : DEFAULT_SITE_SETTINGS.reviewShowcaseSubtitle,
    homeFeatureItems: Array.isArray((raw as { homeFeatureItems?: unknown }).homeFeatureItems)
      ? (raw as { homeFeatureItems: unknown[] }).homeFeatureItems
          .map((item, index) => {
            if (!item || typeof item !== "object") return null
            const id = (item as { id?: unknown }).id
            const icon = (item as { icon?: unknown }).icon
            const title = (item as { title?: unknown }).title
            const subtitle = (item as { subtitle?: unknown }).subtitle
            const fallback = DEFAULT_SITE_SETTINGS.homeFeatureItems[index] || DEFAULT_SITE_SETTINGS.homeFeatureItems[0]
            const normalizedIcon =
              icon === "plane" || icon === "cart" || icon === "support" || icon === "truck"
                ? icon
                : fallback.icon
            return {
              id: typeof id === "string" && id.trim().length > 0 ? id.trim() : `feature-${index + 1}`,
              icon: normalizedIcon,
              title: typeof title === "string" && title.trim().length > 0 ? title.trim() : fallback.title,
              subtitle: typeof subtitle === "string" ? subtitle.trim() : fallback.subtitle,
            } as HomeFeatureItem
          })
          .filter((item): item is HomeFeatureItem => Boolean(item))
          .slice(0, 4)
      : DEFAULT_SITE_SETTINGS.homeFeatureItems,
    homePromoSections: Array.isArray(raw.homePromoSections)
      ? raw.homePromoSections
          .map((item) => {
            if (!item || typeof item !== "object") return null
            const id = (item as { id?: unknown }).id
            const title = (item as { title?: unknown }).title
            const categoryId = (item as { categoryId?: unknown }).categoryId
            if (typeof id !== "string" || !id.trim()) return null
            return {
              id: id.trim(),
              title: typeof title === "string" && title.trim().length > 0 ? title.trim() : DEFAULT_SITE_SETTINGS.homePromoSectionTitle,
              categoryId: typeof categoryId === "string" ? categoryId.trim() : "",
            } as HomePromoSection
          })
          .filter((item): item is HomePromoSection => Boolean(item))
      : typeof raw.homePromoSectionTitle === "string" || typeof raw.homePromoCategoryId === "string"
        ? [{
            id: "default-home-promo",
            title:
              typeof raw.homePromoSectionTitle === "string" && raw.homePromoSectionTitle.trim().length > 0
                ? raw.homePromoSectionTitle.trim()
                : DEFAULT_SITE_SETTINGS.homePromoSectionTitle,
            categoryId: typeof raw.homePromoCategoryId === "string" ? raw.homePromoCategoryId.trim() : "",
          }]
        : DEFAULT_SITE_SETTINGS.homePromoSections,
    homePromoSectionTitle:
      typeof raw.homePromoSectionTitle === "string" && raw.homePromoSectionTitle.trim().length > 0
        ? raw.homePromoSectionTitle.trim()
        : DEFAULT_SITE_SETTINGS.homePromoSectionTitle,
    homePromoCategoryId:
      typeof raw.homePromoCategoryId === "string" && raw.homePromoCategoryId.trim().length > 0
        ? raw.homePromoCategoryId.trim()
        : "",
    storeAddressLine1:
      typeof raw.storeAddressLine1 === "string" ? raw.storeAddressLine1.trim() : DEFAULT_SITE_SETTINGS.storeAddressLine1,
    storeAddressLine2:
      typeof raw.storeAddressLine2 === "string" ? raw.storeAddressLine2.trim() : DEFAULT_SITE_SETTINGS.storeAddressLine2,
    storeCity:
      typeof raw.storeCity === "string" ? raw.storeCity.trim() : DEFAULT_SITE_SETTINGS.storeCity,
    storeCountryState:
      typeof raw.storeCountryState === "string" && raw.storeCountryState.trim()
        ? raw.storeCountryState.trim()
        : DEFAULT_SITE_SETTINGS.storeCountryState,
    storePostcode:
      typeof raw.storePostcode === "string" ? raw.storePostcode.trim() : DEFAULT_SITE_SETTINGS.storePostcode,
    sellingLocationMode:
      raw.sellingLocationMode === "specific" ? "specific" : DEFAULT_SITE_SETTINGS.sellingLocationMode,
    sellingCountries: Array.isArray(raw.sellingCountries)
      ? Array.from(
          new Set(
            raw.sellingCountries.filter(
              (country): country is string => typeof country === "string" && country.trim().length > 0
            )
          )
        ).slice(0, 250)
      : [],
    shippingLocationMode:
      raw.shippingLocationMode === "specific" ? "specific" : DEFAULT_SITE_SETTINGS.shippingLocationMode,
    defaultCustomerLocation:
      raw.defaultCustomerLocation === "no-location" || raw.defaultCustomerLocation === "geolocate"
        ? raw.defaultCustomerLocation
        : DEFAULT_SITE_SETTINGS.defaultCustomerLocation,
    enableAddressAutocomplete: Boolean(raw.enableAddressAutocomplete),
    enableTaxes: Boolean(raw.enableTaxes),
    enableCoupons: raw.enableCoupons !== undefined ? Boolean(raw.enableCoupons) : DEFAULT_SITE_SETTINGS.enableCoupons,
    sequentialCoupons: Boolean(raw.sequentialCoupons),
    currencyPosition:
      raw.currencyPosition === "right" || raw.currencyPosition === "left-space" || raw.currencyPosition === "right-space"
        ? raw.currencyPosition
        : DEFAULT_SITE_SETTINGS.currencyPosition,
    thousandSeparator:
      typeof raw.thousandSeparator === "string" && raw.thousandSeparator.length > 0
        ? raw.thousandSeparator.slice(0, 1)
        : DEFAULT_SITE_SETTINGS.thousandSeparator,
    decimalSeparator:
      typeof raw.decimalSeparator === "string" && raw.decimalSeparator.length > 0
        ? raw.decimalSeparator.slice(0, 1)
        : DEFAULT_SITE_SETTINGS.decimalSeparator,
    numberOfDecimals:
      typeof raw.numberOfDecimals === "number" && Number.isFinite(raw.numberOfDecimals)
        ? Math.max(0, Math.min(4, Math.floor(raw.numberOfDecimals)))
        : DEFAULT_SITE_SETTINGS.numberOfDecimals,
    requirePhoneAtCheckout:
      raw.requirePhoneAtCheckout !== undefined
        ? Boolean(raw.requirePhoneAtCheckout)
        : DEFAULT_SITE_SETTINGS.requirePhoneAtCheckout,
    requireAddressAtCheckout:
      raw.requireAddressAtCheckout !== undefined
        ? Boolean(raw.requireAddressAtCheckout)
        : DEFAULT_SITE_SETTINGS.requireAddressAtCheckout,
    enableGuestCheckout:
      raw.enableGuestCheckout !== undefined ? Boolean(raw.enableGuestCheckout) : DEFAULT_SITE_SETTINGS.enableGuestCheckout,
    accountCreationDuringCheckout:
      raw.accountCreationDuringCheckout !== undefined
        ? Boolean(raw.accountCreationDuringCheckout)
        : DEFAULT_SITE_SETTINGS.accountCreationDuringCheckout,
    accountCreationOnMyAccountPage:
      raw.accountCreationOnMyAccountPage !== undefined
        ? Boolean(raw.accountCreationOnMyAccountPage)
        : DEFAULT_SITE_SETTINGS.accountCreationOnMyAccountPage,
    sendPasswordSetupLink:
      raw.sendPasswordSetupLink !== undefined
        ? Boolean(raw.sendPasswordSetupLink)
        : DEFAULT_SITE_SETTINGS.sendPasswordSetupLink,
    removePersonalDataOnErasureRequest:
      raw.removePersonalDataOnErasureRequest !== undefined
        ? Boolean(raw.removePersonalDataOnErasureRequest)
        : DEFAULT_SITE_SETTINGS.removePersonalDataOnErasureRequest,
    removeDownloadsOnErasureRequest:
      raw.removeDownloadsOnErasureRequest !== undefined
        ? Boolean(raw.removeDownloadsOnErasureRequest)
        : DEFAULT_SITE_SETTINGS.removeDownloadsOnErasureRequest,
    allowBulkPersonalDataRemoval:
      raw.allowBulkPersonalDataRemoval !== undefined
        ? Boolean(raw.allowBulkPersonalDataRemoval)
        : DEFAULT_SITE_SETTINGS.allowBulkPersonalDataRemoval,
    hideOutOfStockOnShop: Boolean(raw.hideOutOfStockOnShop),
    showCatalogMode: raw.showCatalogMode === "catalog" ? "catalog" : DEFAULT_SITE_SETTINGS.showCatalogMode,
    flatShippingRate:
      typeof raw.flatShippingRate === "number" && Number.isFinite(raw.flatShippingRate)
        ? Math.max(0, raw.flatShippingRate)
        : DEFAULT_SITE_SETTINGS.flatShippingRate,
    localPickupRate:
      typeof raw.localPickupRate === "number" && Number.isFinite(raw.localPickupRate)
        ? Math.max(0, raw.localPickupRate)
        : DEFAULT_SITE_SETTINGS.localPickupRate,
    checkoutEnabled:
      raw.checkoutEnabled !== undefined ? Boolean(raw.checkoutEnabled) : DEFAULT_SITE_SETTINGS.checkoutEnabled,
    outgoingMailHost:
      typeof raw.outgoingMailHost === "string" ? raw.outgoingMailHost.trim() : DEFAULT_SITE_SETTINGS.outgoingMailHost,
    outgoingMailPort:
      typeof raw.outgoingMailPort === "number" && Number.isFinite(raw.outgoingMailPort)
        ? Math.max(1, Math.min(65535, Math.floor(raw.outgoingMailPort)))
        : DEFAULT_SITE_SETTINGS.outgoingMailPort,
    outgoingMailSecure:
      raw.outgoingMailSecure !== undefined ? Boolean(raw.outgoingMailSecure) : DEFAULT_SITE_SETTINGS.outgoingMailSecure,
    outgoingMailUser:
      typeof raw.outgoingMailUser === "string" ? raw.outgoingMailUser.trim() : DEFAULT_SITE_SETTINGS.outgoingMailUser,
    outgoingMailPassword:
      typeof raw.outgoingMailPassword === "string" ? raw.outgoingMailPassword : DEFAULT_SITE_SETTINGS.outgoingMailPassword,
    outgoingMailFromName:
      typeof raw.outgoingMailFromName === "string" && raw.outgoingMailFromName.trim().length > 0
        ? raw.outgoingMailFromName.trim()
        : DEFAULT_SITE_SETTINGS.outgoingMailFromName,
    outgoingMailFromEmail:
      typeof raw.outgoingMailFromEmail === "string" && raw.outgoingMailFromEmail.trim().length > 0
        ? raw.outgoingMailFromEmail.trim()
        : DEFAULT_SITE_SETTINGS.outgoingMailFromEmail,
    outgoingMailReplyTo:
      typeof raw.outgoingMailReplyTo === "string" ? raw.outgoingMailReplyTo.trim() : DEFAULT_SITE_SETTINGS.outgoingMailReplyTo,
    incomingMailHost:
      typeof raw.incomingMailHost === "string" ? raw.incomingMailHost.trim() : DEFAULT_SITE_SETTINGS.incomingMailHost,
    incomingMailPort:
      typeof raw.incomingMailPort === "number" && Number.isFinite(raw.incomingMailPort)
        ? Math.max(1, Math.min(65535, Math.floor(raw.incomingMailPort)))
        : DEFAULT_SITE_SETTINGS.incomingMailPort,
    incomingMailSecure:
      raw.incomingMailSecure !== undefined ? Boolean(raw.incomingMailSecure) : DEFAULT_SITE_SETTINGS.incomingMailSecure,
    incomingMailUser:
      typeof raw.incomingMailUser === "string" ? raw.incomingMailUser.trim() : DEFAULT_SITE_SETTINGS.incomingMailUser,
    incomingMailPassword:
      typeof raw.incomingMailPassword === "string" ? raw.incomingMailPassword : DEFAULT_SITE_SETTINGS.incomingMailPassword,
    incomingMailProtocol:
      raw.incomingMailProtocol === "pop3" ? "pop3" : DEFAULT_SITE_SETTINGS.incomingMailProtocol,
    orderEmailAdminRecipients:
      typeof raw.orderEmailAdminRecipients === "string" ? raw.orderEmailAdminRecipients.trim() : DEFAULT_SITE_SETTINGS.orderEmailAdminRecipients,
    sendOrderEmailOnCreate:
      raw.sendOrderEmailOnCreate !== undefined ? Boolean(raw.sendOrderEmailOnCreate) : DEFAULT_SITE_SETTINGS.sendOrderEmailOnCreate,
    sendOrderEmailOnCancelled:
      raw.sendOrderEmailOnCancelled !== undefined ? Boolean(raw.sendOrderEmailOnCancelled) : DEFAULT_SITE_SETTINGS.sendOrderEmailOnCancelled,
    sendOrderEmailOnStatusChange:
      raw.sendOrderEmailOnStatusChange !== undefined ? Boolean(raw.sendOrderEmailOnStatusChange) : DEFAULT_SITE_SETTINGS.sendOrderEmailOnStatusChange,
    sendOrderEmailOnFulfillment:
      raw.sendOrderEmailOnFulfillment !== undefined ? Boolean(raw.sendOrderEmailOnFulfillment) : DEFAULT_SITE_SETTINGS.sendOrderEmailOnFulfillment,
    stripeEnabled: raw.stripeEnabled !== undefined ? Boolean(raw.stripeEnabled) : DEFAULT_SITE_SETTINGS.stripeEnabled,
    stripePublishableKey:
      typeof raw.stripePublishableKey === "string" ? raw.stripePublishableKey.trim() : DEFAULT_SITE_SETTINGS.stripePublishableKey,
    stripeSecretKey:
      typeof raw.stripeSecretKey === "string" ? raw.stripeSecretKey.trim() : DEFAULT_SITE_SETTINGS.stripeSecretKey,
    stripeWebhookSecret:
      typeof raw.stripeWebhookSecret === "string" ? raw.stripeWebhookSecret.trim() : DEFAULT_SITE_SETTINGS.stripeWebhookSecret,
    stripeAllowedIps:
      typeof raw.stripeAllowedIps === "string" ? raw.stripeAllowedIps.trim() : DEFAULT_SITE_SETTINGS.stripeAllowedIps,
    googlePayEnabled: raw.googlePayEnabled !== undefined ? Boolean(raw.googlePayEnabled) : DEFAULT_SITE_SETTINGS.googlePayEnabled,
    googlePayMerchantId:
      typeof raw.googlePayMerchantId === "string" ? raw.googlePayMerchantId.trim() : DEFAULT_SITE_SETTINGS.googlePayMerchantId,
    googlePayMerchantName:
      typeof raw.googlePayMerchantName === "string" ? raw.googlePayMerchantName.trim() : DEFAULT_SITE_SETTINGS.googlePayMerchantName,
    googlePayApiKey:
      typeof raw.googlePayApiKey === "string" ? raw.googlePayApiKey.trim() : DEFAULT_SITE_SETTINGS.googlePayApiKey,
    googlePayApiSecret:
      typeof raw.googlePayApiSecret === "string" ? raw.googlePayApiSecret.trim() : DEFAULT_SITE_SETTINGS.googlePayApiSecret,
    googlePayAllowedIps:
      typeof raw.googlePayAllowedIps === "string" ? raw.googlePayAllowedIps.trim() : DEFAULT_SITE_SETTINGS.googlePayAllowedIps,
    applePayEnabled: raw.applePayEnabled !== undefined ? Boolean(raw.applePayEnabled) : DEFAULT_SITE_SETTINGS.applePayEnabled,
    applePayMerchantId:
      typeof raw.applePayMerchantId === "string" ? raw.applePayMerchantId.trim() : DEFAULT_SITE_SETTINGS.applePayMerchantId,
    applePayMerchantName:
      typeof raw.applePayMerchantName === "string" ? raw.applePayMerchantName.trim() : DEFAULT_SITE_SETTINGS.applePayMerchantName,
    applePayApiKey:
      typeof raw.applePayApiKey === "string" ? raw.applePayApiKey.trim() : DEFAULT_SITE_SETTINGS.applePayApiKey,
    applePayApiSecret:
      typeof raw.applePayApiSecret === "string" ? raw.applePayApiSecret.trim() : DEFAULT_SITE_SETTINGS.applePayApiSecret,
    applePayDomain:
      typeof raw.applePayDomain === "string" ? raw.applePayDomain.trim() : DEFAULT_SITE_SETTINGS.applePayDomain,
    applePayAllowedIps:
      typeof raw.applePayAllowedIps === "string" ? raw.applePayAllowedIps.trim() : DEFAULT_SITE_SETTINGS.applePayAllowedIps,
    paypalEnabled: raw.paypalEnabled !== undefined ? Boolean(raw.paypalEnabled) : DEFAULT_SITE_SETTINGS.paypalEnabled,
    paypalClientId:
      typeof raw.paypalClientId === "string" ? raw.paypalClientId.trim() : DEFAULT_SITE_SETTINGS.paypalClientId,
    paypalClientSecret:
      typeof raw.paypalClientSecret === "string" ? raw.paypalClientSecret.trim() : DEFAULT_SITE_SETTINGS.paypalClientSecret,
    paypalMode: raw.paypalMode === "live" ? "live" : DEFAULT_SITE_SETTINGS.paypalMode,
    paypalAllowedIps:
      typeof raw.paypalAllowedIps === "string" ? raw.paypalAllowedIps.trim() : DEFAULT_SITE_SETTINGS.paypalAllowedIps,
    paytrEnabled: raw.paytrEnabled !== undefined ? Boolean(raw.paytrEnabled) : DEFAULT_SITE_SETTINGS.paytrEnabled,
    paytrMerchantId:
      typeof raw.paytrMerchantId === "string" ? raw.paytrMerchantId.trim() : DEFAULT_SITE_SETTINGS.paytrMerchantId,
    paytrMerchantKey:
      typeof raw.paytrMerchantKey === "string" ? raw.paytrMerchantKey.trim() : DEFAULT_SITE_SETTINGS.paytrMerchantKey,
    paytrMerchantSalt:
      typeof raw.paytrMerchantSalt === "string" ? raw.paytrMerchantSalt.trim() : DEFAULT_SITE_SETTINGS.paytrMerchantSalt,
    paytrMerchantOkUrl:
      typeof raw.paytrMerchantOkUrl === "string" ? raw.paytrMerchantOkUrl.trim() : DEFAULT_SITE_SETTINGS.paytrMerchantOkUrl,
    paytrMerchantFailUrl:
      typeof raw.paytrMerchantFailUrl === "string" ? raw.paytrMerchantFailUrl.trim() : DEFAULT_SITE_SETTINGS.paytrMerchantFailUrl,
    paymentDefaultProvider:
      raw.paymentDefaultProvider === "paypal" ||
      raw.paymentDefaultProvider === "paytr" ||
      raw.paymentDefaultProvider === "gpay" ||
      raw.paymentDefaultProvider === "applepay"
        ? raw.paymentDefaultProvider
        : DEFAULT_SITE_SETTINGS.paymentDefaultProvider,
    autoCarrierRates:
      raw.autoCarrierRates !== undefined ? Boolean(raw.autoCarrierRates) : DEFAULT_SITE_SETTINGS.autoCarrierRates,
    dhlEnabled: raw.dhlEnabled !== undefined ? Boolean(raw.dhlEnabled) : DEFAULT_SITE_SETTINGS.dhlEnabled,
    dhlApiKey:
      typeof raw.dhlApiKey === "string" ? raw.dhlApiKey.trim() : DEFAULT_SITE_SETTINGS.dhlApiKey,
    dhlApiSecret:
      typeof raw.dhlApiSecret === "string" ? raw.dhlApiSecret.trim() : DEFAULT_SITE_SETTINGS.dhlApiSecret,
    dhlAccountNumber:
      typeof raw.dhlAccountNumber === "string" ? raw.dhlAccountNumber.trim() : DEFAULT_SITE_SETTINGS.dhlAccountNumber,
    dhlUseSandbox: raw.dhlUseSandbox !== undefined ? Boolean(raw.dhlUseSandbox) : DEFAULT_SITE_SETTINGS.dhlUseSandbox,
    upsEnabled: raw.upsEnabled !== undefined ? Boolean(raw.upsEnabled) : DEFAULT_SITE_SETTINGS.upsEnabled,
    upsClientId:
      typeof raw.upsClientId === "string" ? raw.upsClientId.trim() : DEFAULT_SITE_SETTINGS.upsClientId,
    upsClientSecret:
      typeof raw.upsClientSecret === "string" ? raw.upsClientSecret.trim() : DEFAULT_SITE_SETTINGS.upsClientSecret,
    upsAccountNumber:
      typeof raw.upsAccountNumber === "string" ? raw.upsAccountNumber.trim() : DEFAULT_SITE_SETTINGS.upsAccountNumber,
    upsUseSandbox: raw.upsUseSandbox !== undefined ? Boolean(raw.upsUseSandbox) : DEFAULT_SITE_SETTINGS.upsUseSandbox,
    fedexEnabled: raw.fedexEnabled !== undefined ? Boolean(raw.fedexEnabled) : DEFAULT_SITE_SETTINGS.fedexEnabled,
    fedexApiKey:
      typeof raw.fedexApiKey === "string" ? raw.fedexApiKey.trim() : DEFAULT_SITE_SETTINGS.fedexApiKey,
    fedexApiSecret:
      typeof raw.fedexApiSecret === "string" ? raw.fedexApiSecret.trim() : DEFAULT_SITE_SETTINGS.fedexApiSecret,
    fedexAccountNumber:
      typeof raw.fedexAccountNumber === "string" ? raw.fedexAccountNumber.trim() : DEFAULT_SITE_SETTINGS.fedexAccountNumber,
    fedexUseSandbox: raw.fedexUseSandbox !== undefined ? Boolean(raw.fedexUseSandbox) : DEFAULT_SITE_SETTINGS.fedexUseSandbox,
  }
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const row = await prisma.designSettings.findUnique({ where: { key: SETTINGS_KEY } })
  if (!row) return DEFAULT_SITE_SETTINGS

  try {
    return normalizeSettings(JSON.parse(row.config))
  } catch {
    return DEFAULT_SITE_SETTINGS
  }
}

export async function saveSiteSettings(input: unknown): Promise<SiteSettings> {
  const next = normalizeSettings(input)

  await prisma.designSettings.upsert({
    where: { key: SETTINGS_KEY },
    update: { config: JSON.stringify(next) },
    create: { key: SETTINGS_KEY, config: JSON.stringify(next) },
  })

  return next
}
