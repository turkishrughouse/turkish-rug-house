"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { Heart, ChevronLeft, ChevronRight, Facebook, Linkedin, Send } from "lucide-react"
import { toast } from "sonner"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { addToCart } from "@/lib/storefront/cart"
import { addEngagementItem } from "@/lib/storefront/engagement"
import { buildProductImageAlt, getProductImageUrl, parseProductImageRecords } from "@/lib/product-images"
import { useStorefrontCurrency } from "@/components/storefront/currency-provider"

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

function parseImages(images: string) {
  return parseProductImageRecords(images)
}

function stripHtml(input: string | null | undefined) {
  if (!input) return ""
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

export function CategoryHoverProductCard({ product }: { product: ProductCardData }) {
  const router = useRouter()
  const { formatUsd } = useStorefrontCurrency()
  const [quickViewOpen, setQuickViewOpen] = useState(false)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [qty, setQty] = useState(1)

  const gallery = useMemo(() => {
    const arr = parseImages(product.images)
    return arr.length ? arr : [{ image_url: "/placeholder.jpg", variants: { thumb: "/placeholder.jpg", large: "/placeholder.jpg", master: "/placeholder.jpg" } }]
  }, [product.images])

  const mainImage = getProductImageUrl(gallery[0], "large") || "/placeholder.jpg"
  const mainImageAlt = buildProductImageAlt({
    title: product.title,
    fallbackAlt: gallery[0]?.alt,
    categories: product.categories,
  })
  const stockCount = Math.max(0, product.stockCount ?? 999)
  const canBuy = (product.isStock ?? true) && stockCount > 0
  const isMarkedOutOfStock = product.isStock === false && stockCount > 0
  const isSold = stockCount <= 0
  const hasDiscount = Boolean(product.compareAtPrice && product.compareAtPrice > product.price)
  const discountPercent = hasDiscount
    ? Math.round((((product.compareAtPrice as number) - product.price) / (product.compareAtPrice as number)) * 100)
    : 0
  const shortDescription = (
    stripHtml(product.description) || "Premium handcrafted product with quality materials and authentic details."
  ).slice(0, 140)
  const fullDescription = stripHtml(product.description) || "Premium handcrafted product with quality materials and authentic details."
  const categoryText = product.categories?.slice(0, 2).map((c) => c.title).join(", ") || "Rug House"

  const nextImage = () => {
    setActiveImageIndex((prev) => (prev + 1) % gallery.length)
  }

  const prevImage = () => {
    setActiveImageIndex((prev) => (prev - 1 + gallery.length) % gallery.length)
  }

  const addBasket = (quantity: number) => {
    if (!canBuy) {
      toast.error("This product is out of stock.")
      return false
    }
    const result = addToCart({
      productId: product.id,
      slug: product.slug,
      title: product.title,
      price: product.price,
      compareAtPrice: product.compareAtPrice || null,
      image: getProductImageUrl(gallery[activeImageIndex], "large") || mainImage,
      stockCount,
      quantity,
    })
    if (!result.ok) {
      toast.error(result.message)
      return false
    }
    toast.success("Added to basket")
    return true
  }

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/product/${product.slug}` : `/product/${product.slug}`

  const openShare = (url: string) => {
    if (typeof window === "undefined") return
    window.open(url, "_blank", "noopener,noreferrer")
  }

  const handleBuyNow = () => {
    const added = addBasket(qty)
    if (!added) return
    setQuickViewOpen(false)
    router.push("/basket")
  }

  return (
    <>
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
              <img
                src={mainImage}
                alt={mainImageAlt}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-contain object-center transition-transform duration-300 group-hover/card:scale-105"
              />
              <div className="pointer-events-none absolute inset-0 bg-black/20 opacity-0 transition-opacity duration-300 group-hover/card:opacity-100" />
            </div>
          </Link>

          <button
            type="button"
            className="absolute bottom-3 left-1/2 z-30 h-9 -translate-x-1/2 rounded-md border border-white/70 bg-white/85 px-4 text-xs font-semibold tracking-wide text-slate-900 opacity-0 shadow-sm backdrop-blur-[1px] transition-all duration-300 hover:bg-white group-hover/card:opacity-100"
            onClick={() => {
              setActiveImageIndex(0)
              setQuickViewOpen(true)
            }}
            aria-label="Quick view"
          >
            Quick View
          </button>

          <button
            type="button"
            className="absolute right-3 top-3 z-30 inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/60 bg-white/80 text-slate-700 opacity-0 transition-all duration-300 hover:bg-white group-hover/card:opacity-100"
            onClick={() => {
              const result = addEngagementItem("rughouse_wishlist", {
                productId: product.id,
                slug: product.slug,
                title: product.title,
                image: mainImage,
                price: product.price,
              })
              if (result.added) toast.success("Added to wishlist")
              else toast.info("Already in wishlist")
            }}
            aria-label="Add to wishlist"
          >
            <Heart className="h-4 w-4" />
          </button>
        </div>

        <div className="pt-3 text-center">
          <p className="truncate text-lg font-serif font-bold text-slate-900">{product.title}</p>
          <p className="mt-1 text-sm text-slate-500">{categoryText}</p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="text-xl font-bold text-emerald-700">{formatUsd(product.price)}</span>
            {product.compareAtPrice && product.compareAtPrice > product.price ? (
              <span className="text-sm text-slate-400 line-through">{formatUsd(product.compareAtPrice)}</span>
            ) : null}
          </div>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{shortDescription}</p>
        </div>
      </div>

      <Dialog open={quickViewOpen} onOpenChange={setQuickViewOpen}>
        <DialogContent className="w-[min(97vw,1280px)] max-w-[1280px] max-h-[88vh] overflow-hidden border-[#dce3ed] bg-white p-0">
          <DialogTitle className="sr-only">Quick View - {product.title}</DialogTitle>
          <div className="grid max-h-[88vh] grid-cols-1 md:grid-cols-[1fr_1.3fr]">
            <div className="relative border-r border-slate-200 p-6">
              <div className="group/quick relative aspect-[4/5] overflow-hidden rounded-md bg-slate-50">
                <img
                  src={getProductImageUrl(gallery[activeImageIndex], "large") || mainImage}
                  alt={buildProductImageAlt({
                    title: product.title,
                    fallbackAlt: gallery[activeImageIndex]?.alt,
                    categories: product.categories,
                    index: activeImageIndex,
                  })}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />

                <Link
                  href={`/product/${product.slug}`}
                  className="absolute inset-x-4 bottom-4 inline-flex h-10 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white opacity-0 transition-opacity duration-200 hover:bg-emerald-800 group-hover/quick:opacity-100"
                  onClick={() => setQuickViewOpen(false)}
                >
                  View Details
                </Link>

                {gallery.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={prevImage}
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-800 shadow hover:bg-white"
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={nextImage}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-800 shadow hover:bg-white"
                      aria-label="Next image"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                ) : null}
              </div>

            </div>

            <div className="max-h-[88vh] overflow-y-auto p-4 sm:p-6">
              <h3 className="text-3xl leading-[1.1] font-bold text-slate-900 sm:text-[42px]">{product.title}</h3>
              <p className="mt-3 text-3xl font-bold text-emerald-700 sm:text-4xl">{formatUsd(product.price)}</p>

              <p className="mt-4 line-clamp-5 text-slate-600 leading-7">
                {fullDescription}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Full description is available on <span className="font-semibold">Select / View Details</span>.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="h-11 w-11 rounded border border-slate-200 bg-white text-xl text-slate-700 hover:bg-slate-50"
                  onClick={() => setQty((prev) => Math.max(1, prev - 1))}
                >
                  -
                </button>
                <input
                  className="h-11 w-14 rounded border border-slate-200 text-center text-base text-slate-900"
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Number(e.target.value || 1)))}
                />
                <button
                  type="button"
                  className="h-11 w-11 rounded border border-slate-200 bg-white text-xl text-slate-700 hover:bg-slate-50"
                  onClick={() => setQty((prev) => Math.min(stockCount, prev + 1))}
                >
                  +
                </button>
                <button
                  type="button"
                  className="h-11 min-w-[120px] flex-1 whitespace-nowrap rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 sm:ml-2 sm:min-w-[140px] sm:flex-none sm:px-6"
                  disabled={!canBuy}
                  onClick={() => addBasket(qty)}
                >
                  Add to Cart
                </button>
                <button
                  type="button"
                  className="h-11 min-w-[120px] flex-1 whitespace-nowrap rounded-md border border-slate-900 bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none sm:px-5"
                  disabled={!canBuy}
                  onClick={handleBuyNow}
                >
                  Buy Now
                </button>
              </div>

              <div className="mt-5 border-t border-slate-200 pt-4 text-sm text-slate-700">
                <span className="font-semibold text-slate-900">Categories:</span>{" "}
                {product.categories?.length
                  ? product.categories.map((cat, i) => (
                    <span key={cat.id}>
                      <Link href={`/category/${cat.slug}`} className="hover:underline" onClick={() => setQuickViewOpen(false)}>
                        {cat.title}
                      </Link>
                      {i < product.categories!.length - 1 ? ", " : ""}
                    </span>
                  ))
                  : "Uncategorized"}
              </div>

              <div className="mt-4 flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-900">Share:</span>
                <button type="button" onClick={() => openShare(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`)} className="text-[#1877F2] hover:scale-105 transition-transform">
                  <Facebook className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => openShare(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`)} className="text-[#0A66C2] hover:scale-105 transition-transform">
                  <Linkedin className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => openShare(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(product.title)}`)} className="text-[#0088cc] hover:scale-105 transition-transform">
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
