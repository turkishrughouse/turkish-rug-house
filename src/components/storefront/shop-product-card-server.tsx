import Link from "next/link"

import { ProductRatingBadge } from "@/components/storefront/product-rating-badge"
import { ShopProductCardActions } from "@/components/storefront/shop-product-card"
import { StorefrontProductImage } from "@/components/storefront/storefront-product-image"
import { formatCurrency, type CurrencySettings } from "@/lib/storefront/currency"
import { buildProductImageAlt, getPrimaryProductImage, getPrimaryProductImageCandidates, parseProductImageRecords } from "@/lib/product-images"

type ShopProduct = {
  id: string
  title: string
  slug: string
  price: number
  compareAtPrice?: number | null
  images: string
  stockCount?: number
  isStock?: boolean
}

export function ShopProductCardServer({
  product,
  catalogMode = false,
  currencySettings,
}: {
  product: ShopProduct
  catalogMode?: boolean
  currencySettings?: CurrencySettings
}) {
  const images = parseProductImageRecords(product.images)
  const displayImageCandidates = getPrimaryProductImageCandidates(product.images)
  const storedImage = getPrimaryProductImage(product.images)
  const mainImageAlt = buildProductImageAlt({ title: product.title, fallbackAlt: images[0]?.alt })
  const stockCount = Math.max(0, product.stockCount ?? 999)
  const isMarkedOutOfStock = product.isStock === false && stockCount > 0
  const isSold = stockCount <= 0
  const hasDiscount = Boolean(product.compareAtPrice && product.compareAtPrice > product.price)
  const discountPercent = hasDiscount
    ? Math.round((((product.compareAtPrice as number) - product.price) / (product.compareAtPrice as number)) * 100)
    : 0

  return (
    <Link href={`/product/${product.slug}`} className="group block">
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg bg-slate-100">
        <ProductRatingBadge productId={product.id} />
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
          candidates={displayImageCandidates}
          alt={mainImageAlt}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover object-center transition-transform duration-300 group-hover:scale-105"
        />
        <ShopProductCardActions
          catalogMode={catalogMode}
          product={{
            id: product.id,
            slug: product.slug,
            title: product.title,
            price: product.price,
            compareAtPrice: product.compareAtPrice,
            storedImage,
            stockCount,
            canBuy: !catalogMode && (product.isStock ?? true) && stockCount > 0,
          }}
        />
      </div>

      <div className="mt-4 space-y-1">
        <h3 className="line-clamp-1 text-sm font-medium text-slate-900 transition-colors group-hover:text-teal-700">
          {product.title}
        </h3>
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-900">{formatCurrency(product.price, currencySettings)}</p>
          {product.compareAtPrice && product.compareAtPrice > product.price ? (
            <p className="text-xs text-slate-500 line-through">{formatCurrency(product.compareAtPrice, currencySettings)}</p>
          ) : null}
        </div>
      </div>
    </Link>
  )
}
