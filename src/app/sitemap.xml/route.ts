import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { buildCategoryPathMap } from "@/lib/category-paths"
import { getProductImageUrl, parseProductImageRecords } from "@/lib/product-images"
import { getSiteUrl } from "@/lib/site-url"

function toAbsoluteUrl(path: string) {
  if (!path) return getSiteUrl()
  if (path.startsWith("http://") || path.startsWith("https://")) return path
  return `${getSiteUrl()}${path.startsWith("/") ? path : `/${path}`}`
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function slugToLabel(slug: string) {
  return slug.replace(/-/g, " ").trim().toLowerCase()
}

function normalizeFacetValue(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase()
}

function shouldIncludeCategoryPath(input: {
  slug: string
  title: string
  parentId: string | null
  taxonomySlugSet: Set<string>
  taxonomyLabelSet: Set<string>
  visibleCategoryIds: Set<string>
  categoryId: string
}) {
  if (!input.visibleCategoryIds.has(input.categoryId)) return false
  if (!input.parentId) return true

  const slug = input.slug.trim().toLowerCase()
  const title = normalizeFacetValue(input.title)
  const slugLabel = normalizeFacetValue(slugToLabel(slug))

  const exactFacetMatch =
    input.taxonomySlugSet.has(slug) ||
    input.taxonomyLabelSet.has(title) ||
    input.taxonomyLabelSet.has(slugLabel)

  return !exactFacetMatch
}

export async function GET() {
  const baseUrl = getSiteUrl()

  const [products, pages, categories, colors, sizes, styles, ages, materials, blogPosts] = await Promise.all([
    prisma.product.findMany({
      where: { isPublished: true },
      select: {
        slug: true,
        updatedAt: true,
        title: true,
        images: true,
        categories: {
          select: {
            id: true,
          },
        },
      },
    }),
    prisma.page.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
    }),
    prisma.category.findMany({
      select: { id: true, slug: true, title: true, parentId: true },
    }),
    prisma.color.findMany({ select: { slug: true, name: true } }),
    prisma.size.findMany({ select: { slug: true, name: true } }),
    prisma.style.findMany({ select: { slug: true, name: true } }),
    prisma.age.findMany({ select: { slug: true, name: true } }),
    prisma.material.findMany({ select: { slug: true, name: true } }),
    prisma.blogPost.findMany({
      where: { status: "PUBLISHED", publishedAt: { not: null, lte: new Date() } },
      select: { slug: true, updatedAt: true },
    }),
  ])

  const { pathById } = buildCategoryPathMap(categories)
  const childrenByParentId = new Map<string | null, string[]>()
  for (const category of categories) {
    const list = childrenByParentId.get(category.parentId) || []
    list.push(category.id)
    childrenByParentId.set(category.parentId, list)
  }

  const visibleCategoryIds = new Set<string>()
  for (const product of products) {
    for (const category of product.categories) {
      visibleCategoryIds.add(category.id)
    }
  }

  let changed = true
  while (changed) {
    changed = false
    for (const category of categories) {
      const childIds = childrenByParentId.get(category.id) || []
      if (childIds.some((childId) => visibleCategoryIds.has(childId)) && !visibleCategoryIds.has(category.id)) {
        visibleCategoryIds.add(category.id)
        changed = true
      }
    }
  }

  const taxonomyItems = [...colors, ...sizes, ...styles, ...ages, ...materials]
  const taxonomySlugSet = new Set(taxonomyItems.map((item) => item.slug.trim().toLowerCase()).filter(Boolean))
  const taxonomyLabelSet = new Set(
    taxonomyItems
      .flatMap((item) => [item.name, slugToLabel(item.slug)])
      .map((value) => normalizeFacetValue(value))
      .filter(Boolean)
  )

  const urls = [
    {
      loc: `${baseUrl}/`,
      lastModified: new Date().toISOString(),
    },
    {
      loc: `${baseUrl}/blog`,
      lastModified: new Date().toISOString(),
    },
    { loc: `${baseUrl}/shop`, lastModified: new Date().toISOString(), changefreq: "weekly", priority: 0.7 },
    { loc: `${baseUrl}/products`, lastModified: new Date().toISOString(), changefreq: "weekly", priority: 0.7 },
    { loc: `${baseUrl}/faq`, lastModified: new Date().toISOString(), changefreq: "weekly", priority: 0.5 },
    { loc: `${baseUrl}/support`, lastModified: new Date().toISOString(), changefreq: "weekly", priority: 0.5 },
    ...pages.map((page) => ({
      loc: `${baseUrl}/${page.slug}`,
      lastModified: page.updatedAt.toISOString(),
    })),
    ...blogPosts.map((post) => ({
      loc: `${baseUrl}/blog/${post.slug}`,
      lastModified: post.updatedAt.toISOString(),
    })),
    ...categories.map((category) => ({
      category,
      loc: `${baseUrl}${pathById.get(category.id) || `/${category.slug}`}`,
      lastModified: new Date().toISOString(),
    }))
      .filter((entry) =>
        shouldIncludeCategoryPath({
          categoryId: entry.category.id,
          slug: entry.category.slug,
          title: entry.category.title,
          parentId: entry.category.parentId,
          taxonomySlugSet,
          taxonomyLabelSet,
          visibleCategoryIds,
        })
      )
      .map(({ loc, lastModified }) => ({ loc, lastModified })),
    ...products.map((product) => ({
      loc: `${baseUrl}/product/${product.slug}`,
      lastModified: product.updatedAt.toISOString(),
      images: Array.from(
        new Set(
          parseProductImageRecords(product.images)
            .map((image) => getProductImageUrl(image, "master") || getProductImageUrl(image, "large"))
            .filter(Boolean)
            .map((image) => toAbsoluteUrl(image))
        )
      )
        .map((image) => ({
          loc: image,
          title: product.title,
          caption: product.title,
        })),
    })),
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
    urls
      .map((entry) => {
        const images = "images" in entry && Array.isArray(entry.images)
          ? entry.images
              .map(
                (image) => `    <image:image>\n` +
                  `      <image:loc>${escapeXml(image.loc)}</image:loc>\n` +
                  `      <image:title>${escapeXml(image.title)}</image:title>\n` +
                  `      <image:caption>${escapeXml(image.caption)}</image:caption>\n` +
                  `    </image:image>`
              )
              .join("\n")
          : ""

        return [
          "  <url>",
          `    <loc>${escapeXml(entry.loc)}</loc>`,
          `    <lastmod>${entry.lastModified}</lastmod>`,
          "changefreq" in entry && entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>` : "",
          "priority" in entry && entry.priority != null ? `    <priority>${entry.priority}</priority>` : "",
          images,
          "  </url>",
        ]
          .filter(Boolean)
          .join("\n")
      })
      .join("\n") +
    `\n</urlset>`

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  })
}
