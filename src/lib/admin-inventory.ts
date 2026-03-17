import { promises as fs } from "node:fs"
import path from "node:path"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { ensureTableColumns } from "@/lib/db-compat"
import { parseProductImageRecords } from "@/lib/product-images"
import { isManagedUploadUrl } from "@/lib/storage/url"

type SupplierRecord = {
  name?: string
  number?: string
  company?: string
  phone?: string
  note?: string
}

type ProductManagementRow = {
  id: string
  location: string | null
  purchasePrice: number | string | null
  businessStatus: string | null
  holdUntil: Date | string | null
  rugHistory: string | null
  shortDescription: string | null
}

type SoldAggregateRow = {
  productId: string
  quantitySold: number | bigint | null
  revenue: number | string | null
  soldAt: Date | string | null
  finalSalePrice: number | string | null
  customerCountry: string | null
}

type InventoryStatus = "ALL" | "AVAILABLE" | "RESERVED" | "SOLD" | "RETURNED"

type PhotoCompleteness = {
  featuredImagePresent: boolean
  galleryImageCount: number
  recommendedMinimumMet: boolean
  status: "missing" | "partial" | "complete"
}

type SeoCompleteness = {
  seoTitlePresent: boolean
  seoDescriptionPresent: boolean
  titleLengthStatus: "missing" | "too_short" | "ok" | "too_long"
  descriptionLengthStatus: "missing" | "too_short" | "ok" | "too_long"
  status: "missing" | "partial" | "complete"
}

type InventoryCustomAttribute = {
  name: string
  values: string[]
  visible: boolean
}

export type InventoryProductRow = {
  id: string
  slug: string
  sku: string | null
  title: string
  description: string | null
  category: string
  price: number
  purchasePrice: number | null
  profit: number | null
  marginPercent: number | null
  stockCount: number
  isPublished: boolean
  isFeatured: boolean
  supplier: string
  supplierValues: string[]
  imagesCount: number
  imageUrls: string[]
  shortDescription: string | null
  location: string | null
  colorLabels: string[]
  typeLabels: string[]
  sizeLabels: string[]
  materialLabels: string[]
  ageLabels: string[]
  customAttributes: InventoryCustomAttribute[]
  businessStatus: InventoryStatus | Exclude<InventoryStatus, "ALL">
  rawBusinessStatus: string | null
  holdUntil: string | null
  daysInStock: number | null
  photoCompleteness: PhotoCompleteness
  seoCompleteness: SeoCompleteness
  isSold: boolean
  soldDate: Date | null
  soldRevenue: number | null
  soldQuantity: number
  finalSalePrice: number | null
  customerCountry: string | null
  adminName: string | null
  createdAt: Date
  updatedAt: Date
}

export type SoldInventoryRow = {
  id: string
  slug: string
  title: string
  sku: string | null
  supplier: string
  soldDate: Date | null
  finalSalePrice: number | null
  customerCountry: string | null
  adminName: string | null
  quantitySold: number
  revenue: number | null
}

export type InventoryStats = {
  totalProducts: number
  totalStock: number
  outOfStock: number
  reserved: number
  sold: number
  averageDaysInStock: number | null
  productsMissingImages: number
  productsMissingSeo: number
}

export type SupplierPerformanceRow = {
  supplier: string
  totalRugs: number
  soldRugs: number
  revenue: number | null
}

function parseSuppliers(raw: string | null | undefined): SupplierRecord[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is SupplierRecord => Boolean(item && typeof item === "object"))
  } catch {
    return []
  }
}

function normalizeSupplierLabel(record: SupplierRecord) {
  return [record.company, record.name, record.number]
    .map((value) => String(value || "").trim())
    .find(Boolean) || ""
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b))
}

function parseNumericValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function resolveManagedUploadPath(urlOrPath: string) {
  const value = String(urlOrPath || "").trim()
  if (!isManagedUploadUrl(value)) return null

  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      const parsed = new URL(value)
      if (!parsed.pathname.startsWith("/uploads/")) return null
      return path.join(process.cwd(), "public", parsed.pathname.replace(/^\/+/, ""))
    } catch {
      return null
    }
  }

  const uploadsIndex = value.indexOf("/uploads/")
  if (uploadsIndex < 0) return null
  return path.join(process.cwd(), "public", value.slice(uploadsIndex).replace(/^\/+/, ""))
}

async function filterExistingInventoryImageUrls(imageUrls: string[]) {
  const filtered: string[] = []

  for (const imageUrl of imageUrls) {
    const localPath = resolveManagedUploadPath(imageUrl)
    if (!localPath) {
      filtered.push(imageUrl)
      continue
    }

    try {
      await fs.access(localPath)
      filtered.push(imageUrl)
    } catch {
      // Drop stale managed upload references so read-only inventory falls back cleanly.
    }
  }

  return filtered
}

function parseCustomAttributes(raw: string | null | undefined): InventoryCustomAttribute[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null
        const name = typeof (item as { name?: unknown }).name === "string" ? (item as { name: string }).name.trim() : ""
        const values = Array.isArray((item as { values?: unknown }).values)
          ? (item as { values: unknown[] }).values
              .filter((value): value is string => typeof value === "string")
              .map((value) => value.trim())
              .filter(Boolean)
          : []
        if (!name || values.length === 0) return null
        return {
          name,
          values,
          visible: (item as { visible?: unknown }).visible !== false,
        }
      })
      .filter((item): item is InventoryCustomAttribute => Boolean(item))
  } catch {
    return []
  }
}

function normalizeBusinessStatus(raw: string | null | undefined): Exclude<InventoryStatus, "ALL"> {
  const normalized = String(raw || "").trim().toUpperCase()
  if (normalized === "RESERVED" || normalized === "SOLD" || normalized === "RETURNED") return normalized
  return "AVAILABLE"
}

function normalizeHoldUntil(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 16)
}

function calculateDaysInStock(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const diff = Date.now() - date.getTime()
  return diff >= 0 ? Math.floor(diff / 86_400_000) : 0
}

function calculatePhotoCompleteness(imageUrls: string[]): PhotoCompleteness {
  const featuredImagePresent = Boolean(imageUrls[0])
  const galleryImageCount = Math.max(0, imageUrls.length - (featuredImagePresent ? 1 : 0))
  const recommendedMinimumMet = imageUrls.length >= 3

  if (!featuredImagePresent) {
    return { featuredImagePresent, galleryImageCount, recommendedMinimumMet, status: "missing" }
  }

  return {
    featuredImagePresent,
    galleryImageCount,
    recommendedMinimumMet,
    status: recommendedMinimumMet ? "complete" : "partial",
  }
}

function lengthStatus(value: string | null | undefined, min: number, max: number): SeoCompleteness["titleLengthStatus"] {
  const length = String(value || "").trim().length
  if (length === 0) return "missing"
  if (length < min) return "too_short"
  if (length > max) return "too_long"
  return "ok"
}

function calculateSeoCompleteness(seoTitle: string | null | undefined, seoDescription: string | null | undefined): SeoCompleteness {
  const seoTitlePresent = Boolean(String(seoTitle || "").trim())
  const seoDescriptionPresent = Boolean(String(seoDescription || "").trim())
  const titleLengthStatus = lengthStatus(seoTitle, 50, 60)
  const descriptionLengthStatus = lengthStatus(seoDescription, 150, 160)
  const completedChecks = Number(seoTitlePresent) + Number(seoDescriptionPresent)

  return {
    seoTitlePresent,
    seoDescriptionPresent,
    titleLengthStatus,
    descriptionLengthStatus,
    status: completedChecks === 2 ? "complete" : completedChecks === 1 ? "partial" : "missing",
  }
}

async function ensureInventoryColumns() {
  await ensureTableColumns("Product", [
    { name: "location", postgresType: "TEXT" },
    { name: "purchasePrice", postgresType: "DECIMAL(12,2)" },
    { name: "businessStatus", postgresType: "TEXT NOT NULL DEFAULT 'AVAILABLE'", sqliteType: "TEXT NOT NULL DEFAULT 'AVAILABLE'" },
    { name: "holdUntil", postgresType: "TIMESTAMP(3)", sqliteType: "DATETIME" },
    { name: "rugHistory", postgresType: "TEXT" },
    { name: "shortDescription", postgresType: "TEXT" },
  ])
}

async function getProductManagementRows(productIds: string[]) {
  await ensureInventoryColumns()
  if (productIds.length === 0) return new Map<string, ProductManagementRow>()
  const rows = await prisma.$queryRaw<ProductManagementRow[]>(
    Prisma.sql`
      SELECT "id", "location", "purchasePrice", "businessStatus", "holdUntil", "rugHistory"
           , "shortDescription"
      FROM "Product"
      WHERE "id" IN (${Prisma.join(productIds)})
    `
  )
  return new Map(rows.map((row) => [row.id, row]))
}

async function getSoldAggregates(productIds: string[]) {
  if (productIds.length === 0) return new Map<string, SoldAggregateRow>()

  const rows = await prisma.$queryRaw<SoldAggregateRow[]>(
    Prisma.sql`
      WITH sold_items AS (
        SELECT
          oi."productId" AS "productId",
          oi."quantity" AS "quantity",
          oi."price" AS "price",
          COALESCE(o."deliveredAt", o."updatedAt", o."createdAt") AS "soldAt",
          cp."country" AS "customerCountry",
          ROW_NUMBER() OVER (
            PARTITION BY oi."productId"
            ORDER BY COALESCE(o."deliveredAt", o."updatedAt", o."createdAt") DESC, oi."id" DESC
          ) AS "rowNum"
        FROM "OrderItem" oi
        INNER JOIN "Order" o ON o."id" = oi."orderId"
        LEFT JOIN "CustomerProfile" cp ON cp."userId" = o."userId"
        WHERE oi."productId" IN (${Prisma.join(productIds)})
          AND (
            UPPER(COALESCE(o."status", '')) IN ('PAID', 'FULFILLED', 'COMPLETED', 'DELIVERED')
            OR UPPER(COALESCE(o."shipmentStatus", '')) = 'DELIVERED'
            OR o."deliveredAt" IS NOT NULL
          )
          AND UPPER(COALESCE(o."status", '')) NOT IN ('CANCELLED', 'FAILED', 'REFUNDED', 'TRASH')
      ),
      sold_aggregate AS (
        SELECT
          "productId",
          SUM("quantity")::int AS "quantitySold",
          SUM("price" * "quantity") AS "revenue",
          MAX("soldAt") AS "soldAt"
        FROM sold_items
        GROUP BY "productId"
      )
      SELECT
        agg."productId" AS "productId",
        agg."quantitySold" AS "quantitySold",
        agg."revenue" AS "revenue",
        agg."soldAt" AS "soldAt",
        item."price" AS "finalSalePrice",
        item."customerCountry" AS "customerCountry"
      FROM sold_aggregate agg
      LEFT JOIN sold_items item
        ON item."productId" = agg."productId"
       AND item."rowNum" = 1
    `
  )

  return new Map(rows.map((row) => [row.productId, row]))
}

function calculateMargin(price: number, purchasePrice: number | null) {
  if (purchasePrice === null || purchasePrice === undefined) {
    return { profit: null, marginPercent: null }
  }
  const profit = price - purchasePrice
  const marginPercent = purchasePrice > 0 ? (profit / purchasePrice) * 100 : null
  return {
    profit,
    marginPercent: marginPercent !== null && Number.isFinite(marginPercent) ? marginPercent : null,
  }
}

function toDate(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function calculateInventoryStats(rows: InventoryProductRow[]): InventoryStats {
  const days = rows.map((row) => row.daysInStock).filter((value): value is number => value !== null)
  const averageDaysInStock = days.length > 0
    ? Math.round(days.reduce((sum, value) => sum + value, 0) / days.length)
    : null

  return {
    totalProducts: rows.length,
    totalStock: rows.reduce((sum, row) => sum + Math.max(0, row.stockCount), 0),
    outOfStock: rows.filter((row) => row.stockCount <= 0).length,
    reserved: rows.filter((row) => row.businessStatus === "RESERVED").length,
    sold: rows.filter((row) => row.isSold).length,
    averageDaysInStock,
    productsMissingImages: rows.filter((row) => row.photoCompleteness.status !== "complete").length,
    productsMissingSeo: rows.filter((row) => row.seoCompleteness.status !== "complete").length,
  }
}

function calculateSupplierPerformance(rows: InventoryProductRow[]): SupplierPerformanceRow[] {
  const map = new Map<string, SupplierPerformanceRow>()

  for (const row of rows) {
    if (!row.supplier) continue
    const existing = map.get(row.supplier) || {
      supplier: row.supplier,
      totalRugs: 0,
      soldRugs: 0,
      revenue: 0,
    }
    existing.totalRugs += 1
    if (row.isSold) {
      existing.soldRugs += 1
      existing.revenue = (existing.revenue || 0) + (row.soldRevenue || 0)
    }
    map.set(row.supplier, existing)
  }

  return Array.from(map.values())
    .sort((a, b) => {
      if ((b.revenue || 0) !== (a.revenue || 0)) return (b.revenue || 0) - (a.revenue || 0)
      return b.totalRugs - a.totalRugs
    })
}

function buildSoldArchiveRows(rows: InventoryProductRow[]): SoldInventoryRow[] {
  return rows
    .filter((row) => row.isSold)
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      sku: row.sku,
      supplier: row.supplier,
      soldDate: row.soldDate,
      finalSalePrice: row.finalSalePrice,
      customerCountry: row.customerCountry,
      adminName: row.adminName,
      quantitySold: row.soldQuantity,
      revenue: row.soldRevenue,
    }))
    .sort((a, b) => {
      const aTime = a.soldDate?.getTime() || 0
      const bTime = b.soldDate?.getTime() || 0
      return bTime - aTime
    })
}

export async function getInventoryProducts(options?: {
  supplier?: string | null
  status?: string | null
  includeSoldData?: boolean
  productIds?: string[] | null
}) {
  const supplierFilter = String(options?.supplier || "").trim().toLowerCase()
  const statusFilter = String(options?.status || "ALL").trim().toUpperCase() as InventoryStatus
  const includeSoldData = options?.includeSoldData !== false
  const productIdsFilter = Array.from(new Set((options?.productIds || []).map((id) => String(id || "").trim()).filter(Boolean)))

  const products = await prisma.product.findMany({
    where: {
      deletedAt: null,
      ...(productIdsFilter.length > 0 ? { id: { in: productIdsFilter } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      slug: true,
      sku: true,
      title: true,
      description: true,
      price: true,
      stockCount: true,
      isPublished: true,
      isFeatured: true,
      suppliers: true,
      images: true,
      customAttributes: true,
      createdAt: true,
      updatedAt: true,
      seoTitle: true,
      seoDescription: true,
      createdByName: true,
      colors: {
        select: {
          name: true,
        },
      },
      sizes: {
        select: {
          name: true,
        },
      },
      materials: {
        select: {
          name: true,
        },
      },
      ages: {
        select: {
          name: true,
        },
      },
      categories: {
        select: {
          title: true,
        },
      },
      types: {
        select: {
          name: true,
        },
      },
    },
  })

  const productIds = products.map((product) => product.id)
  const managementRows = await getProductManagementRows(productIds)
  const soldAggregates = includeSoldData ? await getSoldAggregates(productIds) : new Map<string, SoldAggregateRow>()

  const baseRows = await Promise.all(products.map(async (product): Promise<InventoryProductRow> => {
    const supplierValues = uniqueSorted(
      parseSuppliers(product.suppliers).map((item) => normalizeSupplierLabel(item)).filter(Boolean)
    )
    const imageUrls = await filterExistingInventoryImageUrls(
      parseProductImageRecords(product.images)
      .map((item) => item.image_url)
      .filter(Boolean)
    )
    const management = managementRows.get(product.id)
    const rawBusinessStatus = management?.businessStatus || null
    const businessStatus = normalizeBusinessStatus(rawBusinessStatus)
    const photoCompleteness = calculatePhotoCompleteness(imageUrls)
    const seoCompleteness = calculateSeoCompleteness(product.seoTitle, product.seoDescription)
    const purchasePrice = parseNumericValue(management?.purchasePrice)
    const margin = calculateMargin(product.price.toNumber(), purchasePrice)
    const soldAggregate = soldAggregates.get(product.id)
    const hasLegacySoldSignal = !rawBusinessStatus && product.stockCount <= 0 && Boolean(soldAggregate)
    const isSold = businessStatus === "SOLD" || hasLegacySoldSignal
    const customAttributes = parseCustomAttributes(product.customAttributes)

    return {
      id: product.id,
      slug: product.slug,
      sku: product.sku,
      title: product.title,
      description: product.description || null,
      category: product.categories.map((item) => item.title).filter(Boolean).join(", "),
      price: product.price.toNumber(),
      purchasePrice,
      profit: margin.profit,
      marginPercent: margin.marginPercent,
      stockCount: product.stockCount,
      isPublished: product.isPublished,
      isFeatured: product.isFeatured,
      supplier: supplierValues[0] || "",
      supplierValues,
      imagesCount: imageUrls.length,
      imageUrls,
      shortDescription: management?.shortDescription || null,
      location: management?.location?.trim() || null,
      colorLabels: product.colors.map((item) => item.name).filter(Boolean),
      typeLabels: product.types.map((item) => item.name).filter(Boolean),
      sizeLabels: product.sizes.map((item) => item.name).filter(Boolean),
      materialLabels: product.materials.map((item) => item.name).filter(Boolean),
      ageLabels: product.ages.map((item) => item.name).filter(Boolean),
      customAttributes,
      businessStatus,
      rawBusinessStatus,
      holdUntil: normalizeHoldUntil(management?.holdUntil),
      daysInStock: calculateDaysInStock(product.createdAt),
      photoCompleteness,
      seoCompleteness,
      isSold,
      soldDate: toDate(soldAggregate?.soldAt),
      soldRevenue: parseNumericValue(soldAggregate?.revenue),
      soldQuantity: Number(soldAggregate?.quantitySold || 0),
      finalSalePrice: parseNumericValue(soldAggregate?.finalSalePrice),
      customerCountry: soldAggregate?.customerCountry || null,
      adminName: product.createdByName || null,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    }
  }))

  const filteredRows = baseRows.filter((row) => {
    if (supplierFilter && !row.supplierValues.some((value) => value.toLowerCase() === supplierFilter)) {
      return false
    }
    if (statusFilter !== "ALL" && row.businessStatus !== statusFilter) {
      return false
    }
    return true
  })

  return {
    rows: filteredRows,
    soldRows: buildSoldArchiveRows(filteredRows),
    stats: calculateInventoryStats(filteredRows),
    supplierOptions: uniqueSorted(
      baseRows.flatMap((row) => row.supplierValues)
    ),
    supplierPerformance: calculateSupplierPerformance(filteredRows),
  }
}

export async function getInventoryProductBySlug(
  slug: string,
  options?: {
    includeSoldData?: boolean
  }
) {
  const normalizedSlug = String(slug || "").trim()
  if (!normalizedSlug) return null

  const inventory = await getInventoryProducts({
    status: "ALL",
    includeSoldData: options?.includeSoldData !== false,
  })

  return inventory.rows.find((row) => row.slug === normalizedSlug) || null
}
