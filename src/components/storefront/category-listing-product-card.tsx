import Link from "next/link"

import { CategoryHoverProductCardClient } from "@/components/storefront/category-hover-product-card"
import { StorefrontProductImage } from "@/components/storefront/storefront-product-image"
import { buildProductImageAlt, getProductImageUrlCandidates, parseProductImageRecords } from "@/lib/product-images"
import { formatCurrency, type CurrencySettings } from "@/lib/storefront/currency"

type ProductRelation = {
  id?: string
  name?: string
  title?: string
  slug: string
}

type CategoryListingProduct = {
  id: string
  slug: string
  title: string
  description?: string | null
  price: number
  compareAtPrice?: number | null
  images: string
  stockCount?: number
  isStock?: boolean
  categories?: Array<{ id: string; title: string; slug: string }>
  sizes?: ProductRelation[]
  styles?: ProductRelation[]
  types?: ProductRelation[]
  colors?: ProductRelation[]
  ages?: ProductRelation[]
  materials?: ProductRelation[]
}

function stripHtml(input: string | null | undefined) {
  if (!input) return ""
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function relationLabel(item: ProductRelation | undefined) {
  return (item?.name || item?.title || "").trim()
}

function buildCardTags(product: CategoryListingProduct) {
  const tags: string[] = []
  const seen = new Set<string>()

  const pushTag = (value: string | undefined) => {
    const normalized = (value || "").trim()
    if (!normalized) return
    const key = normalized.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    tags.push(normalized)
  }

  // Use the product's own structured relations only; avoid broad/fuzzy fallbacks.
  pushTag(product.categories?.[0]?.title)
  pushTag(relationLabel(product.types?.[0]))
  pushTag(relationLabel(product.styles?.[0]))
  pushTag(relationLabel(product.materials?.[0]))

  // Only show a color tag when the product has a single explicit color relation.
  if ((product.colors || []).length === 1) {
    pushTag(relationLabel(product.colors?.[0]))
  }

  return tags.slice(0, 4)
}

export function CategoryListingProductCard({
  product,
  currencySettings,
}: {
  product: CategoryListingProduct
  currencySettings?: CurrencySettings
}) {
  const gallery = parseProductImageRecords(product.images)
  const largeCandidates = getProductImageUrlCandidates(gallery[0], "large")
  const mainImage = largeCandidates[0] || "/placeholder.jpg"
  const primaryLargeImage = largeCandidates[0] || "/placeholder.jpg"
  const mainImageAlt = buildProductImageAlt({
    title: product.title,
    fallbackAlt: gallery[0]?.alt,
    categories: product.categories,
  })

  const stockCount = Math.max(0, product.stockCount ?? 999)
  const isMarkedOutOfStock = product.isStock === false && stockCount > 0
  const isSold = stockCount <= 0
  const hasDiscount = Boolean(product.compareAtPrice && product.compareAtPrice > product.price)
  const discountPercent = hasDiscount
    ? Math.round((((product.compareAtPrice as number) - product.price) / (product.compareAtPrice as number)) * 100)
    : 0

  const badgeLabel = relationLabel(product.ages?.[0]) || relationLabel(product.types?.[0]) || product.categories?.[0]?.title || "Featured"
  const sizeLabel = relationLabel(product.sizes?.[0]) || "One of a kind"
  const shortDescription = stripHtml(product.description).slice(0, 110)

  const attributeTags = buildCardTags(product)

  return (
    <article className="group/card relative flex h-full flex-col overflow-hidden rounded-[22px] border border-[#e5ddd2] bg-[#fffdfa] text-[#2c261f] shadow-[0_14px_36px_rgba(28,22,17,0.08)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#d8cabb] hover:shadow-[0_18px_42px_rgba(28,22,17,0.12)]">
      <div className="relative">
        <Link href={`/product/${product.slug}`} className="block">
          <div className="relative aspect-[4/5] overflow-hidden bg-[linear-gradient(180deg,#efe7d7_0%,#e9dece_100%)] p-4">
            <span className="absolute left-3 top-3 z-20 inline-flex rounded-full border border-[#e7d7bc] bg-[#f8eddd] px-3 py-1 text-[11px] font-semibold tracking-[0.04em] text-[#7a531d]">
              {isMarkedOutOfStock ? "Out of stock" : isSold ? "Sold" : hasDiscount && discountPercent > 0 ? `${discountPercent}% Off` : badgeLabel}
            </span>
            <StorefrontProductImage
              candidates={largeCandidates}
              alt={mainImageAlt}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
              className="transition-transform duration-500 group-hover/card:scale-105"
            />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.22),transparent_52%)] opacity-80" />
          </div>
        </Link>

        <CategoryHoverProductCardClient
          product={{
            ...product,
            stockCount,
            mainImage,
            primaryLargeImage,
            currencySettings,
          }}
        />
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5 sm:px-4 sm:pb-4">
        <Link href={`/product/${product.slug}`} className="block">
          <h3 className="min-h-[3.35rem] line-clamp-2 text-[1.05rem] font-semibold leading-7 text-[#2c261f] transition-colors group-hover/card:text-[#8a6431]">
            {product.title}
          </h3>
        </Link>

        {attributeTags.length > 0 ? (
          <div className="mt-2.5 flex min-h-[2.75rem] flex-wrap gap-1.5">
            {attributeTags.map((tag) => (
              <span key={tag} className="inline-flex h-7 items-center rounded-full border border-[#e6ddd2] bg-[#f5f1ea] px-2.5 text-[11px] font-medium text-[#7d7468]">
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <div className="mt-2.5 min-h-[2.75rem]" />
        )}

        <div className="mt-auto pt-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[1.75rem] font-semibold tracking-[-0.03em] text-[#2c261f]">{formatCurrency(product.price, currencySettings)}</span>
                {product.compareAtPrice && product.compareAtPrice > product.price ? (
                  <span className="text-sm text-[#9b9286] line-through">{formatCurrency(product.compareAtPrice, currencySettings)}</span>
                ) : null}
              </div>
              <p className="mt-0.5 text-sm text-[#7b7267]">{sizeLabel}</p>
            </div>
            <span className="rounded-full border border-[#e6ddd2] bg-[#f5f1ea] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[#7b7267]">
              Detail
            </span>
          </div>
          <p className="mt-2.5 min-h-[2.5rem] line-clamp-2 text-[11px] leading-5 text-[#8d8478]">
            {shortDescription || "Hand-selected vintage rug with refined character and collectible appeal."}
          </p>
        </div>
      </div>
    </article>
  )
}
