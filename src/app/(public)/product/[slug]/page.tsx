import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { prisma } from "@/lib/db"
import { ProductDetailView } from "@/components/storefront/product-detail-view"

type Props = {
  params: Promise<{ slug: string }>
}

type CustomAttribute = {
  name: string
  values: string[]
  visible: boolean
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
  const product = await prisma.product.findUnique({
    where: { slug, isPublished: true },
    select: {
      title: true,
      description: true,
      seoTitle: true,
      seoDescription: true,
    },
  })

  if (!product) return { title: "Product Not Found" }

  return {
    title: product.seoTitle || `${product.title} | Turkish Rug House`,
    description: product.seoDescription || product.description || "",
  }
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params

  const product = await prisma.product.findUnique({
    where: { slug, isPublished: true },
    include: {
      categories: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
    },
  })

  if (!product) notFound()

  const categoryIds = product.categories.map((cat) => cat.id)

  const relatedProductsByCategory = await prisma.product.findMany({
    where: {
      id: { not: product.id },
      isPublished: true,
      ...(categoryIds.length > 0
        ? { categories: { some: { id: { in: categoryIds } } } }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: {
      id: true,
      slug: true,
      title: true,
      price: true,
      compareAtPrice: true,
      images: true,
    },
  })

  const relatedProductsFallback = await prisma.product.findMany({
    where: {
      id: { not: product.id },
      isPublished: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: {
      id: true,
      slug: true,
      title: true,
      price: true,
      compareAtPrice: true,
      images: true,
    },
  })

  const relatedProducts =
    relatedProductsByCategory.length > 0 ? relatedProductsByCategory : relatedProductsFallback

  const serializedProduct = {
    ...product,
    ...(await (async () => {
      try {
        const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("Product")`)
        const hasSku = columns.some((column) => column.name === "sku")
        const hasCustomAttributes = columns.some((column) => column.name === "customAttributes")

        const selectParts = [
          hasSku ? `"sku"` : `NULL AS "sku"`,
          hasCustomAttributes ? `"customAttributes"` : `NULL AS "customAttributes"`,
        ]
        const rows = await prisma.$queryRawUnsafe<Array<{ sku: string | null; customAttributes: string | null }>>(
          `SELECT ${selectParts.join(", ")} FROM "Product" WHERE "id" = ? LIMIT 1`,
          product.id
        )
        const record = rows[0]
        return {
          sku: record?.sku ?? null,
          customAttributes: parseCustomAttributes(record?.customAttributes),
        }
      } catch {
        return {
          sku: null,
          customAttributes: [] as CustomAttribute[],
        }
      }
    })()),
    price: Number(product.price),
    compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : null,
  }

  const serializedRelated = relatedProducts.map((item) => ({
    ...item,
    price: Number(item.price),
    compareAtPrice: item.compareAtPrice ? Number(item.compareAtPrice) : null,
  }))

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

  const shippingPage = await prisma.page.findFirst({
    where: {
      status: "PUBLISHED",
      OR: [
        { slug: "shipping-and-delivery" },
        { slug: "shipping-delivery" },
        { slug: "shipping" },
      ],
    },
    select: {
      content: true,
      excerpt: true,
    },
  })

  const shippingContent = shippingPage?.content || shippingPage?.excerpt || null

  return (
    <ProductDetailView
      product={serializedProduct}
      relatedProducts={serializedRelated}
      previousProduct={serializedPrevious}
      nextProduct={serializedNext}
      shippingContent={shippingContent}
    />
  )
}
