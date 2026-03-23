import { notFound } from "next/navigation"
import type { Metadata } from "next"
import type { Prisma } from "@prisma/client"
import { cache } from "react"
import { prisma } from "@/lib/db"
import { ProductDetailView } from "@/components/storefront/product-detail-view"
import { getStorefrontCurrencySnapshot } from "@/lib/storefront/currency-server"
import { fetchCategoryPathRows, getCategoryPathById, type CategoryPathRow } from "@/lib/category-paths"
import { buildProductImageAlt, getProductImageUrl, parseProductImageRecords } from "@/lib/product-images"
import { getShippingReturnsPage } from "@/lib/storefront/shipping-returns-page"

type Props = {
  params: Promise<{ slug: string }>
}

export const revalidate = 300

type CustomAttribute = {
  name: string
  values: string[]
  visible: boolean
}

type RelatedProductCard = {
  id: string
  slug: string
  title: string
  description?: string | null
  price: number
  compareAtPrice: number | null
  images: string
  stockCount: number
  isStock: boolean
  categories: Array<{ id: string; title: string; slug: string }>
}

type ProductRecord = Prisma.ProductGetPayload<{
  include: {
    categories: {
      select: {
        id: true
        title: true
        slug: true
      }
    }
    colors: {
      select: {
        id: true
      }
    }
    sizes: {
      select: {
        id: true
      }
    }
  }
}>

const getPublishedProductBySlug = cache(async (slug: string) => {
  return prisma.product.findUnique({
    where: { slug, isPublished: true },
    include: {
      categories: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
      colors: {
        select: {
          id: true,
        },
      },
      sizes: {
        select: {
          id: true,
        },
      },
    },
  }) as Promise<ProductRecord | null>
})

function stripHtml(input: string | null | undefined) {
  if (!input) return ""
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function buildProductMetaDescription(title: string, description: string | null | undefined) {
  const plainDescription = stripHtml(description)
  if (plainDescription) {
    return plainDescription.slice(0, 160)
  }

  return `${title}. Handmade Turkish rug crafted using traditional Anatolian techniques.`.slice(0, 160)
}

function getCategoryAncestors(rows: CategoryPathRow[], categoryId: string) {
  const byId = new Map(rows.map((row) => [row.id, row]))
  const chain: CategoryPathRow[] = []
  let current = byId.get(categoryId) || null

  while (current) {
    chain.unshift(current)
    current = current.parentId ? byId.get(current.parentId) || null : null
  }

  return chain
}

function getDescendantCategoryIds(rows: CategoryPathRow[], rootId: string) {
  const ids = new Set<string>([rootId])
  let changed = true

  while (changed) {
    changed = false
    for (const row of rows) {
      if (row.parentId && ids.has(row.parentId) && !ids.has(row.id)) {
        ids.add(row.id)
        changed = true
      }
    }
  }

  return Array.from(ids)
}

async function fetchRelatedProducts(input: {
  productId: string
  categoryFamilyIds: string[]
  colorIds: string[]
  sizeIds: string[]
}) {
  const collected = new Map<string, RelatedProductCard>()

  const baseSelect = {
    id: true,
    slug: true,
    title: true,
    description: true,
    price: true,
    compareAtPrice: true,
    images: true,
    stockCount: true,
    isStock: true,
    categories: {
      select: {
        id: true,
        title: true,
        slug: true,
      },
    },
  } as const

  const appendBatch = (items: Array<{
    id: string
    slug: string
    title: string
    description: string | null
    price: { toNumber(): number }
    compareAtPrice: { toNumber(): number } | null
    images: string
    stockCount: number
    isStock: boolean
    categories: Array<{ id: string; title: string; slug: string }>
  }>) => {
    for (const item of items) {
      if (collected.size >= 8) break
      if (!collected.has(item.id)) {
        collected.set(item.id, {
          id: item.id,
          slug: item.slug,
          title: item.title,
          description: item.description,
          price: Number(item.price),
          compareAtPrice: item.compareAtPrice ? Number(item.compareAtPrice) : null,
          images: item.images,
          stockCount: item.stockCount,
          isStock: item.isStock,
          categories: item.categories,
        })
      }
    }
  }

  if (input.categoryFamilyIds.length > 0) {
    const sameCategory = await prisma.product.findMany({
      where: {
        id: { not: input.productId },
        isPublished: true,
        categories: { some: { id: { in: input.categoryFamilyIds } } },
      },
      take: 8,
      select: baseSelect,
    })
    appendBatch(sameCategory)
  }

  if (collected.size < 8 && input.colorIds.length > 0) {
    const sameColor = await prisma.product.findMany({
      where: {
        id: { notIn: [input.productId, ...collected.keys()] },
        isPublished: true,
        colors: { some: { id: { in: input.colorIds } } },
      },
      take: 8 - collected.size,
      select: baseSelect,
    })
    appendBatch(sameColor)
  }

  if (collected.size < 8 && input.sizeIds.length > 0) {
    const sameSize = await prisma.product.findMany({
      where: {
        id: { notIn: [input.productId, ...collected.keys()] },
        isPublished: true,
        sizes: { some: { id: { in: input.sizeIds } } },
      },
      take: 8 - collected.size,
      select: baseSelect,
    })
    appendBatch(sameSize)
  }

  return Array.from(collected.values())
}

function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "")
}

function toAbsoluteUrl(path: string) {
  if (!path) return getSiteUrl()
  if (path.startsWith("http://") || path.startsWith("https://")) return path
  return `${getSiteUrl()}${path.startsWith("/") ? path : `/${path}`}`
}

function parseCustomAttributes(raw: string | null | undefined): CustomAttribute[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null
        const name = typeof item.name === "string" ? item.name.trim() : ""
        const values = Array.isArray(item.values)
          ? item.values.filter((value: unknown): value is string => typeof value === "string").map((value: string) => value.trim()).filter(Boolean)
          : []
        if (!name || values.length === 0) return null
        const visible = item.visible !== false
        return { name, values, visible }
      })
      .filter((item): item is CustomAttribute => Boolean(item))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const product = await getPublishedProductBySlug(slug)

  if (!product) return { title: "Product Not Found" }

  const imageRecords = parseProductImageRecords(product.images)
  const primaryImage = getProductImageUrl(imageRecords[0], "large")
  const imageAlt = buildProductImageAlt({
    title: product.title,
    fallbackAlt: imageRecords[0]?.alt,
    categories: product.categories,
  })
  const metaDescription = buildProductMetaDescription(product.title, product.description)
  const seoTitle = product.seoTitle?.trim() || product.title

  return {
    title: seoTitle,
    description: metaDescription,
    alternates: {
      canonical: `/product/${slug}`,
    },
    openGraph: {
      title: seoTitle,
      description: metaDescription,
      url: `/product/${slug}`,
      type: "website",
      images: primaryImage
        ? [
            {
              url: toAbsoluteUrl(primaryImage),
              alt: imageAlt,
            },
          ]
        : [],
    },
    twitter: {
      card: primaryImage ? "summary_large_image" : "summary",
      title: seoTitle,
      description: metaDescription,
      images: primaryImage ? [toAbsoluteUrl(primaryImage)] : [],
    },
  }
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params

  const product = await getPublishedProductBySlug(slug)

  if (!product) notFound()
  const categoryRows = await fetchCategoryPathRows()

  const primaryCategory = product.categories[0] || null
  const primaryChain = primaryCategory ? getCategoryAncestors(categoryRows, primaryCategory.id) : []
  const mainCategory = primaryChain[0] || null
  const categoryFamilyIds = mainCategory ? getDescendantCategoryIds(categoryRows, mainCategory.id) : []
  const relatedProducts = await fetchRelatedProducts({
    productId: product.id,
    categoryFamilyIds,
    colorIds: product.colors.map((item) => item.id),
    sizeIds: product.sizes.map((item) => item.id),
  })

  const serializedProduct = {
    ...product,
    categories: product.categories.map((category) => ({
      ...category,
      path: getCategoryPathById(categoryRows, category.id),
    })),
    ...(await (async () => {
      try {
        const rows = await prisma.$queryRaw<Array<{ sku: string | null; customAttributes: string | null; shortDescription: string | null }>>`
          SELECT "sku", "customAttributes", "shortDescription"
          FROM "Product"
          WHERE "id" = ${product.id}
          LIMIT 1
        `
        const record = rows[0]
        return {
          sku: record?.sku ?? null,
          shortDescription: record?.shortDescription ?? null,
          customAttributes: parseCustomAttributes(record?.customAttributes),
        }
      } catch {
        return {
          sku: null,
          shortDescription: null,
          customAttributes: [] as CustomAttribute[],
        }
      }
    })()),
    price: Number(product.price),
    compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : null,
  }

  const previous = await prisma.product.findFirst({
    where: {
      isPublished: true,
      OR: [
        { createdAt: { lt: product.createdAt } },
        { createdAt: product.createdAt, id: { lt: product.id } },
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      slug: true,
      title: true,
      price: true,
      compareAtPrice: true,
      images: true,
    },
  })

  const next = await prisma.product.findFirst({
    where: {
      isPublished: true,
      OR: [
        { createdAt: { gt: product.createdAt } },
        { createdAt: product.createdAt, id: { gt: product.id } },
      ],
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      slug: true,
      title: true,
      price: true,
      compareAtPrice: true,
      images: true,
    },
  })

  const serializedPrevious = previous
    ? {
        ...previous,
        price: Number(previous.price),
        compareAtPrice: previous.compareAtPrice ? Number(previous.compareAtPrice) : null,
      }
    : null

  const serializedNext = next
    ? {
        ...next,
        price: Number(next.price),
        compareAtPrice: next.compareAtPrice ? Number(next.compareAtPrice) : null,
      }
    : null

  const shippingPage = await getShippingReturnsPage()
  const shippingContent = shippingPage?.content || shippingPage?.excerpt || null
  const currencySnapshot = await getStorefrontCurrencySnapshot()
  const currencySettings = {
    selectedCurrency: currencySnapshot.selectedCurrency,
    usdToEurRate: currencySnapshot.usdToEurRate,
    locale: currencySnapshot.locale,
  }
  const productImageRecords = parseProductImageRecords(product.images)
  const productImageUrls = productImageRecords
    .map((image) => getProductImageUrl(image, "master") || getProductImageUrl(image, "large"))
    .filter(Boolean)
    .map((image) => toAbsoluteUrl(image))
  const productCanonicalUrl = `${getSiteUrl()}/product/${product.slug}`
  const productMetaDescription = buildProductMetaDescription(product.title, product.description)
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: productMetaDescription,
    sku: serializedProduct.sku || undefined,
    image: productImageUrls,
    category: product.categories.map((category) => category.title).join(", ") || undefined,
    brand: {
      "@type": "Brand",
      name: "Turkish Rug House",
    },
    offers: {
      "@type": "Offer",
      url: productCanonicalUrl,
      priceCurrency: "USD",
      price: Number(product.price).toFixed(2),
      availability: product.isStock && product.stockCount > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <ProductDetailView
        product={serializedProduct}
        relatedProducts={relatedProducts}
        previousProduct={serializedPrevious}
        nextProduct={serializedNext}
        shippingContent={shippingContent}
        currencySettings={currencySettings}
      />
    </>
  )
}
