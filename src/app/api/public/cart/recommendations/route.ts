import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const slugsParam = searchParams.get("slugs") || ""
    const slugs = Array.from(
      new Set(
        slugsParam
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      )
    )

    if (slugs.length === 0) {
      return NextResponse.json({ products: [] })
    }

    const selectedProducts = await prisma.product.findMany({
      where: {
        slug: { in: slugs },
        isPublished: true,
      },
      select: {
        id: true,
        slug: true,
        categories: {
          select: { slug: true },
        },
      },
    })

    if (selectedProducts.length === 0) {
      return NextResponse.json({ products: [] })
    }

    const selectedBySlug = new Map(selectedProducts.map((product) => [product.slug, product]))
    const selectedIds = new Set(selectedProducts.map((product) => product.id))

    const orderedCategorySlugs: string[] = []
    if (selectedProducts.length === 1) {
      const only = selectedProducts[0]
      const firstCategorySlug = only.categories[0]?.slug
      if (firstCategorySlug) orderedCategorySlugs.push(firstCategorySlug)
    } else {
      for (const slug of slugs) {
        const product = selectedBySlug.get(slug)
        if (!product) continue
        for (const category of product.categories) {
          if (!category.slug) continue
          if (orderedCategorySlugs.includes(category.slug)) continue
          orderedCategorySlugs.push(category.slug)
        }
      }
    }

    if (orderedCategorySlugs.length === 0) {
      return NextResponse.json({ products: [] })
    }

    const categoryBuckets = new Map<
      string,
      Array<{ id: string; slug: string; title: string; price: number; images: string }>
    >()

    for (const categorySlug of orderedCategorySlugs) {
      const rows = await prisma.product.findMany({
        where: {
          isPublished: true,
          id: { notIn: Array.from(selectedIds) },
          categories: { some: { slug: categorySlug } },
        },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          slug: true,
          title: true,
          price: true,
          images: true,
        },
      })

      categoryBuckets.set(
        categorySlug,
        rows.map((row) => ({
          id: row.id,
          slug: row.slug,
          title: row.title,
          price: Number(row.price),
          images: row.images,
        }))
      )
    }

    const suggestions: Array<{ id: string; slug: string; title: string; price: number; images: string }> = []
    const usedIds = new Set<string>()

    if (selectedProducts.length === 1) {
      const firstCategory = orderedCategorySlugs[0]
      const bucket = categoryBuckets.get(firstCategory) || []
      for (const product of bucket) {
        if (usedIds.has(product.id)) continue
        usedIds.add(product.id)
        suggestions.push(product)
        if (suggestions.length >= 5) break
      }
    } else {
      let hasProgress = true
      while (suggestions.length < 5 && hasProgress) {
        hasProgress = false
        for (const categorySlug of orderedCategorySlugs) {
          const bucket = categoryBuckets.get(categorySlug) || []
          while (bucket.length > 0) {
            const candidate = bucket.shift()
            if (!candidate) continue
            if (usedIds.has(candidate.id)) continue
            usedIds.add(candidate.id)
            suggestions.push(candidate)
            hasProgress = true
            break
          }
          if (suggestions.length >= 5) break
        }
      }
    }

    if (suggestions.length < 5) {
      const fallbackRows = await prisma.product.findMany({
        where: {
          isPublished: true,
          id: { notIn: [...Array.from(selectedIds), ...Array.from(usedIds)] },
          categories: { some: { slug: { in: orderedCategorySlugs } } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          slug: true,
          title: true,
          price: true,
          images: true,
        },
      })

      for (const row of fallbackRows) {
        if (usedIds.has(row.id)) continue
        usedIds.add(row.id)
        suggestions.push({
          id: row.id,
          slug: row.slug,
          title: row.title,
          price: Number(row.price),
          images: row.images,
        })
        if (suggestions.length >= 5) break
      }
    }

    return NextResponse.json({
      products: suggestions.slice(0, 5),
      sourceCategories: orderedCategorySlugs,
    })
  } catch (error) {
    console.error("Cart recommendations error:", error)
    return NextResponse.json({ products: [] }, { status: 200 })
  }
}

