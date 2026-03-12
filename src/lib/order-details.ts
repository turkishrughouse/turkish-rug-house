import { prisma } from "@/lib/db"

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
  invoiceNumber: string | null
  invoiceIssuedAt: string | null
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
  invoiceNumber: null,
  invoiceIssuedAt: null,
}

let ensureOrderDetailsColumnPromise: Promise<void> | null = null

function normalizeNumber(value: unknown, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
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
    invoiceNumber: typeof source.invoiceNumber === "string" && source.invoiceNumber.trim() ? source.invoiceNumber.trim() : null,
    invoiceIssuedAt: typeof source.invoiceIssuedAt === "string" && source.invoiceIssuedAt.trim() ? source.invoiceIssuedAt.trim() : null,
  }
}

export async function ensureOrderDetailsColumn() {
  if (!ensureOrderDetailsColumnPromise) {
    ensureOrderDetailsColumnPromise = (async () => {
      const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("Order")`)
      const hasDetailsJson = columns.some((column) => column.name === "detailsJson")
      if (!hasDetailsJson) {
        await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN "detailsJson" TEXT DEFAULT '{}'`)
      }
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
