import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSessionUser } from "@/lib/auth-server"
import { isAdminRole } from "@/lib/rbac"
import { parseProductImages } from "@/lib/product-images"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function ensureDeletedAtColumn() {
  const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("Product")`)
  const hasColumn = columns.some((column) => column.name === "deletedAt")
  if (!hasColumn) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN "deletedAt" DATETIME`)
  }
}

function escapeCsvCell(value: unknown) {
  const text = String(value ?? "")
  if (text.includes(",") || text.includes('"') || text.includes("\n") || text.includes("\r")) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export async function GET() {
  const user = await getSessionUser("admin")
  if (!user || !isAdminRole(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await ensureDeletedAtColumn()
  const activeIds = (
    await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "Product" WHERE "deletedAt" IS NULL`
    )
  ).map((row) => row.id)

  const products = await prisma.product.findMany({
    where: { id: { in: activeIds } },
    orderBy: { updatedAt: "desc" },
    include: {
      categories: {
        select: { slug: true },
      },
    },
  })

  const dynamicRows = products.length > 0
    ? await prisma.$queryRawUnsafe<Array<{ id: string; sku: string | null; isFeatured: number | boolean | null }>>(
      `SELECT "id", "sku", "isFeatured" FROM "Product" WHERE "id" IN (${products.map(() => "?").join(",")})`,
      ...products.map((product) => product.id)
    )
    : []
  const dynamicMap = new Map(dynamicRows.map((row) => [row.id, row]))

  const headers = [
    "id",
    "slug",
    "sku",
    "title",
    "description",
    "price",
    "compareAtPrice",
    "isStock",
    "stockCount",
    "isPublished",
    "isFeatured",
    "categorySlugs",
    "imageUrls",
    "createdAt",
    "updatedAt",
  ]

  const rows = products.map((product) => {
    const imageUrls = parseProductImages(product.images).join("|")

    return [
      product.id,
      product.slug,
      dynamicMap.get(product.id)?.sku || "",
      product.title,
      product.description || "",
      product.price.toString(),
      product.compareAtPrice ? product.compareAtPrice.toString() : "",
      product.isStock ? "1" : "0",
      String(product.stockCount),
      product.isPublished ? "1" : "0",
      Boolean(dynamicMap.get(product.id)?.isFeatured) ? "1" : "0",
      product.categories.map((category) => category.slug).join("|"),
      imageUrls,
      product.createdAt.toISOString(),
      product.updatedAt.toISOString(),
    ]
  })

  const csvBody = [headers, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
    .join("\n")
  const csv = `\uFEFF${csvBody}`

  const filename = `products-${new Date().toISOString().slice(0, 10)}.csv`
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
