import type { MetadataRoute } from "next"
import { prisma } from "@/lib/db"
import { buildCategoryPathMap } from "@/lib/category-paths"
import { getSiteUrl } from "@/lib/site-url"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl()

  const [products, pages, categories] = await Promise.all([
    prisma.product.findMany({
      where: { isPublished: true },
      select: { slug: true, updatedAt: true },
    }),
    prisma.page.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
    }),
    prisma.category.findMany({
      select: { id: true, slug: true, title: true, parentId: true },
    }),
  ])

  const core: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/products`, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/shop`, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/faq`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/support`, changeFrequency: "weekly", priority: 0.7 },
  ]

  const productUrls: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${baseUrl}/product/${product.slug}`,
    lastModified: product.updatedAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }))

  const pageUrls: MetadataRoute.Sitemap = pages.map((page) => ({
    url: `${baseUrl}/${page.slug}`,
    lastModified: page.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }))

  const { pathById } = buildCategoryPathMap(categories)
  const categoryUrls: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${baseUrl}${pathById.get(category.id) || `/${category.slug}`}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }))

  return [...core, ...productUrls, ...pageUrls, ...categoryUrls]
}
