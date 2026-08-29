import { NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { fetchCategoryPathRows, resolveCategoryByPath } from "@/lib/category-paths"
import { getCardProductImageCandidates } from "@/lib/product-images"

function collectCategoryScopeIds(rows: Awaited<ReturnType<typeof fetchCategoryPathRows>>, categoryId: string) {
  const byParent = new Map<string | null, string[]>()

  rows.forEach((row) => {
    const bucket = byParent.get(row.parentId) || []
    bucket.push(row.id)
    byParent.set(row.parentId, bucket)
  })

  const result = new Set<string>()
  const stack = [categoryId]

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || result.has(current)) continue
    result.add(current)
    ;(byParent.get(current) || []).forEach((childId) => stack.push(childId))
  }

  return Array.from(result)
}

const PREVIEW_PRODUCT_LIMIT = 6
// Menu contents change far less often than the menu is opened. A short shared
// TTL keeps repeat opens off the database while still surfacing catalogue edits
// within a few minutes, matching the storefront's existing revalidate window.
const PREVIEW_CACHE_SECONDS = 300

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const rawPath = searchParams.get("path") || ""
    const sanitizedPath = rawPath.replace(/^https?:\/\/[^/]+/i, "").replace(/\/+$/, "")
    const segments = sanitizedPath.split("/").filter(Boolean)

    if (segments.length === 0) {
      return NextResponse.json({ products: [] })
    }

    const resolved = await resolveCategoryByPath(segments)
    if (!resolved) {
      return NextResponse.json({ products: [] })
    }

    const scopeIds = collectCategoryScopeIds(resolved.rows, resolved.category.id)

    const products = await prisma.product.findMany({
      where: {
        isPublished: true,
        deletedAt: null,
        categories: {
          some: {
            id: { in: scopeIds },
          },
        },
      },
      orderBy: [
        { isFeatured: "desc" },
        { updatedAt: "desc" },
      ],
      take: PREVIEW_PRODUCT_LIMIT,
      select: {
        id: true,
        slug: true,
        title: true,
        price: true,
        images: true,
      },
    })

    // Resolve the card image server-side and ship only the handful of URLs the
    // menu actually renders. The raw `images` column is a JSON blob holding every
    // derivative of every image on the product (~2.7KB each), so returning it
    // made a six-product response ~18KB to drive six thumbnails.
    return NextResponse.json(
      {
        products: products.map((product) => ({
          id: product.id,
          slug: product.slug,
          title: product.title,
          price: Number(product.price),
          imageCandidates: getCardProductImageCandidates(product.images),
        })),
      },
      {
        headers: {
          "Cache-Control": `public, max-age=0, s-maxage=${PREVIEW_CACHE_SECONDS}, stale-while-revalidate=${PREVIEW_CACHE_SECONDS * 2}`,
        },
      }
    )
  } catch (error) {
    console.error("GET /api/categories/previews ERROR:", error)
    return NextResponse.json({ products: [] }, { status: 200 })
  }
}
