export const SUPPORTED_CURRENCIES = ["USD", "EUR"] as const

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]

export type CurrencySettings = {
  defaultCurrency?: string
  selectedCurrency?: SupportedCurrency
  valueCurrency?: SupportedCurrency
  usdToEurRate?: number
  locale?: string
  currencyPosition?: "left" | "right" | "left-space" | "right-space"
  thousandSeparator?: string
  decimalSeparator?: string
  numberOfDecimals?: number
}

export function normalizeCurrency(value: string | null | undefined): SupportedCurrency {
  return String(value || "USD").toUpperCase() === "EUR" ? "EUR" : "USD"
}

export function getCurrencyLocale(currency: SupportedCurrency) {
  return currency === "EUR" ? "de-DE" : "en-US"
}

export function roundCurrency(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100
}

export function getSafeUsdToEurRate(rate?: number | null) {
  const numeric = Number(rate)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0.92
}

export function convertUsdToCurrency(value: number, currency: SupportedCurrency, usdToEurRate?: number | null) {
  const safeValue = Number(value) || 0
  if (currency === "EUR") {
    return roundCurrency(safeValue * getSafeUsdToEurRate(usdToEurRate))
  }
  return roundCurrency(safeValue)
}

export function convertCurrencyAmount(
  value: number,
  fromCurrency: SupportedCurrency,
  toCurrency: SupportedCurrency,
  usdToEurRate?: number | null
) {
  const safeValue = Number(value) || 0
  if (fromCurrency === toCurrency) return roundCurrency(safeValue)
  const rate = getSafeUsdToEurRate(usdToEurRate)
  if (fromCurrency === "USD" && toCurrency === "EUR") return roundCurrency(safeValue * rate)
  if (fromCurrency === "EUR" && toCurrency === "USD") return roundCurrency(safeValue / rate)
  return roundCurrency(safeValue)
}

export function formatCurrency(value: number, settings?: CurrencySettings) {
  const displayCurrency = normalizeCurrency(settings?.selectedCurrency || settings?.defaultCurrency)
  const valueCurrency = normalizeCurrency(settings?.valueCurrency || "USD")
  const displayValue = convertCurrencyAmount(value, valueCurrency, displayCurrency, settings?.usdToEurRate)

  return new Intl.NumberFormat(settings?.locale || getCurrencyLocale(displayCurrency), {
    style: "currency",
    currency: displayCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(displayValue)
}
