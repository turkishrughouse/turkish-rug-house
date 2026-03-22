import { prisma } from "@/lib/db"
import { addColumnIfMissing } from "@/lib/db-compat"
import {
  matchSupplierBySkuPrefix,
  normalizeSku,
  normalizeSuppliers,
  type SupplierRecord,
} from "@/lib/supplier-prefix"

const SUPPLIER_REGISTRY_KEY = "admin_supplier_registry"

type SupplierRegistryConfig = {
  suppliers?: SupplierRecord[]
}

type ProductSupplierRow = {
  id: string
  sku: string | null
  suppliers: string | null
  deletedAt: string | null
  stockCount: number | null
}

async function ensureSupplierColumns() {
  await addColumnIfMissing(prisma, "Product", "sku", "TEXT")
  await addColumnIfMissing(prisma, "Product", "deletedAt", "TIMESTAMP(3)")
  await addColumnIfMissing(prisma, "Product", "suppliers", "TEXT")
}

function buildSupplierPayload(supplier: SupplierRecord | null) {
  return supplier ? JSON.stringify([supplier]) : null
}

export async function getStoredSupplierRegistry(): Promise<SupplierRecord[]> {
  const row = await prisma.designSettings.findUnique({
    where: { key: SUPPLIER_REGISTRY_KEY },
    select: { config: true },
  })

  if (!row?.config) return []

  try {
    const parsed = JSON.parse(row.config) as SupplierRegistryConfig | SupplierRecord[]
    if (Array.isArray(parsed)) {
      return normalizeSuppliers(parsed)
    }
    return normalizeSuppliers(parsed?.suppliers || [])
  } catch {
    return []
  }
}

export async function saveSupplierRegistry(input: SupplierRecord[]) {
  const suppliers = normalizeSuppliers(input)
  await prisma.designSettings.upsert({
    where: { key: SUPPLIER_REGISTRY_KEY },
    update: { config: JSON.stringify({ suppliers }) },
    create: { key: SUPPLIER_REGISTRY_KEY, config: JSON.stringify({ suppliers }) },
  })
  return suppliers
}

export async function getLegacySuppliersFromProducts() {
  await ensureSupplierColumns()
  const rows = await prisma.$queryRawUnsafe<Array<{ suppliers: string | null; deletedAt: string | null }>>(
    `SELECT "suppliers", "deletedAt" FROM "Product"`
  )

  const collected: SupplierRecord[] = []
  for (const row of rows) {
    if (row.deletedAt || !row.suppliers) continue
    try {
      collected.push(...normalizeSuppliers(JSON.parse(row.suppliers)))
    } catch {
      continue
    }
  }

  return normalizeSuppliers(collected)
}

export async function ensureSupplierRegistrySeeded() {
  const stored = await getStoredSupplierRegistry()
  if (stored.length > 0) {
    return { suppliers: stored, hydratedFromLegacy: false }
  }

  const legacy = await getLegacySuppliersFromProducts()
  if (legacy.length === 0) {
    return { suppliers: [], hydratedFromLegacy: false }
  }

  const saved = await saveSupplierRegistry(legacy)
  return { suppliers: saved, hydratedFromLegacy: true }
}

export async function syncProductSupplierBySku(productId: string, sku: string | null | undefined, registry?: SupplierRecord[]) {
  await ensureSupplierColumns()
  const suppliers = registry ? normalizeSuppliers(registry) : (await ensureSupplierRegistrySeeded()).suppliers
  const matchedSupplier = matchSupplierBySkuPrefix(sku, suppliers)
  await prisma.$executeRaw`UPDATE "Product" SET "suppliers" = ${buildSupplierPayload(matchedSupplier)} WHERE "id" = ${productId}`
  return matchedSupplier ? [matchedSupplier] : []
}

export async function syncAllProductSuppliersFromRegistry(registry?: SupplierRecord[]) {
  await ensureSupplierColumns()
  const suppliers = registry ? normalizeSuppliers(registry) : (await ensureSupplierRegistrySeeded()).suppliers
  const rows = await prisma.$queryRawUnsafe<ProductSupplierRow[]>(
    `SELECT "id", "sku", "suppliers", "deletedAt", "stockCount" FROM "Product"`
  )

  let updatedProducts = 0
  for (const row of rows) {
    if (row.deletedAt) continue
    const matchedSupplier = matchSupplierBySkuPrefix(row.sku, suppliers)
    const nextPayload = buildSupplierPayload(matchedSupplier)
    const currentPayload = row.suppliers || null
    if (currentPayload === nextPayload) continue
    await prisma.$executeRaw`UPDATE "Product" SET "suppliers" = ${nextPayload} WHERE "id" = ${row.id}`
    updatedProducts += 1
  }

  return { updatedProducts, suppliers }
}

export async function getSupplierSummaries() {
  await ensureSupplierColumns()
  const { suppliers, hydratedFromLegacy } = await ensureSupplierRegistrySeeded()
  if (hydratedFromLegacy) {
    await syncAllProductSuppliersFromRegistry(suppliers)
  }

  const rows = await prisma.$queryRawUnsafe<Array<{ sku: string | null; deletedAt: string | null; stockCount: number | null }>>(
    `SELECT "sku", "deletedAt", "stockCount" FROM "Product"`
  )
  const activeRows = rows.filter((row) => !row.deletedAt)

  return suppliers.map((supplier) => {
    const linkedRows = supplier.number
      ? activeRows.filter((row) => normalizeSku(row.sku).startsWith(supplier.number))
      : []

    const quantity = linkedRows.filter((row) => Number(row.stockCount ?? 0) > 0).length
    const soldOut = linkedRows.filter((row) => Number(row.stockCount ?? 0) <= 0).length

    return {
      ...supplier,
      quantity,
      soldOut,
    }
  })
}
