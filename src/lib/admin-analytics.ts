import { prisma } from "@/lib/db"
import { EMPTY_ORDER_DETAILS, getOrderDetailsMap, type OrderDetails } from "@/lib/order-details"

export const ANALYTICS_RANGE_OPTIONS = ["7d", "30d", "365d"] as const

export type AnalyticsRangeKey = (typeof ANALYTICS_RANGE_OPTIONS)[number]

export type AnalyticsOrderRow = {
  id: string
  orderNumber: string
  customerEmail: string
  customerName: string | null
  total: number
  status: string
  shipmentStatus: string
  createdAt: Date
  updatedAt: Date
  items: Array<{
    productId: string | null
    title: string
    quantity: number
    price: number
  }>
  details: OrderDetails
}

export type AnalyticsProductRow = {
  id: string
  slug: string
  sku: string | null
  title: string
  price: number
  isStock: boolean
  stockCount: number
  isPublished: boolean
  createdAt: Date
  createdById: string | null
  createdByName: string | null
}

export type AnalyticsCategoryRow = {
  id: string
  title: string
  slug: string
  parentId: string | null
  parentTitle: string | null
  productIds: string[]
}

export type AnalyticsRange = {
  key: AnalyticsRangeKey
  label: string
  from: Date
  to: Date
  previousFrom: Date
  previousTo: Date
}

export type AnalyticsTrendPoint = {
  key: string
  label: string
  value: number
}

export type AnalyticsSnapshot = {
  range: AnalyticsRange
  orders: AnalyticsOrderRow[]
  ordersInRange: AnalyticsOrderRow[]
  previousOrdersInRange: AnalyticsOrderRow[]
  products: AnalyticsProductRow[]
  productsInRange: AnalyticsProductRow[]
  previousProductsInRange: AnalyticsProductRow[]
  categories: AnalyticsCategoryRow[]
}

const CANCELLED_ORDER_STATUSES = new Set(["CANCELLED", "TRASHED"])
const REFUNDED_ORDER_STATUSES = new Set(["REFUNDED"])
const PAID_ORDER_STATUSES = new Set(["PAID", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED", "REFUNDED"])

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function endOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999)
}

function addDays(value: Date, days: number) {
  const next = new Date(value)
  next.setDate(next.getDate() + days)
  return next
}

function addMilliseconds(value: Date, amount: number) {
  return new Date(value.getTime() + amount)
}

function normalizeDate(value: unknown) {
  if (value instanceof Date) return value
  const next = new Date(String(value))
  return Number.isNaN(next.getTime()) ? new Date(0) : next
}

function normalizeNumber(value: unknown) {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function getRangeLabel(key: AnalyticsRangeKey) {
  if (key === "7d") return "Last 7 days"
  if (key === "365d") return "Last 12 months"
  return "Last 30 days"
}

export function resolveAnalyticsRangeKey(value: string | undefined): AnalyticsRangeKey {
  return ANALYTICS_RANGE_OPTIONS.includes(value as AnalyticsRangeKey) ? (value as AnalyticsRangeKey) : "30d"
}

export function getAnalyticsRange(key: AnalyticsRangeKey): AnalyticsRange {
  const today = startOfDay(new Date())
  const totalDays = key === "7d" ? 7 : key === "365d" ? 365 : 30
  const from = startOfDay(addDays(today, -(totalDays - 1)))
  const to = endOfDay(today)
  const previousTo = endOfDay(addDays(from, -1))
  const previousFrom = startOfDay(addDays(from, -totalDays))

  return {
    key,
    label: getRangeLabel(key),
    from,
    to,
    previousFrom,
    previousTo,
  }
}

export function formatAnalyticsCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(normalizeNumber(value))
}

export function formatAnalyticsNumber(value: number) {
  return normalizeNumber(value).toLocaleString("en-US")
}

export function formatAnalyticsDate(value: Date) {
  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function formatAnalyticsDateTime(value: Date) {
  return value.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function getOrderRefundAmount(order: AnalyticsOrderRow) {
  if (order.details.refundedAmount > 0) return order.details.refundedAmount
  if (REFUNDED_ORDER_STATUSES.has(order.status.toUpperCase())) return order.total
  return 0
}

export function getOrderGrossAmount(order: AnalyticsOrderRow) {
  if (CANCELLED_ORDER_STATUSES.has(order.status.toUpperCase())) return 0
  return order.total
}

export function getOrderNetAmount(order: AnalyticsOrderRow) {
  return Math.max(0, getOrderGrossAmount(order) - getOrderRefundAmount(order))
}

export function isPaidOrder(order: AnalyticsOrderRow) {
  const paymentStatus = order.details.paymentStatus?.toUpperCase()
  if (paymentStatus === "PAID" || paymentStatus === "COMPLETED") return true
  return PAID_ORDER_STATUSES.has(order.status.toUpperCase())
}

export function buildTrendSeries<T extends { createdAt: Date }>(
  range: AnalyticsRange,
  rows: T[],
  getValue: (row: T) => number
): AnalyticsTrendPoint[] {
  if (range.key === "365d") {
    const monthly = new Map<string, number>()
    rows.forEach((row) => {
      const date = row.createdAt
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      monthly.set(key, (monthly.get(key) || 0) + getValue(row))
    })
    const points: AnalyticsTrendPoint[] = []
    const cursor = new Date(range.from.getFullYear(), range.from.getMonth(), 1)
    const finalMonth = new Date(range.to.getFullYear(), range.to.getMonth(), 1)
    while (cursor <= finalMonth) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`
      points.push({
        key,
        label: cursor.toLocaleDateString("en-US", { month: "short" }),
        value: Number((monthly.get(key) || 0).toFixed(2)),
      })
      cursor.setMonth(cursor.getMonth() + 1)
    }
    return points
  }

  const daily = new Map<string, number>()
  rows.forEach((row) => {
    const date = startOfDay(row.createdAt)
    const key = date.toISOString().slice(0, 10)
    daily.set(key, (daily.get(key) || 0) + getValue(row))
  })
  const points: AnalyticsTrendPoint[] = []
  for (let cursor = startOfDay(range.from); cursor <= range.to; cursor = addDays(cursor, 1)) {
    const key = cursor.toISOString().slice(0, 10)
    points.push({
      key,
      label: cursor.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: Number((daily.get(key) || 0).toFixed(2)),
    })
  }
  return points
}

export async function getAnalyticsSnapshot(rangeKey: AnalyticsRangeKey = "30d"): Promise<AnalyticsSnapshot> {
  const range = getAnalyticsRange(rangeKey)
  const [orderRows, productRows, categoryRows] = await Promise.all([
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          select: {
            productId: true,
            title: true,
            quantity: true,
            price: true,
          },
        },
      },
    }),
    prisma.$queryRaw<
      Array<{
        id: string
        slug: string
        sku: string | null
        title: string
        price: number | string | null
        isStock: number | boolean | null
        stockCount: number | null
        isPublished: number | boolean | null
        createdAt: string | Date
        createdById: string | null
        createdByName: string | null
      }>
    >`
      SELECT "id", "slug", "sku", "title", "price", "isStock", "stockCount", "isPublished", "createdAt", "createdById", "createdByName"
       FROM "Product"
       WHERE "deletedAt" IS NULL
       ORDER BY "createdAt" DESC
    `,
    prisma.category.findMany({
      select: {
        id: true,
        title: true,
        slug: true,
        parentId: true,
        parent: {
          select: {
            title: true,
          },
        },
        products: {
          select: {
            id: true,
          },
        },
      },
      orderBy: [{ parentId: "asc" }, { title: "asc" }],
    }),
  ])

  const detailsMap = await getOrderDetailsMap(orderRows.map((order) => order.id))

  const orders = orderRows.map<AnalyticsOrderRow>((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    customerEmail: order.customerEmail,
    customerName: order.customerName,
    total: normalizeNumber(order.total),
    status: String(order.status || "PENDING").toUpperCase(),
    shipmentStatus: String(order.shipmentStatus || "PENDING").toUpperCase(),
    createdAt: normalizeDate(order.createdAt),
    updatedAt: normalizeDate(order.updatedAt),
    items: order.items.map((item) => ({
      productId: item.productId,
      title: item.title,
      quantity: normalizeNumber(item.quantity),
      price: normalizeNumber(item.price),
    })),
    details: detailsMap.get(order.id) || { ...EMPTY_ORDER_DETAILS },
  }))

  const products = productRows.map<AnalyticsProductRow>((product) => ({
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    title: product.title,
    price: normalizeNumber(product.price),
    isStock: Boolean(product.isStock),
    stockCount: normalizeNumber(product.stockCount),
    isPublished: Boolean(product.isPublished),
    createdAt: normalizeDate(product.createdAt),
    createdById: product.createdById,
    createdByName: product.createdByName,
  }))

  const categories = categoryRows.map<AnalyticsCategoryRow>((category) => ({
    id: category.id,
    title: category.title,
    slug: category.slug,
    parentId: category.parentId,
    parentTitle: category.parent?.title || null,
    productIds: category.products.map((product) => product.id),
  }))

  const isWithinRange = (value: Date, from: Date, to: Date) => value >= from && value <= to

  return {
    range,
    orders,
    ordersInRange: orders.filter((order) => isWithinRange(order.createdAt, range.from, range.to)),
    previousOrdersInRange: orders.filter((order) => isWithinRange(order.createdAt, range.previousFrom, range.previousTo)),
    products,
    productsInRange: products.filter((product) => isWithinRange(product.createdAt, range.from, range.to)),
    previousProductsInRange: products.filter((product) => isWithinRange(product.createdAt, range.previousFrom, range.previousTo)),
    categories,
  }
}

export function getDistinctCustomerCount(orders: AnalyticsOrderRow[]) {
  return new Set(orders.map((order) => order.customerEmail.trim().toLowerCase()).filter(Boolean)).size
}

export function getTopProducts(orders: AnalyticsOrderRow[], limit = 6) {
  const map = new Map<string, { title: string; sku: string | null; revenue: number; quantity: number; orders: Set<string> }>()
  orders.forEach((order) => {
    order.items.forEach((item) => {
      const key = item.productId || item.title
      const current = map.get(key) || { title: item.title, sku: null, revenue: 0, quantity: 0, orders: new Set<string>() }
      current.revenue += item.price * item.quantity
      current.quantity += item.quantity
      current.orders.add(order.id)
      map.set(key, current)
    })
  })
  return Array.from(map.values())
    .map((row) => ({
      title: row.title,
      sku: row.sku,
      revenue: Number(row.revenue.toFixed(2)),
      quantity: row.quantity,
      orders: row.orders.size,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
}

export function getCategoryPerformance(
  categories: AnalyticsCategoryRow[],
  orders: AnalyticsOrderRow[]
) {
  const productToCategories = new Map<string, AnalyticsCategoryRow[]>()
  categories.forEach((category) => {
    category.productIds.forEach((productId) => {
      const current = productToCategories.get(productId) || []
      current.push(category)
      productToCategories.set(productId, current)
    })
  })

  const performance = new Map<string, { title: string; productCount: number; orders: Set<string>; revenue: number; quantity: number }>()
  categories.forEach((category) => {
    performance.set(category.id, {
      title: category.title,
      productCount: category.productIds.length,
      orders: new Set<string>(),
      revenue: 0,
      quantity: 0,
    })
  })

  orders.forEach((order) => {
    order.items.forEach((item) => {
      if (!item.productId) return
      const matchingCategories = productToCategories.get(item.productId) || []
      matchingCategories.forEach((category) => {
        const current = performance.get(category.id)
        if (!current) return
        current.orders.add(order.id)
        current.revenue += item.price * item.quantity
        current.quantity += item.quantity
      })
    })
  })

  return Array.from(performance.entries())
    .map(([id, value]) => ({
      id,
      title: value.title,
      productCount: value.productCount,
      orderCount: value.orders.size,
      revenue: Number(value.revenue.toFixed(2)),
      quantity: value.quantity,
    }))
    .sort((a, b) => b.revenue - a.revenue || b.productCount - a.productCount)
}

export function calculatePercentChange(current: number, previous: number) {
  if (previous === 0 && current === 0) return 0
  if (previous === 0) return 100
  return Number((((current - previous) / previous) * 100).toFixed(1))
}

export function getStockHealth(products: AnalyticsProductRow[]) {
  const published = products.filter((product) => product.isPublished)
  const inStock = published.filter((product) => product.isStock && product.stockCount > 0)
  const lowStock = published.filter((product) => product.isStock && product.stockCount > 0 && product.stockCount <= 3)
  const outOfStock = published.filter((product) => !product.isStock || product.stockCount <= 0)
  return {
    publishedCount: published.length,
    inStockCount: inStock.length,
    lowStockCount: lowStock.length,
    outOfStockCount: outOfStock.length,
    lowStockProducts: lowStock.sort((a, b) => a.stockCount - b.stockCount),
    outOfStockProducts: outOfStock.sort((a, b) => a.title.localeCompare(b.title)),
  }
}

export function getTopCreators(products: AnalyticsProductRow[], limit = 6) {
  const map = new Map<string, { label: string; count: number }>()
  products.forEach((product) => {
    const key = product.createdById || product.createdByName || "unknown"
    const label = product.createdByName || product.createdById || "Unknown creator"
    const current = map.get(key) || { label, count: 0 }
    current.count += 1
    map.set(key, current)
  })
  return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, limit)
}

export function getPaymentMethodBreakdown(orders: AnalyticsOrderRow[]) {
  const map = new Map<string, { count: number; revenue: number }>()
  orders.forEach((order) => {
    const key = order.details.paymentMethod?.trim() || "Unknown"
    const current = map.get(key) || { count: 0, revenue: 0 }
    current.count += 1
    current.revenue += getOrderNetAmount(order)
    map.set(key, current)
  })
  return Array.from(map.entries())
    .map(([method, value]) => ({
      method,
      count: value.count,
      revenue: Number(value.revenue.toFixed(2)),
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

export function getTaxCountryBreakdown(orders: AnalyticsOrderRow[]) {
  const map = new Map<string, { tax: number; orders: number }>()
  orders.forEach((order) => {
    if (order.details.taxAmount <= 0) return
    const key = order.details.country?.trim() || "Unknown"
    const current = map.get(key) || { tax: 0, orders: 0 }
    current.tax += order.details.taxAmount
    current.orders += 1
    map.set(key, current)
  })
  return Array.from(map.entries())
    .map(([country, value]) => ({
      country,
      tax: Number(value.tax.toFixed(2)),
      orders: value.orders,
    }))
    .sort((a, b) => b.tax - a.tax)
}

export function getRecentActivity(snapshot: AnalyticsSnapshot) {
  const recentOrders = snapshot.orders.slice(0, 5)
  const recentProducts = [...snapshot.products].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5)
  return { recentOrders, recentProducts }
}

export function isAnalyticsEmpty(orders: AnalyticsOrderRow[], products: AnalyticsProductRow[]) {
  return orders.length === 0 && products.length === 0
}

export function getNearRealtimeTimestamp() {
  return addMilliseconds(new Date(), 0)
}
