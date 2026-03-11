import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type SupplierRecord = {
  name: string
  number: string
  company: string
  phone: string
  note: string
}

type ProductSupplierRow = {
  id: string
  sku: string | null
  suppliers: string | null
  deletedAt: string | null
  isStock: number | boolean | null
  stockCount: number | null
}

type SupplierPayload = {
  name: string
  number: string
  company: string
  phone: string
  note: string
}

async function ensureSupplierColumns() {
  const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("Product")`)
  const hasSku = columns.some((column) => column.name === "sku")
  const hasDeletedAt = columns.some((column) => column.name === "deletedAt")
  const hasSuppliers = columns.some((column) => column.name === "suppliers")

  if (!hasSku) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN "sku" TEXT`)
  }
  if (!hasDeletedAt) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN "deletedAt" DATETIME`)
  }
  if (!hasSuppliers) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN "suppliers" TEXT`)
  }
}

function normalizeSuppliers(input: unknown): SupplierRecord[] {
  if (!Array.isArray(input)) return []
  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null
      const name = typeof (item as { name?: unknown }).name === "string" ? (item as { name: string }).name.trim() : ""
      const supplier = {
        name,
        number: typeof (item as { number?: unknown }).number === "string" ? (item as { number: string }).number.trim().toUpperCase() : "",
        company: typeof (item as { company?: unknown }).company === "string" ? (item as { company: string }).company.trim() : "",
        phone: typeof (item as { phone?: unknown }).phone === "string" ? (item as { phone: string }).phone.trim() : "",
        note: typeof (item as { note?: unknown }).note === "string" ? (item as { note: string }).note.trim() : "",
      }
      if (!supplier.name && !supplier.company && !supplier.number) return null
      return supplier
    })
    .filter((value): value is SupplierRecord => Boolean(value))
}

function normalizeSupplierPayload(input: unknown): SupplierPayload | null {
  if (!input || typeof input !== "object") return null
  const supplier = {
    name: typeof (input as { name?: unknown }).name === "string" ? (input as { name: string }).name.trim() : "",
    number: typeof (input as { number?: unknown }).number === "string" ? (input as { number: string }).number.trim().toUpperCase() : "",
    company: typeof (input as { company?: unknown }).company === "string" ? (input as { company: string }).company.trim() : "",
    phone: typeof (input as { phone?: unknown }).phone === "string" ? (input as { phone: string }).phone.trim() : "",
    note: typeof (input as { note?: unknown }).note === "string" ? (input as { note: string }).note.trim() : "",
  }
  if (!supplier.name && !supplier.company && !supplier.number) return null
  return supplier
}

function isSameSupplier(left: SupplierPayload, right: SupplierPayload) {
  return (
    left.name === right.name &&
    left.number === right.number &&
    left.company === right.company &&
    left.phone === right.phone &&
    left.note === right.note
  )
}

export async function GET() {
  try {
    await ensureSupplierColumns()
    const rows = await prisma.$queryRawUnsafe<ProductSupplierRow[]>(
      `SELECT "id", "sku", "suppliers", "deletedAt", "isStock", "stockCount" FROM "Product"`
    )

    const activeRows = rows.filter((row) => !row.deletedAt)
    const supplierMap = new Map<string, SupplierRecord>()
    const parsedSuppliersByProduct = new Map<string, SupplierRecord[]>()

    for (const row of activeRows) {
      if (!row.suppliers) continue
      try {
        const parsed = normalizeSuppliers(JSON.parse(row.suppliers))
        parsedSuppliersByProduct.set(row.id, parsed)
        for (const supplier of parsed) {
          const key = [
            supplier.name,
            supplier.number,
            supplier.company,
            supplier.phone,
            supplier.note,
          ].join("||")
          if (!supplierMap.has(key)) {
            supplierMap.set(key, supplier)
          }
        }
      } catch {
        continue
      }
    }

    const suppliers = Array.from(supplierMap.values())
      .map((supplier) => {
        const linkedRows = activeRows.filter((row) => {
          const productSuppliers = parsedSuppliersByProduct.get(row.id) || []
          return productSuppliers.some((productSupplier) => {
            if (supplier.number && productSupplier.number) {
              return productSupplier.number === supplier.number
            }
            if (supplier.company && productSupplier.company) {
              return productSupplier.company.toUpperCase() === supplier.company.toUpperCase()
            }
            if (supplier.name && productSupplier.name) {
              return productSupplier.name.toUpperCase() === supplier.name.toUpperCase()
            }
            return false
          })
        })

        const quantity = linkedRows.filter((row) => {
          const stockCount = Number(row.stockCount ?? 0)
          return stockCount > 0
        }).length

        const soldOut = linkedRows.filter((row) => {
          const stockCount = Number(row.stockCount ?? 0)
          return stockCount <= 0
        }).length

        return {
          ...supplier,
          quantity,
          soldOut,
        }
      })
      .sort((left, right) => (left.company || left.name || left.number).localeCompare((right.company || right.name || right.number), "tr"))

    return NextResponse.json({ suppliers })
  } catch (error) {
    console.error("GET /api/admin/suppliers error:", error)
    return NextResponse.json({ error: "Failed to load suppliers" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    await ensureSupplierColumns()
    const body = await req.json().catch(() => ({}))
    const original = normalizeSupplierPayload(body?.original)
    const updated = normalizeSupplierPayload(body?.updated)

    if (!original || !updated) {
      return NextResponse.json({ error: "Invalid supplier payload" }, { status: 400 })
    }

    const rows = await prisma.$queryRawUnsafe<ProductSupplierRow[]>(
      `SELECT "id", "suppliers", "deletedAt" FROM "Product"`
    )

    const activeRows = rows.filter((row) => !row.deletedAt)
    let updatedProducts = 0

    for (const row of activeRows) {
      if (!row.suppliers) continue
      let changed = false
      let parsed: SupplierRecord[] = []
      try {
        parsed = normalizeSuppliers(JSON.parse(row.suppliers))
      } catch {
        continue
      }

      const nextSuppliers = parsed.map((supplier) => {
        if (isSameSupplier(supplier, original)) {
          changed = true
          return updated
        }
        return supplier
      })

      if (!changed) continue

      await prisma.$executeRawUnsafe(
        `UPDATE "Product" SET "suppliers" = ? WHERE "id" = ?`,
        JSON.stringify(nextSuppliers),
        row.id
      )
      updatedProducts += 1
    }

    return NextResponse.json({ success: true, updatedProducts })
  } catch (error) {
    console.error("PATCH /api/admin/suppliers error:", error)
    return NextResponse.json({ error: "Failed to update supplier" }, { status: 500 })
  }
}
