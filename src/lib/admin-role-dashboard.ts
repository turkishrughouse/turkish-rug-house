import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { hasTableColumn } from "@/lib/db-compat"

export const DASHBOARD_PERIOD_KEYS = ["week", "month", "year"] as const

export type DashboardPeriodKey = (typeof DASHBOARD_PERIOD_KEYS)[number]

type DashboardViewer = {
  id: string
  email: string
  name: string | null
  role: string
}

type ProductRow = {
  id: string
  title: string
  slug: string
  sku: string | null
  createdAt: Date
  createdById: string | null
  createdByName: string | null
}

type OrderRow = {
  id: string
  status: string
  createdAt: Date
  items: Array<{
    productId: string | null
    title: string
    quantity: number
    price: number
  }>
}

export type DashboardProductSalesRow = {
  productId: string
  title: string
  slug: string
  sku: string | null
  unitsSold: number
  revenue: number
  lastSoldAt: string | null
}

export type DashboardCreatedProductRow = {
  id: string
  title: string
  slug: string
  sku: string | null
  createdAt: string
}

export type DashboardCreatorBreakdownRow = {
  creatorKey: string
  creatorLabel: string
  productCount: number
  unitsSold: number
  revenue: number
}

export type DashboardPeriodStats = {
  key: DashboardPeriodKey
  label: string
  rangeLabel: string
  productCount: number
  unitsSold: number
  revenue: number
  createdProducts: DashboardCreatedProductRow[]
  salesByProduct: DashboardProductSalesRow[]
  creatorBreakdown: DashboardCreatorBreakdownRow[]
}

export type RoleDashboardData = {
  scope: "own" | "system"
  actorLabel: string
  role: string
  totalCatalogProducts: number
  periods: Record<DashboardPeriodKey, DashboardPeriodStats>
}

const VALID_SALES_STATUSES = new Set(["PAID", "PROCESSING", "FULFILLED", "SHIPPED", "DELIVERED", "COMPLETED"])

function normalizeUserName(value: string | null | undefined) {
  return (value || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ")
}

function normalizeCreatorLabel(product: Pick<ProductRow, "createdById" | "createdByName">) {
  return product.createdByName?.trim() || product.createdById || "Unknown"
}

function matchesViewerProduct(product: Pick<ProductRow, "createdById" | "createdByName">, viewer: DashboardViewer) {
  if (product.createdById && product.createdById === viewer.id) return true

  const rowName = normalizeUserName(product.createdByName)
  if (!rowName) return false

  const aliases = new Set<string>()
  const name = normalizeUserName(viewer.name)
  const email = normalizeUserName(viewer.email)
  const emailLocalPart = normalizeUserName(viewer.email.split("@")[0] || "")

  if (name) aliases.add(name)
  if (email) aliases.add(email)
  if (emailLocalPart) aliases.add(emailLocalPart)

  return aliases.has(rowName)
}

function getPeriodLabel(period: DashboardPeriodKey) {
  if (period === "week") return "Weekly"
  if (period === "year") return "Yearly"
  return "Monthly"
}

function getPeriodStart(now: Date, period: DashboardPeriodKey) {
  if (period === "year") return new Date(now.getFullYear(), 0, 1)
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1)
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  start.setDate(start.getDate() - 6)
  return start
}

function formatRangeLabel(start: Date, end: Date) {
  const format = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  return `${format.format(start)} - ${format.format(end)}`
}

function toNumber(value: unknown) {
  const result = Number(value)
  return Number.isFinite(result) ? result : 0
}

function isValidSalesOrder(status: string) {
  return VALID_SALES_STATUSES.has(String(status || "").toUpperCase())
}

async function loadDashboardRows(): Promise<{ products: ProductRow[]; orders: OrderRow[] }> {
  const hasDeletedAt = await hasTableColumn("Product", "deletedAt")
  const productQuery = hasDeletedAt
    ? Prisma.sql`
        SELECT "id", "title", "slug", "sku", "createdAt", "createdById", "createdByName"
        FROM "Product"
        WHERE "deletedAt" IS NULL
        ORDER BY "createdAt" DESC
      `
    : Prisma.sql`
        SELECT "id", "title", "slug", "sku", "createdAt", "createdById", "createdByName"
        FROM "Product"
        ORDER BY "createdAt" DESC
      `
  const [products, orders] = await Promise.all([
    prisma.$queryRaw<Array<{
      id: string
      title: string
      slug: string
      sku: string | null
      createdAt: Date | string
      createdById: string | null
      createdByName: string | null
    }>>(productQuery),
    prisma.order.findMany({
      where: {
        status: {
          notIn: ["CANCELLED", "TRASHED", "FAILED", "PENDING", "REFUNDED"],
        },
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        items: {
          select: {
            productId: true,
            title: true,
            quantity: true,
            price: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ])

  return {
    products: products.map((product) => ({
      ...product,
      createdAt: product.createdAt instanceof Date ? product.createdAt : new Date(product.createdAt),
    })),
    orders: orders.map((order) => ({
      ...order,
      items: order.items.map((item) => ({
        ...item,
        quantity: toNumber(item.quantity),
        price: toNumber(item.price),
      })),
    })),
  }
}

export async function getRoleDashboardData(viewer: DashboardViewer): Promise<RoleDashboardData> {
  const now = new Date()
  const isSuperUser = viewer.role === "SUPER_USER"
  const { products, orders } = await loadDashboardRows()
  const productById = new Map(products.map((product) => [product.id, product]))
  const scopedProducts = isSuperUser ? products : products.filter((product) => matchesViewerProduct(product, viewer))
  const scopedProductIds = new Set(scopedProducts.map((product) => product.id))

  const periods = Object.fromEntries(
    DASHBOARD_PERIOD_KEYS.map((period) => {
      const start = getPeriodStart(now, period)
      const createdProducts = scopedProducts
        .filter((product) => product.createdAt >= start)
        .map<DashboardCreatedProductRow>((product) => ({
          id: product.id,
          title: product.title,
          slug: product.slug,
          sku: product.sku,
          createdAt: product.createdAt.toISOString(),
        }))

      const salesByProduct = new Map<string, DashboardProductSalesRow>()
      const creatorBreakdown = new Map<string, DashboardCreatorBreakdownRow>()
      let unitsSold = 0
      let revenue = 0

      orders.forEach((order) => {
        if (!isValidSalesOrder(order.status) || order.createdAt < start) return

        order.items.forEach((item) => {
          if (!item.productId) return
          const product = productById.get(item.productId)
          if (!product) return
          if (!isSuperUser && !scopedProductIds.has(item.productId)) return

          const itemRevenue = Number((item.quantity * item.price).toFixed(2))
          unitsSold += item.quantity
          revenue += itemRevenue

          const existingProductRow = salesByProduct.get(item.productId) || {
            productId: item.productId,
            title: product.title,
            slug: product.slug,
            sku: product.sku,
            unitsSold: 0,
            revenue: 0,
            lastSoldAt: null,
          }
          existingProductRow.unitsSold += item.quantity
          existingProductRow.revenue = Number((existingProductRow.revenue + itemRevenue).toFixed(2))
          existingProductRow.lastSoldAt = order.createdAt.toISOString()
          salesByProduct.set(item.productId, existingProductRow)

          const creatorKey = product.createdById || normalizeUserName(product.createdByName) || "unknown"
          const existingCreatorRow = creatorBreakdown.get(creatorKey) || {
            creatorKey,
            creatorLabel: normalizeCreatorLabel(product),
            productCount: 0,
            unitsSold: 0,
            revenue: 0,
          }
          existingCreatorRow.unitsSold += item.quantity
          existingCreatorRow.revenue = Number((existingCreatorRow.revenue + itemRevenue).toFixed(2))
          creatorBreakdown.set(creatorKey, existingCreatorRow)
        })
      })

      createdProducts.forEach((product) => {
        const productMeta = productById.get(product.id)
        if (!productMeta) return
        const creatorKey = productMeta.createdById || normalizeUserName(productMeta.createdByName) || "unknown"
        const existingCreatorRow = creatorBreakdown.get(creatorKey) || {
          creatorKey,
          creatorLabel: normalizeCreatorLabel(productMeta),
          productCount: 0,
          unitsSold: 0,
          revenue: 0,
        }
        existingCreatorRow.productCount += 1
        creatorBreakdown.set(creatorKey, existingCreatorRow)
      })

      const orderedSalesRows = Array.from(salesByProduct.values()).sort(
        (a, b) => b.revenue - a.revenue || b.unitsSold - a.unitsSold || a.title.localeCompare(b.title)
      )
      const orderedCreatorRows = Array.from(creatorBreakdown.values()).sort(
        (a, b) => b.revenue - a.revenue || b.unitsSold - a.unitsSold || b.productCount - a.productCount
      )

      return [
        period,
        {
          key: period,
          label: getPeriodLabel(period),
          rangeLabel: formatRangeLabel(start, now),
          productCount: createdProducts.length,
          unitsSold,
          revenue: Number(revenue.toFixed(2)),
          createdProducts: createdProducts.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
          salesByProduct: orderedSalesRows,
          creatorBreakdown: orderedCreatorRows,
        } satisfies DashboardPeriodStats,
      ]
    })
  ) as Record<DashboardPeriodKey, DashboardPeriodStats>

  return {
    scope: isSuperUser ? "system" : "own",
    actorLabel: viewer.name?.trim() || viewer.email,
    role: viewer.role,
    totalCatalogProducts: scopedProducts.length,
    periods,
  }
}
