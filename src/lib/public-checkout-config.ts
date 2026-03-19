import type { SiteSettings } from "@/lib/site-settings"

export type PublicCheckoutPaymentProvider = {
  key: "stripe" | "paypal" | "paytr" | "gpay" | "applepay"
  title: string
  shortLabel: string
  description: string
  detail: string
}

export type PublicCheckoutConfig = {
  checkoutEnabled: boolean
  enableGuestCheckout: boolean
  defaultCurrency: string
  currencyPosition: "left" | "right"
  thousandSeparator: string
  decimalSeparator: string
  numberOfDecimals: number
  flatShippingRate: number
  localPickupRate: number
  enableTaxes: boolean
  requirePhoneAtCheckout: boolean
  requireAddressAtCheckout: boolean
  paymentDefaultProvider: "stripe" | "paypal" | "gpay" | "applepay" | "paytr"
  paymentProviders: PublicCheckoutPaymentProvider[]
}

const PAYMENT_PROVIDER_CATALOG: Record<PublicCheckoutPaymentProvider["key"], PublicCheckoutPaymentProvider> = {
  stripe: {
    key: "stripe",
    title: "Credit Card (Stripe)",
    shortLabel: "Stripe",
    description: "Pay securely with your card.",
    detail: "Card details are entered securely on Stripe after you confirm the order.",
  },
  paypal: {
    key: "paypal",
    title: "PayPal",
    shortLabel: "PayPal",
    description: "Pay using your PayPal account.",
    detail: "You will be redirected to PayPal to complete payment securely.",
  },
  paytr: {
    key: "paytr",
    title: "PayTR",
    shortLabel: "PayTR",
    description: "Local secure payment gateway.",
    detail: "You will be redirected to PayTR to complete your payment securely.",
  },
  gpay: {
    key: "gpay",
    title: "Google Pay",
    shortLabel: "Google Pay",
    description: "Use your saved cards.",
    detail: "Fast checkout on supported devices using your Google Pay wallet.",
  },
  applepay: {
    key: "applepay",
    title: "Apple Pay",
    shortLabel: "Apple Pay",
    description: "Fast checkout on supported devices.",
    detail: "Use Face ID or Touch ID to confirm payment on supported Apple devices.",
  },
}

function hasValue(value: string | null | undefined) {
  return Boolean((value || "").trim())
}

export function getEnabledCheckoutPaymentProviders(settings: SiteSettings): PublicCheckoutPaymentProvider[] {
  const providers: PublicCheckoutPaymentProvider[] = []

  if (settings.stripeEnabled && hasValue(settings.stripeSecretKey)) {
    providers.push(PAYMENT_PROVIDER_CATALOG.stripe)
  }

  if (
    settings.paypalEnabled &&
    hasValue(settings.paypalClientId) &&
    hasValue(settings.paypalClientSecret) &&
    hasValue(settings.paypalMode)
  ) {
    providers.push(PAYMENT_PROVIDER_CATALOG.paypal)
  }

  if (
    settings.paytrEnabled &&
    hasValue(settings.paytrMerchantId) &&
    hasValue(settings.paytrMerchantKey) &&
    hasValue(settings.paytrMerchantSalt)
  ) {
    providers.push(PAYMENT_PROVIDER_CATALOG.paytr)
  }

  if (
    settings.googlePayEnabled &&
    (hasValue(settings.googlePayMerchantId) || hasValue(settings.googlePayMerchantName) || hasValue(settings.googlePayApiKey)) &&
    (hasValue(settings.googlePayApiSecret) || hasValue(settings.stripeSecretKey))
  ) {
    providers.push(PAYMENT_PROVIDER_CATALOG.gpay)
  }

  if (
    settings.applePayEnabled &&
    (hasValue(settings.applePayMerchantId) || hasValue(settings.applePayMerchantName) || hasValue(settings.applePayDomain) || hasValue(settings.applePayApiKey)) &&
    (hasValue(settings.applePayApiSecret) || hasValue(settings.stripeSecretKey))
  ) {
    providers.push(PAYMENT_PROVIDER_CATALOG.applepay)
  }

  return providers
}

export function getPublicCheckoutConfig(settings: SiteSettings): PublicCheckoutConfig {
  return {
    checkoutEnabled: settings.checkoutEnabled,
    enableGuestCheckout: settings.enableGuestCheckout,
    defaultCurrency: settings.defaultCurrency,
    currencyPosition: settings.currencyPosition === "right" ? "right" : "left",
    thousandSeparator: settings.thousandSeparator,
    decimalSeparator: settings.decimalSeparator,
    numberOfDecimals: settings.numberOfDecimals,
    flatShippingRate: settings.flatShippingRate,
    localPickupRate: settings.localPickupRate,
    enableTaxes: settings.enableTaxes,
    requirePhoneAtCheckout: settings.requirePhoneAtCheckout,
    requireAddressAtCheckout: settings.requireAddressAtCheckout,
    paymentDefaultProvider: settings.paymentDefaultProvider,
    paymentProviders: getEnabledCheckoutPaymentProviders(settings),
  }
}
