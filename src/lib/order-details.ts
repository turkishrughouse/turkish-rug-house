import { addColumnIfMissing } from "@/lib/db-compat"

export type OrderDetails = {
  customerPhone: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  postcode: string | null
  country: string | null
  paymentMethod: string | null
  paymentStatus: string | null
  paymentReference: string | null
  shippingMethod: string | null
  shippingCost: number
  subtotalAmount: number
  taxAmount: number
  discountAmount: number
  refundedAmount: number
  currency: string
  baseCurrency: string
  baseSubtotalAmount: number
  baseShippingAmount: number
  baseTaxAmount: number
  baseDiscountAmount: number
  baseTotalAmount: number
  displayCurrency: string
  exchangeRateUsed: number
  displaySubtotalAmount: number
  displayShippingAmount: number
  displayTaxAmount: number
  displayDiscountAmount: number
  displayTotalAmount: number
  invoiceNumber: string | null
  invoiceIssuedAt: string | null
  paymentProvider: string | null
  paymentSessionId: string | null
  paymentIntentId: string | null
  paymentLastEventId: string | null
  processedWebhookEvents: string[]
}

export const EMPTY_ORDER_DETAILS: OrderDetails = {
  customerPhone: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  state: null,
  postcode: null,
  country: null,
  paymentMethod: null,
  paymentStatus: null,
  paymentReference: null,
  shippingMethod: null,
  shippingCost: 0,
  subtotalAmount: 0,
  taxAmount: 0,
  discountAmount: 0,
  refundedAmount: 0,
  currency: "USD",
  baseCurrency: "USD",
  baseSubtotalAmount: 0,
  baseShippingAmount: 0,
  baseTaxAmount: 0,
  baseDiscountAmount: 0,
  baseTotalAmount: 0,
  displayCurrency: "USD",
  exchangeRateUsed: 1,
  displaySubtotalAmount: 0,
  displayShippingAmount: 0,
  displayTaxAmount: 0,
  displayDiscountAmount: 0,
  displayTotalAmount: 0,
  invoiceNumber: null,
  invoiceIssuedAt: null,
  paymentProvider: null,
  paymentSessionId: null,
  paymentIntentId: null,
  paymentLastEventId: null,
  processedWebhookEvents: [],
}

let ensureOrderDetailsColumnPromise: Promise<void> | null = null

async function getPrisma() {
  const mod = await import("@/lib/db")
  return mod.prisma
}

function normalizeNumber(value: unknown, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
}

export function normalizeOrderDetails(value: unknown): OrderDetails {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  return {
    customerPhone: typeof source.customerPhone === "string" && source.customerPhone.trim() ? source.customerPhone.trim() : null,
    addressLine1: typeof source.addressLine1 === "string" && source.addressLine1.trim() ? source.addressLine1.trim() : null,
    addressLine2: typeof source.addressLine2 === "string" && source.addressLine2.trim() ? source.addressLine2.trim() : null,
    city: typeof source.city === "string" && source.city.trim() ? source.city.trim() : null,
    state: typeof source.state === "string" && source.state.trim() ? source.state.trim() : null,
    postcode: typeof source.postcode === "string" && source.postcode.trim() ? source.postcode.trim() : null,
    country: typeof source.country === "string" && source.country.trim() ? source.country.trim() : null,
    paymentMethod: typeof source.paymentMethod === "string" && source.paymentMethod.trim() ? source.paymentMethod.trim() : null,
    paymentStatus: typeof source.paymentStatus === "string" && source.paymentStatus.trim() ? source.paymentStatus.trim() : null,
    paymentReference: typeof source.paymentReference === "string" && source.paymentReference.trim() ? source.paymentReference.trim() : null,
    shippingMethod: typeof source.shippingMethod === "string" && source.shippingMethod.trim() ? source.shippingMethod.trim() : null,
    shippingCost: normalizeNumber(source.shippingCost),
    subtotalAmount: normalizeNumber(source.subtotalAmount),
    taxAmount: normalizeNumber(source.taxAmount),
    discountAmount: normalizeNumber(source.discountAmount),
    refundedAmount: normalizeNumber(source.refundedAmount),
    currency: typeof source.currency === "string" && source.currency.trim() ? source.currency.trim().toUpperCase() : "USD",
    baseCurrency: typeof source.baseCurrency === "string" && source.baseCurrency.trim() ? source.baseCurrency.trim().toUpperCase() : "USD",
    baseSubtotalAmount: normalizeNumber(source.baseSubtotalAmount, normalizeNumber(source.subtotalAmount)),
    baseShippingAmount: normalizeNumber(source.baseShippingAmount, normalizeNumber(source.shippingCost)),
    baseTaxAmount: normalizeNumber(source.baseTaxAmount, normalizeNumber(source.taxAmount)),
    baseDiscountAmount: normalizeNumber(source.baseDiscountAmount, normalizeNumber(source.discountAmount)),
    baseTotalAmount: normalizeNumber(
      source.baseTotalAmount,
      normalizeNumber(source.subtotalAmount) + normalizeNumber(source.shippingCost) + normalizeNumber(source.taxAmount) - normalizeNumber(source.discountAmount)
    ),
    displayCurrency:
      typeof source.displayCurrency === "string" && source.displayCurrency.trim()
        ? source.displayCurrency.trim().toUpperCase()
        : (typeof source.currency === "string" && source.currency.trim() ? source.currency.trim().toUpperCase() : "USD"),
    exchangeRateUsed: normalizeNumber(source.exchangeRateUsed, 1),
    displaySubtotalAmount: normalizeNumber(source.displaySubtotalAmount, normalizeNumber(source.subtotalAmount)),
    displayShippingAmount: normalizeNumber(source.displayShippingAmount, normalizeNumber(source.shippingCost)),
    displayTaxAmount: normalizeNumber(source.displayTaxAmount, normalizeNumber(source.taxAmount)),
    displayDiscountAmount: normalizeNumber(source.displayDiscountAmount, normalizeNumber(source.discountAmount)),
    displayTotalAmount: normalizeNumber(
      source.displayTotalAmount,
      normalizeNumber(source.subtotalAmount) + normalizeNumber(source.shippingCost) + normalizeNumber(source.taxAmount) - normalizeNumber(source.discountAmount)
    ),
    invoiceNumber: typeof source.invoiceNumber === "string" && source.invoiceNumber.trim() ? source.invoiceNumber.trim() : null,
    invoiceIssuedAt: typeof source.invoiceIssuedAt === "string" && source.invoiceIssuedAt.trim() ? source.invoiceIssuedAt.trim() : null,
    paymentProvider: typeof source.paymentProvider === "string" && source.paymentProvider.trim() ? source.paymentProvider.trim() : null,
    paymentSessionId: typeof source.paymentSessionId === "string" && source.paymentSessionId.trim() ? source.paymentSessionId.trim() : null,
    paymentIntentId: typeof source.paymentIntentId === "string" && source.paymentIntentId.trim() ? source.paymentIntentId.trim() : null,
    paymentLastEventId: typeof source.paymentLastEventId === "string" && source.paymentLastEventId.trim() ? source.paymentLastEventId.trim() : null,
    processedWebhookEvents: normalizeStringArray(source.processedWebhookEvents),
  }
}

export async function ensureOrderDetailsColumn() {
  if (!ensureOrderDetailsColumnPromise) {
    ensureOrderDetailsColumnPromise = (async () => {
      const prisma = await getPrisma()
      await addColumnIfMissing(prisma, "Order", "detailsJson", "TEXT DEFAULT '{}'")
    })().catch((error) => {
      ensureOrderDetailsColumnPromise = null
      throw error
    })
  }
  await ensureOrderDetailsColumnPromise
}

export async function getOrderDetailsMap(orderIds: string[]) {
  const ids = Array.from(new Set(orderIds.filter(Boolean)))
  if (ids.length === 0) return new Map<string, OrderDetails>()
  await ensureOrderDetailsColumn()
  const prisma = await getPrisma()
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; detailsJson: string | null }>>(
    `SELECT "id", "detailsJson" FROM "Order" WHERE "id" IN (${ids.map(() => "?").join(",")})`,
    ...ids
  )
  return new Map(
    rows.map((row) => {
      let parsed: unknown = {}
      try {
        parsed = row.detailsJson ? JSON.parse(row.detailsJson) : {}
      } catch {
        parsed = {}
      }
      return [row.id, normalizeOrderDetails(parsed)] as const
    })
  )
}

export async function getSingleOrderDetails(orderId: string) {
  return (await getOrderDetailsMap([orderId])).get(orderId) || { ...EMPTY_ORDER_DETAILS }
}

export async function saveOrderDetails(orderId: string, input: Partial<OrderDetails>) {
  const existing = await getSingleOrderDetails(orderId)
  const next = normalizeOrderDetails({ ...existing, ...input })
  const prisma = await getPrisma()
  await prisma.$executeRawUnsafe(
    `UPDATE "Order" SET "detailsJson" = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ?`,
    JSON.stringify(next),
    orderId
  )
  return next
}

export function formatOrderCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(Number(amount || 0))
}

export function getOrderDisplaySummary(details: OrderDetails) {
  const displayCurrency = details.displayCurrency || details.currency || "USD"
  return {
    displayCurrency,
    exchangeRateUsed: Number(details.exchangeRateUsed || 1),
    subtotal: Number(details.displaySubtotalAmount || details.subtotalAmount || 0),
    shipping: Number(details.displayShippingAmount || details.shippingCost || 0),
    tax: Number(details.displayTaxAmount || details.taxAmount || 0),
    discount: Number(details.displayDiscountAmount || details.discountAmount || 0),
    total: Number(details.displayTotalAmount || details.baseTotalAmount || 0),
    baseCurrency: details.baseCurrency || "USD",
    baseSubtotal: Number(details.baseSubtotalAmount || details.subtotalAmount || 0),
    baseShipping: Number(details.baseShippingAmount || details.shippingCost || 0),
    baseTax: Number(details.baseTaxAmount || details.taxAmount || 0),
    baseDiscount: Number(details.baseDiscountAmount || details.discountAmount || 0),
    baseTotal: Number(details.baseTotalAmount || 0),
  }
}
