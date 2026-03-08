import { revalidatePath } from "next/cache"
import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { getSessionUser } from "@/lib/auth"
import { isAdminRole } from "@/lib/rbac"
import { normalizeProductImageRecords } from "@/lib/product-images"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function parseCsv(content: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let inQuotes = false

  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i]
    const next = content[i + 1]

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (!inQuotes && ch === ",") {
      row.push(cell)
      cell = ""
      continue
    }

    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i += 1
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
      continue
    }

    cell += ch
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  return rows.filter((r) => r.some((item) => item.trim().length > 0))
}

function parseBoolean(input: string | undefined, fallback = false) {
  const value = (input || "").trim().toLowerCase()
  if (!value) return fallback
  return ["1", "true", "yes", "y"].includes(value)
}

function parseNumber(input: string | undefined, fallback = 0) {
  const parsed = Number((input || "").trim())
  if (Number.isFinite(parsed)) return parsed
  return fallback
}

function slugifyText(input: string) {
  const normalized = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return normalized || "product"
}

async function ensureSkuAndFeaturedColumns() {
  const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("Product")`)
  const hasSku = columns.some((column) => column.name === "sku")
  const hasFeatured = columns.some((column) => column.name === "isFeatured")
  const hasDeletedAt = columns.some((column) => column.name === "deletedAt")

  if (!hasSku) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN "sku" TEXT`)
  }
  if (!hasFeatured) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT 0`)
  }
  if (!hasDeletedAt) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN "deletedAt" DATETIME`)
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser("admin")
  if (!user || !isAdminRole(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await ensureSkuAndFeaturedColumns()

  const formData = await req.formData()
  const file = formData.get("file")

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "CSV file is required" }, { status: 400 })
  }

  const content = await file.text()
  const rows = parseCsv(content)
  if (rows.length < 2) {
    return NextResponse.json({ error: "CSV file is empty" }, { status: 400 })
  }

  const headers = rows[0].map((item) => item.trim().replace(/^\uFEFF/, ""))
  const headerIndex = new Map(headers.map((key, idx) => [key, idx]))
  const getValue = (row: string[], key: string) => row[headerIndex.get(key) ?? -1] ?? ""

  const requiredHeaders = ["title"]
  const missingHeaders = requiredHeaders.filter((key) => !headerIndex.has(key))
  if (missingHeaders.length > 0) {
    return NextResponse.json(
      { error: `Missing required CSV columns: ${missingHeaders.join(", ")}` },
      { status: 400 }
    )
  }

  let created = 0
  let updated = 0
  let skipped = 0
  const errors: string[] = []

  for (let line = 1; line < rows.length; line += 1) {
    const row = rows[line]
    const title = getValue(row, "title").trim()
    if (!title) {
      skipped += 1
      errors.push(`Line ${line + 1}: title is required`)
      continue
    }

    const slugInput = getValue(row, "slug").trim()
    const slug = slugifyText(slugInput || title)
    const description = getValue(row, "description").trim() || null
    const sku = getValue(row, "sku").trim() || null
    const categoryRaw = getValue(row, "categorySlugs").trim()
    const imagesRaw = getValue(row, "imageUrls").trim() || getValue(row, "images").trim()

    const price = parseNumber(getValue(row, "price"), 0)
    const compareAtPriceRaw = getValue(row, "compareAtPrice").trim()
    const compareAtPrice = compareAtPriceRaw ? parseNumber(compareAtPriceRaw, 0) : null
    const isStock = parseBoolean(getValue(row, "isStock"), true)
    const stockCount = Math.max(0, Math.floor(parseNumber(getValue(row, "stockCount"), 0)))
    const isPublished = parseBoolean(getValue(row, "isPublished"), false)
    const isFeatured = parseBoolean(getValue(row, "isFeatured"), false)

    let imageUrls: string[] = []
    if (imagesRaw) {
      if (imagesRaw.startsWith("[") && imagesRaw.endsWith("]")) {
        try {
          const parsed = JSON.parse(imagesRaw)
          if (Array.isArray(parsed)) {
            imageUrls = parsed.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
          }
        } catch {
          imageUrls = []
        }
      } else {
        imageUrls = imagesRaw
          .split("|")
          .map((item) => item.trim())
          .filter(Boolean)
      }
    }

    const categorySlugs = categoryRaw
      ? categoryRaw
        .split(/[|,;]/)
        .map((item) => slugifyText(item))
        .filter(Boolean)
      : []

    try {
      const categoryRows = categorySlugs.length > 0
        ? await prisma.category.findMany({
          where: { slug: { in: Array.from(new Set(categorySlugs)) } },
          select: { id: true },
        })
        : []

      const existing = await prisma.product.findUnique({ where: { slug }, select: { id: true } })
      const data: Prisma.ProductUncheckedCreateInput = {
        slug,
        title,
        description,
        price: new Prisma.Decimal(price),
        compareAtPrice: compareAtPrice === null ? null : new Prisma.Decimal(compareAtPrice),
        images: JSON.stringify(normalizeProductImageRecords(imageUrls)),
        isStock,
        stockCount,
        isPublished,
      }

      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            ...data,
            categories: { set: categoryRows.map((category) => ({ id: category.id })) },
          },
        })
        updated += 1
        await prisma.$executeRawUnsafe(
          `UPDATE "Product" SET "sku" = ?, "isFeatured" = ?, "deletedAt" = NULL WHERE "id" = ?`,
          sku,
          isFeatured ? 1 : 0,
          existing.id
        )
      } else {
        const createdProduct = await prisma.product.create({
          data: {
            ...data,
            categories: { connect: categoryRows.map((category) => ({ id: category.id })) },
          },
          select: { id: true },
        })
        created += 1
        await prisma.$executeRawUnsafe(
          `UPDATE "Product" SET "sku" = ?, "isFeatured" = ?, "deletedAt" = NULL WHERE "id" = ?`,
          sku,
          isFeatured ? 1 : 0,
          createdProduct.id
        )
      }
    } catch (error) {
      skipped += 1
      const message = error instanceof Error ? error.message : "Unknown error"
      errors.push(`Line ${line + 1}: ${message}`)
    }
  }

  revalidatePath("/dashboard/products")
  revalidatePath("/products")

  return NextResponse.json({
    success: true,
    created,
    updated,
    skipped,
    totalRows: rows.length - 1,
    errors: errors.slice(0, 20),
  })
}
