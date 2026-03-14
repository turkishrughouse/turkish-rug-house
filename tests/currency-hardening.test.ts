import assert from "node:assert/strict"
import {
  buildRateDiagnostics,
  classifyCurrencyRateFreshness,
  FALLBACK_USD_TO_EUR_RATE,
  inferAutomaticCurrency,
  resolvePreferredCurrency,
  RATES_CACHE_MAX_STALE_MS,
  RATES_CACHE_TTL_MS,
} from "../src/lib/storefront/currency-rate-policy"
import { getOrderDisplaySummary, normalizeOrderDetails } from "../src/lib/order-details"

function test(name: string, fn: () => void) {
  try {
    fn()
    process.stdout.write(`PASS ${name}\n`)
  } catch (error) {
    process.stderr.write(`FAIL ${name}\n`)
    throw error
  }
}

test("fresh cache is classified correctly", () => {
  assert.equal(classifyCurrencyRateFreshness(RATES_CACHE_TTL_MS - 1), "fresh")
})

test("stale cache is classified correctly", () => {
  assert.equal(classifyCurrencyRateFreshness(RATES_CACHE_TTL_MS + 1), "stale")
})

test("expired cache is classified correctly", () => {
  assert.equal(classifyCurrencyRateFreshness(RATES_CACHE_MAX_STALE_MS + 1), "expired")
})

test("eurozone country defaults to EUR but non-euro Europe does not", () => {
  assert.equal(inferAutomaticCurrency({ countryCode: "DE", acceptLanguage: "de-DE,de;q=0.9" }), "EUR")
  assert.equal(inferAutomaticCurrency({ countryCode: "GB", acceptLanguage: "en-GB,en;q=0.9" }), "USD")
  assert.equal(inferAutomaticCurrency({ countryCode: "CH", acceptLanguage: "de-CH,de;q=0.9" }), "USD")
})

test("manual override beats auto detection and remains explicit", () => {
  const resolved = resolvePreferredCurrency({
    manualCurrency: "USD",
    countryCode: "DE",
    acceptLanguage: "de-DE,de;q=0.9",
  })
  assert.equal(resolved.selectedCurrency, "USD")
  assert.equal(resolved.preferenceSource, "manual")
})

test("fallback diagnostics are explicit", () => {
  const diagnostics = buildRateDiagnostics({
    rate: FALLBACK_USD_TO_EUR_RATE,
    source: "fallback",
    provider: "FALLBACK",
    fetchedAt: new Date(0).toISOString(),
  })
  assert.equal(diagnostics.rateSource, "fallback")
  assert.equal(diagnostics.freshness, "expired")
})

test("historical order display summary stays on saved display snapshot", () => {
  const details = normalizeOrderDetails({
    baseCurrency: "USD",
    baseSubtotalAmount: 1000,
    baseShippingAmount: 50,
    baseTaxAmount: 0,
    baseDiscountAmount: 0,
    baseTotalAmount: 1050,
    displayCurrency: "EUR",
    exchangeRateUsed: 0.91,
    displaySubtotalAmount: 910,
    displayShippingAmount: 45.5,
    displayTaxAmount: 0,
    displayDiscountAmount: 0,
    displayTotalAmount: 955.5,
  })
  const summary = getOrderDisplaySummary(details)
  assert.equal(summary.displayCurrency, "EUR")
  assert.equal(summary.exchangeRateUsed, 0.91)
  assert.equal(summary.total, 955.5)
  assert.equal(summary.baseTotal, 1050)
})
