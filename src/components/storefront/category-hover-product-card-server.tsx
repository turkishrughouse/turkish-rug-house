import Link from "next/link"

import { CategoryHoverProductCardClient } from "@/components/storefront/category-hover-product-card"
import { StorefrontProductImage } from "@/components/storefront/storefront-product-image"
import { formatCurrency, type CurrencySettings } from "@/lib/storefront/currency"
import { buildProductImageAlt, getProductImageUrlCandidates, parseProductImageRecords } from "@/lib/product-images"

type ProductCardData = {
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
}

function stripHtml(input: string | null | undefined) {
  if (!input) return ""
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

export function CategoryHoverProductCardServer({
  product,
  currencySettings,
}: {
  product: ProductCardData
  currencySettings?: CurrencySettings
}) {
  const gallery = parseProductImageRecords(product.images)
  const imageCandidates = getProductImageUrlCandidates(gallery[0], "thumb")
  const largeCandidates = getProductImageUrlCandidates(gallery[0], "large")
  const mainImage = imageCandidates[0] || largeCandidates[0] || "/placeholder.jpg"
  const primaryLargeImage = largeCandidates[0] || mainImage
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
  const shortDescription = (
    stripHtml(product.description) || "Premium handcrafted product with quality materials and authentic details."
  ).slice(0, 140)
  const categoryText = product.categories?.slice(0, 2).map((c) => c.title).join(", ") || "Rug House"

  return (
    <div className="group/card relative z-10 self-start origin-top rounded-xl border border-slate-200 bg-white p-3 transition-all duration-300 hover:z-30 hover:scale-[1.035] hover:shadow-2xl">
      <div className="relative">
        <Link href={`/product/${product.slug}`} className="block">
          <div className="relative aspect-square overflow-hidden rounded-md bg-slate-100">
            {isMarkedOutOfStock ? (
              <span className="pointer-events-none absolute left-2 top-2 z-20 rounded-sm bg-red-600 px-2 py-1 text-[10px] font-semibold tracking-[0.08em] text-white">
                OUT OF STOCK
              </span>
            ) : isSold ? (
              <span className="pointer-events-none absolute -left-9 top-4 z-20 w-28 -rotate-45 bg-red-600 px-0.5 py-1 text-center text-[10px] font-semibold tracking-[0.18em] text-white">
                SOLD
              </span>
            ) : hasDiscount && discountPercent > 0 ? (
              <span className="pointer-events-none absolute -left-9 top-4 z-20 w-28 -rotate-45 bg-yellow-300 px-0.5 py-1 text-center text-[10px] font-semibold tracking-[0.05em] text-slate-900">
                {discountPercent}% OFF
              </span>
            ) : null}
            <StorefrontProductImage
              candidates={[...imageCandidates, ...largeCandidates]}
              alt={mainImageAlt}
              width={640}
              height={640}
              sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
              className="h-full w-full object-contain object-center transition-transform duration-300 group-hover/card:scale-105"
            />
            <div className="pointer-events-none absolute inset-0 bg-black/20 opacity-0 transition-opacity duration-300 group-hover/card:opacity-100" />
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

      <div className="pt-3 text-center">
        <p className="truncate text-lg font-serif font-bold text-slate-900">{product.title}</p>
        <p className="mt-1 text-sm text-slate-500">{categoryText}</p>
        <div className="mt-2 flex items-center justify-center gap-2">
          <span className="text-xl font-bold text-emerald-700">{formatCurrency(product.price, currencySettings)}</span>
          {product.compareAtPrice && product.compareAtPrice > product.price ? (
            <span className="text-sm text-slate-400 line-through">{formatCurrency(product.compareAtPrice, currencySettings)}</span>
          ) : null}
        </div>
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{shortDescription}</p>
      </div>
    </div>
  )
}
