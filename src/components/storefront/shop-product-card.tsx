"use client"

import Link from "next/link"
import { Heart, Search, ShoppingCart, Shuffle } from "lucide-react"
import { toast } from "sonner"
import { addToCart } from "@/lib/storefront/cart"
import { addEngagementItem } from "@/lib/storefront/engagement"
import { ProductRatingBadge } from "@/components/storefront/product-rating-badge"
import { formatCurrency, type CurrencySettings } from "@/lib/storefront/currency"
import { parseProductImages } from "@/lib/product-images"

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

function parseImages(images: string) {
  return parseProductImages(images)
}

export function ShopProductCard({
  product,
  catalogMode = false,
  currencySettings,
}: {
  product: ShopProduct
  catalogMode?: boolean
  currencySettings?: CurrencySettings
}) {
  const images = parseImages(product.images)
  const mainImage = images[0] || "/placeholder.jpg"
  const stockCount = Math.max(0, product.stockCount ?? 999)
  const canBuy = !catalogMode && (product.isStock ?? true) && stockCount > 0
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
        <img
          src={mainImage}
          alt={product.title}
          className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute left-1/2 bottom-4 -translate-x-1/2 translate-y-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white/95 px-2 py-1.5 shadow-lg backdrop-blur">
            {!catalogMode ? (
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  if (!canBuy) {
                    toast.error("This product is out of stock.")
                    return
                  }
                  const result = addToCart({
                    productId: product.id,
                    slug: product.slug,
                    title: product.title,
                    price: product.price,
                    compareAtPrice: product.compareAtPrice || null,
                    image: mainImage,
                    stockCount,
                    quantity: 1,
                  })
                  if (!result.ok) {
                    toast.error(result.message)
                    return
                  }
                  toast.success("Added to basket")
                }}
                aria-label="Add to basket"
              >
                <ShoppingCart className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                window.location.assign(`/product/${product.slug}`)
              }}
              aria-label="View product"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                const result = addEngagementItem("rughouse_compare", {
                  productId: product.id,
                  slug: product.slug,
                  title: product.title,
                  image: mainImage,
                  price: product.price,
                })
                if (result.added) {
                  toast.success("Added to compare")
                } else {
                  toast.info("Already in compare list")
                }
              }}
              aria-label="Add to compare"
            >
              <Shuffle className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                const result = addEngagementItem("rughouse_wishlist", {
                  productId: product.id,
                  slug: product.slug,
                  title: product.title,
                  image: mainImage,
                  price: product.price,
                })
                if (result.added) {
                  toast.success("Added to wishlist")
                } else {
                  toast.info("Already in wishlist")
                }
              }}
              aria-label="Add to wishlist"
            >
              <Heart className="h-4 w-4" />
            </button>
          </div>
        </div>
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
