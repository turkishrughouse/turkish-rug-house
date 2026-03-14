import { cookies, headers } from "next/headers"
import type { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { logger } from "@/lib/logger"
import { CURRENCY_COOKIE, type StorefrontCurrencySnapshot } from "@/lib/storefront/currency-shared"
import {
  buildRateDiagnostics,
  FALLBACK_USD_TO_EUR_RATE,
  RATES_CACHE_MAX_STALE_MS,
  RATES_CACHE_TTL_MS,
  resolvePreferredCurrency,
  type CurrencyRateDiagnostics,
  type CurrencyRatesCache,
} from "@/lib/storefront/currency-rate-policy"
import {
  SUPPORTED_CURRENCIES,
  convertUsdToCurrency,
  getCurrencyLocale,
  roundCurrency,
  type SupportedCurrency,
} from "@/lib/storefront/currency"

const RATES_CACHE_KEY = "currency_rates_cache_v1"

function parseCachedRates(raw: string | null | undefined): CurrencyRatesCache | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<CurrencyRatesCache>
    const usdToEurRate = Number(parsed.usdToEurRate)
    if (!Number.isFinite(usdToEurRate) || usdToEurRate <= 0) return null
    const fetchedAt = typeof parsed.fetchedAt === "string" ? parsed.fetchedAt : ""
    if (!fetchedAt) return null
    return {
      usdToEurRate,
      fetchedAt,
      provider: typeof parsed.provider === "string" && parsed.provider.trim() ? parsed.provider.trim() : "ECB",
    }
  } catch {
    return null
  }
}

async function readRatesCache() {
  const row = await prisma.designSettings.findUnique({
    where: { key: RATES_CACHE_KEY },
    select: { config: true },
  })
  return parseCachedRates(row?.config)
}

async function writeRatesCache(cache: CurrencyRatesCache) {
  await prisma.designSettings.upsert({
    where: { key: RATES_CACHE_KEY },
    update: { config: JSON.stringify(cache) },
    create: { key: RATES_CACHE_KEY, config: JSON.stringify(cache) },
  })
}

async function fetchLiveUsdToEurRate(): Promise<CurrencyRatesCache> {
  const response = await fetch("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml", {
    cache: "no-store",
    headers: { Accept: "application/xml,text/xml;q=0.9,*/*;q=0.8" },
  })

  if (!response.ok) {
    throw new Error(`ECB exchange rate request failed with status ${response.status}`)
  }

  const xml = await response.text()
  const usdMatch = xml.match(/currency=["']USD["']\s+rate=["']([^"']+)["']/i)
  const usdPerEur = Number(usdMatch?.[1] || "")
  if (!Number.isFinite(usdPerEur) || usdPerEur <= 0) {
    throw new Error("ECB response did not include a valid USD rate")
  }

  return {
    usdToEurRate: roundCurrency(1 / usdPerEur),
    fetchedAt: new Date().toISOString(),
    provider: "ECB",
  }
}

export async function getUsdEurRateSnapshot() {
  const cached = await readRatesCache()
  const cachedAge = cached ? Date.now() - new Date(cached.fetchedAt).getTime() : Number.POSITIVE_INFINITY

  if (cached && cachedAge < RATES_CACHE_TTL_MS) {
    return buildRateDiagnostics({
      rate: cached.usdToEurRate,
      source: "cache",
      provider: cached.provider,
      fetchedAt: cached.fetchedAt,
    })
  }

  try {
    const live = await fetchLiveUsdToEurRate()
    await writeRatesCache(live)
    return buildRateDiagnostics({
      rate: live.usdToEurRate,
      source: "live",
      provider: live.provider,
      fetchedAt: live.fetchedAt,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown exchange-rate error"
    if (cached && cachedAge <= RATES_CACHE_MAX_STALE_MS) {
      logger.warn(
        "Live exchange rate fetch failed, using stale cached rate",
        { error: message, cachedAt: cached.fetchedAt, cacheAgeMs: cachedAge },
        "currency"
      )
      return buildRateDiagnostics({
        rate: cached.usdToEurRate,
        source: "cache",
        provider: cached.provider,
        fetchedAt: cached.fetchedAt,
      })
    }

    if (cached) {
      logger.error(
        "Live exchange rate fetch failed and cached rate is expired; using fallback rate",
        { error: message, cachedAt: cached.fetchedAt, cacheAgeMs: cachedAge, fallbackRate: FALLBACK_USD_TO_EUR_RATE },
        "currency"
      )
    } else {
      logger.error("Live exchange rate fetch failed, using fallback rate", { error: message, fallbackRate: FALLBACK_USD_TO_EUR_RATE }, "currency")
    }

    return buildRateDiagnostics({
      rate: FALLBACK_USD_TO_EUR_RATE,
      source: "fallback",
      provider: "FALLBACK",
      fetchedAt: cached?.fetchedAt || new Date(0).toISOString(),
    })
  }
}

function readRequestSignals(input?: {
  cookieCurrency?: string | null
  countryCode?: string | null
  acceptLanguage?: string | null
}) {
  return {
    cookieCurrency: normalizeCookieCurrency(input?.cookieCurrency),
    countryCode: String(input?.countryCode || "").trim().toUpperCase(),
    acceptLanguage: String(input?.acceptLanguage || "").trim(),
  }
}

function normalizeCookieCurrency(value: string | null | undefined): SupportedCurrency | null {
  const normalized = String(value || "").trim().toUpperCase()
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(normalized) ? (normalized as SupportedCurrency) : null
}

export async function resolveStorefrontCurrencyFromRequest(input?: {
  cookieCurrency?: string | null
  countryCode?: string | null
  acceptLanguage?: string | null
}): Promise<StorefrontCurrencySnapshot> {
  const signals = readRequestSignals(input)
  const { selectedCurrency, preferenceSource } = resolvePreferredCurrency({
    manualCurrency: signals.cookieCurrency,
    countryCode: signals.countryCode,
    acceptLanguage: signals.acceptLanguage,
  })
  const rates = await getUsdEurRateSnapshot()

  return {
    selectedCurrency,
    usdToEurRate: rates.usdToEurRate,
    locale: getCurrencyLocale(selectedCurrency),
    preferenceSource,
    rateSource: rates.rateSource,
    rateProvider: rates.rateProvider,
    rateFetchedAt: rates.rateFetchedAt,
    rateFreshness: rates.freshness,
  }
}

export async function getStorefrontCurrencySnapshot(): Promise<StorefrontCurrencySnapshot> {
  const cookieStore = await cookies()
  const headerStore = await headers()
  return resolveStorefrontCurrencyFromRequest({
    cookieCurrency: cookieStore.get(CURRENCY_COOKIE)?.value || null,
    countryCode:
      headerStore.get("x-vercel-ip-country") ||
      headerStore.get("cf-ipcountry") ||
      headerStore.get("x-country-code") ||
      "",
    acceptLanguage: headerStore.get("accept-language") || "",
  })
}

export function getCurrencyCookieName() {
  return CURRENCY_COOKIE
}

export function readCurrencyFromNextRequest(req: NextRequest) {
  return normalizeCookieCurrency(req.cookies.get(CURRENCY_COOKIE)?.value || null)
}

export function buildDisplayAmountsFromUsd(input: {
  subtotalUsd: number
  shippingUsd: number
  taxUsd: number
  discountUsd?: number
  selectedCurrency: SupportedCurrency
  usdToEurRate: number
}) {
  const discountUsd = Number(input.discountUsd || 0)
  const subtotal = convertUsdToCurrency(input.subtotalUsd, input.selectedCurrency, input.usdToEurRate)
  const shipping = convertUsdToCurrency(input.shippingUsd, input.selectedCurrency, input.usdToEurRate)
  const tax = convertUsdToCurrency(input.taxUsd, input.selectedCurrency, input.usdToEurRate)
  const discount = convertUsdToCurrency(discountUsd, input.selectedCurrency, input.usdToEurRate)
  const total = roundCurrency(subtotal + shipping + tax - discount)

  return { subtotal, shipping, tax, discount, total }
}

export async function getCurrencyRateDiagnostics(): Promise<CurrencyRateDiagnostics> {
  return getUsdEurRateSnapshot()
}
