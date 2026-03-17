import { promises as fs } from "node:fs"
import path from "node:path"
import { NextResponse } from "next/server"
import { getInventoryProducts } from "@/lib/admin-inventory"
import { createZip } from "@/lib/zip"

function escapeCsvCell(value: unknown) {
  const text = String(value ?? "")
  if (text.includes(",") || text.includes('"') || text.includes("\n") || text.includes("\r")) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function resolvePublicFilePath(imageUrl: string) {
  const value = String(imageUrl || "").trim()
  if (!value) return null

  try {
    if (value.startsWith("http://") || value.startsWith("https://")) {
      const parsed = new URL(value)
      if (!parsed.pathname.startsWith("/uploads/")) return null
      return path.join(process.cwd(), "public", parsed.pathname.replace(/^\/+/, ""))
    }
  } catch {
    return null
  }

  if (value.startsWith("/uploads/") || value.startsWith("/")) {
    return path.join(process.cwd(), "public", value.replace(/^\/+/, ""))
  }

  return null
}

export async function buildInventoryCsvResponse(params: {
  supplier?: string | null
  status?: string | null
  productIds?: string[] | null
}) {
  const { rows } = await getInventoryProducts(params)
  const headers = [
    "id",
    "slug",
    "sku",
    "title",
    "category",
    "location",
    "businessStatus",
    "holdUntil",
    "price",
    "purchasePrice",
    "profit",
    "marginPercent",
    "daysInStock",
    "stockCount",
    "isPublished",
    "isFeatured",
    "supplier",
    "imagesCount",
    "photoStatus",
    "seoStatus",
    "soldDate",
    "soldRevenue",
    "finalSalePrice",
    "customerCountry",
    "adminName",
    "imageUrls",
    "createdAt",
    "updatedAt",
  ]

  const csvRows = rows.map((product) => [
    product.id,
    product.slug,
    product.sku || "",
    product.title,
    product.category,
    product.location || "",
    product.businessStatus,
    product.holdUntil || "",
    product.price.toString(),
    product.purchasePrice?.toString() || "",
    product.profit?.toString() || "",
    product.marginPercent?.toString() || "",
    product.daysInStock?.toString() || "",
    String(product.stockCount),
    product.isPublished ? "1" : "0",
    product.isFeatured ? "1" : "0",
    product.supplier,
    String(product.imagesCount),
    product.photoCompleteness.status,
    product.seoCompleteness.status,
    product.soldDate?.toISOString() || "",
    product.soldRevenue?.toString() || "",
    product.finalSalePrice?.toString() || "",
    product.customerCountry || "",
    product.adminName || "",
    product.imageUrls.join("|"),
    product.createdAt.toISOString(),
    product.updatedAt.toISOString(),
  ])

  const csvBody = [headers, ...csvRows]
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

export async function buildInventoryImagesZipResponse(params: {
  supplier?: string | null
  status?: string | null
  productIds?: string[] | null
}) {
  const inventory = await getInventoryProducts(params)
  const entries: Array<{ name: string; data: Uint8Array; modifiedAt?: Date }> = []
  const usedNames = new Set<string>()

  for (const row of inventory.rows) {
    const skuPrefix = (row.sku || row.id).replace(/[^a-zA-Z0-9_-]+/g, "-")
    for (const [index, imageUrl] of row.imageUrls.entries()) {
      const filePath = resolvePublicFilePath(imageUrl)
      if (!filePath) continue
      try {
        const data = await fs.readFile(filePath)
        const ext = path.extname(filePath) || ".jpg"
        let entryName = `${skuPrefix}/${String(index + 1).padStart(2, "0")}${ext}`
        while (usedNames.has(entryName)) {
          entryName = `${skuPrefix}/${String(index + 1).padStart(2, "0")}-${usedNames.size}${ext}`
        }
        usedNames.add(entryName)
        entries.push({
          name: entryName,
          data: new Uint8Array(data),
          modifiedAt: row.updatedAt,
        })
      } catch {
        // Skip missing local files; the export should still succeed for the rest.
      }
    }
  }

  if (entries.length === 0) {
    entries.push({
      name: "README.txt",
      data: new TextEncoder().encode("No local product images were available for ZIP export."),
      modifiedAt: new Date(),
    })
  }

  const zipBuffer = createZip(entries)
  const filename = `product-images-${new Date().toISOString().slice(0, 10)}.zip`

  return new NextResponse(zipBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
