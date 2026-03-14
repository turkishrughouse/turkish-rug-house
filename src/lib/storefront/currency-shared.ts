import type { SupportedCurrency } from "@/lib/storefront/currency"
import type { CurrencyRateFreshness, CurrencyRateSource } from "@/lib/storefront/currency-rate-policy"

export const CURRENCY_COOKIE = "trh_currency"

export type StorefrontCurrencySnapshot = {
  selectedCurrency: SupportedCurrency
  usdToEurRate: number
  locale: string
  preferenceSource: "manual" | "auto"
  rateSource: CurrencyRateSource
  rateProvider: string
  rateFetchedAt: string
  rateFreshness: CurrencyRateFreshness
}
