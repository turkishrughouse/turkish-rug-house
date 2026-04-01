"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Heart, ChevronLeft, ChevronRight, Facebook, Linkedin, Send } from "lucide-react"
import { toast } from "sonner"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { addToCart } from "@/lib/storefront/cart"
import { addEngagementItem } from "@/lib/storefront/engagement"
import { formatCurrency, type CurrencySettings } from "@/lib/storefront/currency"
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

type ClientOverlayProduct = ProductCardData & {
  mainImage?: string
  primaryLargeImage?: string
  currencySettings?: CurrencySettings
}

function parseImages(images: string) {
  return parseProductImageRecords(images)
}

function stripHtml(input: string | null | undefined) {
  if (!input) return ""
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

export function CategoryHoverProductCard({ product }: { product: ProductCardData }) {
  const { formatUsd } = useStorefrontCurrency()
  const gallery = useMemo(() => {
    const arr = parseImages(product.images)
    return arr.length
      ? arr
      : [{ image_url: "/placeholder.jpg", variants: { thumb: "/placeholder.jpg", large: "/placeholder.jpg", master: "/placeholder.jpg" } }]
  }, [product.images])
  const mainImage = getProductImageUrl(gallery[0], "large") || "/placeholder.jpg"
  const primaryLargeImage = getProductImageUrl(gallery[0], "large") || "/placeholder.jpg"
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
    <div className="group/card relative z-10 flex h-full origin-top flex-col rounded-xl border border-slate-200 bg-white p-3 transition-all duration-300 hover:z-30 hover:scale-[1.02] hover:shadow-2xl">
      <div className="relative">
        <Link href={`/product/${product.slug}`} className="block">
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-md bg-slate-50 p-4 sm:p-5">
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

        <CategoryHoverProductCardClient
          product={{
            ...product,
            stockCount,
            mainImage,
            primaryLargeImage,
          }}
        />
      </div>

      <div className="flex flex-1 flex-col pt-3 text-center">
        <Link href={`/product/${product.slug}`} className="block">
          <p className="min-h-[3.5rem] line-clamp-2 text-base font-serif font-bold leading-7 text-slate-900 transition-colors group-hover/card:text-slate-700 sm:text-lg">
            {product.title}
          </p>
        </Link>
        <p className="mt-1 min-h-[2.5rem] line-clamp-2 text-xs leading-5 text-slate-500 sm:text-sm">{categoryText}</p>
        <div className="mt-2 flex min-h-[2rem] items-start justify-center gap-2">
          <span className="text-lg font-bold text-emerald-700 sm:text-xl">{formatUsd(product.price)}</span>
          {product.compareAtPrice && product.compareAtPrice > product.price ? (
            <span className="text-sm text-slate-400 line-through">{formatUsd(product.compareAtPrice)}</span>
          ) : null}
        </div>
        <p className="mt-2 min-h-[3.75rem] line-clamp-3 text-xs leading-5 text-slate-600">{shortDescription}</p>
      </div>
    </div>
  )
}

export function CategoryHoverProductCardClient({ product }: { product: ClientOverlayProduct }) {
  const router = useRouter()
  const currency = useStorefrontCurrency()
  const [desktopQuickViewEnabled, setDesktopQuickViewEnabled] = useState(false)
  const [quickViewOpen, setQuickViewOpen] = useState(false)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [qty, setQty] = useState(1)

  const gallery = useMemo(() => {
    const arr = parseImages(product.images)
    return arr.length
      ? arr
      : [{ image_url: "/placeholder.jpg", variants: { thumb: "/placeholder.jpg", large: "/placeholder.jpg", master: "/placeholder.jpg" } }]
  }, [product.images])

  const stockCount = Math.max(0, product.stockCount ?? 999)
  const canBuy = (product.isStock ?? true) && stockCount > 0
  const mainImage = product.mainImage || getProductImageUrl(gallery[0], "large") || "/placeholder.jpg"
  const primaryLargeImage = product.primaryLargeImage || getProductImageUrl(gallery[0], "large") || "/placeholder.jpg"
  const fullDescription = stripHtml(product.description) || "Premium handcrafted product with quality materials and authentic details."
  const hasDiscount = Boolean(product.compareAtPrice && product.compareAtPrice > product.price)
  const discountPercent = hasDiscount
    ? Math.round((((product.compareAtPrice as number) - product.price) / (product.compareAtPrice as number)) * 100)
    : 0
  const categoryText = product.categories?.slice(0, 2).map((c) => c.title).join(", ") || "Turkish Rug House"
  const formatPrice = (amount: number) =>
    product.currencySettings ? formatCurrency(amount, product.currencySettings) : currency.formatUsd(amount)

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
      image: getProductImageUrl(gallery[activeImageIndex], "large") || primaryLargeImage,
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

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return

    const mediaQuery = window.matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)")
    const sync = () => {
      setDesktopQuickViewEnabled(mediaQuery.matches)
      if (!mediaQuery.matches) setQuickViewOpen(false)
    }

    sync()

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", sync)
      return () => mediaQuery.removeEventListener("change", sync)
    }

    mediaQuery.addListener(sync)
    return () => mediaQuery.removeListener(sync)
  }, [])

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
      {desktopQuickViewEnabled ? (
        <button
          type="button"
          className="absolute bottom-3 left-1/2 z-30 h-9 -translate-x-1/2 rounded-md border border-white/70 bg-white/85 px-4 text-xs font-semibold tracking-wide text-slate-900 opacity-0 shadow-sm backdrop-blur-[1px] transition-all duration-300 hover:bg-white group-hover/card:opacity-100"
          onClick={() => {
            setActiveImageIndex(0)
            setQty(1)
            setQuickViewOpen(true)
          }}
          aria-label="Quick view"
        >
          Quick View
        </button>
      ) : null}

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

      {desktopQuickViewEnabled ? (
        <Dialog open={quickViewOpen} onOpenChange={setQuickViewOpen}>
          <DialogContent className="z-[9999] w-[92vw] max-w-[760px] max-h-[86vh] overflow-hidden rounded-[28px] border border-[#e7ded2] bg-white p-0 shadow-[0_28px_90px_rgba(15,23,42,0.18)] [&>div]:bg-black/45 [&>button]:right-5 [&>button]:top-5 [&>button]:z-30 [&>button]:flex [&>button]:h-9 [&>button]:w-9 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full [&>button]:border [&>button]:border-[#ddd1c1] [&>button]:bg-white/95 [&>button]:text-slate-700 [&>button]:opacity-100 [&>button]:shadow-sm [&>button]:ring-0 [&>button]:transition-all [&>button]:duration-200 [&>button]:hover:border-slate-300 [&>button]:hover:bg-white [&>button]:hover:text-slate-900 [&>button]:hover:shadow-md [&>button]:focus:ring-2 [&>button]:focus:ring-slate-300 [&>button]:focus:ring-offset-0 [&>button_svg]:h-4 [&>button_svg]:w-4">
            <DialogTitle className="sr-only">Quick View - {product.title}</DialogTitle>
            <div className="grid max-h-[86vh] grid-cols-1 overflow-hidden md:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
            <div className="relative border-b border-[#eee6da] bg-[#fbf8f3] p-6 md:border-b-0 md:border-r">
              <div className="relative overflow-hidden rounded-[22px] border border-[#eee5d9] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
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
                  style={{ width: "100%", height: "auto" }}
                  className="aspect-[4/5] w-full object-contain"
                />

                {gallery.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={prevImage}
                      className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-[#e7ded2] bg-white/95 p-2 text-slate-800 shadow-sm transition-all duration-200 hover:bg-white hover:shadow-md"
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={nextImage}
                      className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-[#e7ded2] bg-white/95 p-2 text-slate-800 shadow-sm transition-all duration-200 hover:bg-white hover:shadow-md"
                      aria-label="Next image"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            <div className="max-h-[86vh] overflow-y-auto bg-white px-6 py-7 sm:px-7 sm:py-8">
              <div className="max-w-[340px]">
                <p className="text-[11px] font-semibold tracking-[0.22em] text-slate-500 uppercase">{categoryText}</p>
                <h3 className="mt-3 pr-10 text-[28px] leading-[1.12] font-semibold text-slate-900 sm:text-[34px]">{product.title}</h3>
                <div className="mt-4 flex items-baseline gap-3">
                  <p className="text-[30px] font-semibold tracking-[-0.02em] text-slate-900 sm:text-[34px]">{formatPrice(product.price)}</p>
                  {hasDiscount ? (
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-amber-700 uppercase">
                      {discountPercent}% off
                    </span>
                  ) : null}
                </div>
              </div>

              <p className="mt-5 max-w-[36ch] line-clamp-5 text-sm leading-7 text-slate-600">
                {fullDescription}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Full description is available on <span className="font-semibold">Select / View Details</span>.
              </p>

              <div className="mt-7 rounded-[22px] border border-[#ece4d8] bg-[#fcfaf7] p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">Quantity</p>
                    <p className="mt-1 text-sm text-slate-600">{stockCount > 1 ? `${stockCount} pieces ready to ship` : "Single piece available"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-[#ddd4c8] bg-white text-xl text-slate-700 transition-colors hover:bg-slate-50"
                      onClick={() => setQty((prev) => Math.max(1, prev - 1))}
                    >
                      -
                    </button>
                    <input
                      className="h-11 w-16 rounded-full border border-[#ddd4c8] bg-white text-center text-base font-medium text-slate-900"
                      value={qty}
                      onChange={(e) => setQty(Math.max(1, Number(e.target.value || 1)))}
                    />
                    <button
                      type="button"
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-[#ddd4c8] bg-white text-xl text-slate-700 transition-colors hover:bg-slate-50"
                      onClick={() => setQty((prev) => Math.min(stockCount, prev + 1))}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    className="h-12 rounded-full bg-slate-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!canBuy}
                    onClick={() => addBasket(qty)}
                  >
                    Add to Cart
                  </button>
                  <button
                    type="button"
                    className="h-12 rounded-full border border-slate-900 bg-white px-5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!canBuy}
                    onClick={handleBuyNow}
                  >
                    Buy Now
                  </button>
                </div>

                <Link
                  href={`/product/${product.slug}`}
                  className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-full border border-[#ddd4c8] bg-white px-5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50"
                  onClick={() => setQuickViewOpen(false)}
                >
                  View Details
                </Link>
              </div>

              <div className="mt-6 border-t border-[#eee6da] pt-5 text-sm leading-7 text-slate-700">
                <span className="font-semibold tracking-[0.12em] text-slate-500 uppercase">Categories</span>
                <div className="mt-2">
                {product.categories?.length
                  ? product.categories.map((cat, i) => (
                      <span key={cat.id}>
                        <Link href={`/category/${cat.slug}`} className="hover:underline" onClick={() => setQuickViewOpen(false)}>
                          {cat.title}
                        </Link>
                        {i < (product.categories?.length || 0) - 1 ? ", " : ""}
                      </span>
                    ))
                  : "Uncategorized"}
                </div>
              </div>

              <div className="mt-6 flex items-center gap-3 border-t border-[#eee6da] pt-5">
                <span className="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">Share</span>
                <button type="button" onClick={() => openShare(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`)} className="text-[#1877F2] transition-transform hover:scale-105">
                  <Facebook className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => openShare(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`)} className="text-[#0A66C2] transition-transform hover:scale-105">
                  <Linkedin className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => openShare(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(product.title)}`)} className="text-[#0088cc] transition-transform hover:scale-105">
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}
