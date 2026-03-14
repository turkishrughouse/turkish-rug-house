import type { SupportedCurrency } from "@/lib/storefront/currency"

export const FALLBACK_USD_TO_EUR_RATE = 0.92
export const RATES_CACHE_TTL_MS = 60 * 60 * 1000
export const RATES_CACHE_MAX_STALE_MS = 24 * 60 * 60 * 1000

export type CurrencyRatesCache = {
  usdToEurRate: number
  fetchedAt: string
  provider: string
}

export type CurrencyRateFreshness = "fresh" | "stale" | "expired"
export type CurrencyRateSource = "live" | "cache" | "fallback"

export type CurrencyRateDiagnostics = {
  usdToEurRate: number
  rateSource: CurrencyRateSource
  rateProvider: string
  rateFetchedAt: string
  cacheAgeMs: number | null
  freshness: CurrencyRateFreshness
}

const EUR_DEFAULT_COUNTRY_CODES = new Set([
  "AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT", "LT", "LU", "LV", "MT",
  "NL", "PT", "SI", "SK",
])

const LANGUAGE_TO_CURRENCY: Record<string, SupportedCurrency> = {
  de: "EUR",
  el: "EUR",
  es: "EUR",
  et: "EUR",
  fi: "EUR",
  fr: "EUR",
  ga: "EUR",
  hr: "EUR",
  it: "EUR",
  lt: "EUR",
  lv: "EUR",
  mt: "EUR",
  nl: "EUR",
  pt: "EUR",
  sk: "EUR",
  sl: "EUR",
}

export function classifyCurrencyRateFreshness(cacheAgeMs: number | null | undefined): CurrencyRateFreshness {
  const age = Number(cacheAgeMs)
  if (!Number.isFinite(age) || age < 0) return "expired"
  if (age <= RATES_CACHE_TTL_MS) return "fresh"
  if (age <= RATES_CACHE_MAX_STALE_MS) return "stale"
  return "expired"
}

export function inferCurrencyFromCountry(countryCode: string | null | undefined): SupportedCurrency | null {
  const normalized = String(countryCode || "").trim().toUpperCase()
  if (!normalized) return null
  return EUR_DEFAULT_COUNTRY_CODES.has(normalized) ? "EUR" : "USD"
}

export function inferCurrencyFromLanguage(acceptLanguage: string | null | undefined): SupportedCurrency | null {
  const normalized = String(acceptLanguage || "").trim().toLowerCase()
  if (!normalized) return null
  const primary = normalized.split(",")[0]?.split("-")[0]?.trim()
  if (!primary) return null
  return LANGUAGE_TO_CURRENCY[primary] || null
}

export function inferAutomaticCurrency(input: {
  countryCode?: string | null
  acceptLanguage?: string | null
}): SupportedCurrency {
  return inferCurrencyFromCountry(input.countryCode) || inferCurrencyFromLanguage(input.acceptLanguage) || "USD"
}

export function resolvePreferredCurrency(input: {
  manualCurrency?: SupportedCurrency | null
  countryCode?: string | null
  acceptLanguage?: string | null
}) {
  const selectedCurrency = input.manualCurrency || inferAutomaticCurrency(input)
  return {
    selectedCurrency,
    preferenceSource: input.manualCurrency ? ("manual" as const) : ("auto" as const),
  }
}

export function buildRateDiagnostics(input: {
  rate: number
  source: CurrencyRateSource
  provider: string
  fetchedAt: string
}): CurrencyRateDiagnostics {
  const fetchedAtMs = new Date(input.fetchedAt).getTime()
  const cacheAgeMs = Number.isFinite(fetchedAtMs) ? Math.max(0, Date.now() - fetchedAtMs) : null
  return {
    usdToEurRate: input.rate,
    rateSource: input.source,
    rateProvider: input.provider,
    rateFetchedAt: input.fetchedAt,
    cacheAgeMs,
    freshness: classifyCurrencyRateFreshness(cacheAgeMs),
  }
}
