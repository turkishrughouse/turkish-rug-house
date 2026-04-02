import { NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { fetchCategoryPathRows, resolveCategoryByPath } from "@/lib/category-paths"

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
      take: 6,
      select: {
        id: true,
        slug: true,
        title: true,
        price: true,
        images: true,
      },
    })

    return NextResponse.json({
      products: products.map((product) => ({
        ...product,
        price: Number(product.price),
      })),
    })
  } catch (error) {
    console.error("GET /api/categories/previews ERROR:", error)
    return NextResponse.json({ products: [] }, { status: 200 })
  }
}
