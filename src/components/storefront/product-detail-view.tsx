"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronLeft, ChevronRight, Grid2x2, Facebook, Linkedin, Send, Heart, Shuffle, X, Instagram, MessageCircle } from "lucide-react"
import { addToCart } from "@/lib/storefront/cart"
import { addEngagementItem } from "@/lib/storefront/engagement"
import { ProductRatingBadge } from "@/components/storefront/product-rating-badge"
import { buildProductImageAlt, getProductImageUrl, parseProductImageRecords } from "@/lib/product-images"
import { CategoryHoverProductCard } from "@/components/storefront/category-hover-product-card"

type ProductCategory = {
  id: string
  title: string
  slug: string
  path?: string
}

type ProductDetail = {
  id: string
  slug: string
  sku: string | null
  customAttributes?: Array<{ name: string; values: string[]; visible: boolean }>
  title: string
  description: string | null
  seoDescription: string | null
  price: number
  compareAtPrice: number | null
  isStock: boolean
  stockCount: number
  images: string
  categories: ProductCategory[]
}

type RelatedProduct = {
  id: string
  slug: string
  title: string
  description?: string | null
  price: number
  compareAtPrice: number | null
  images: string
  stockCount?: number
  isStock?: boolean
  categories?: Array<{ id: string; title: string; slug: string }>
}

type NavProduct = {
  slug: string
  title: string
  price: number
  compareAtPrice: number | null
  images: string
}

function parseImages(images: string): string[] {
  return parseProductImageRecords(images).map((image) => getProductImageUrl(image, "large"))
}

function stripHtml(input: string | null | undefined): string {
  if (!input) return ""
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function sanitizeRichContent(input: string | null | undefined): string {
  if (!input || input.trim().length === 0) return ""
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")
}

function looksBrokenHtml(input: string): boolean {
  if (!input) return false
  const tableOpen = (input.match(/<table\b/gi) || []).length
  const tableClose = (input.match(/<\/table>/gi) || []).length
  if (tableOpen !== tableClose) return true

  const trOpen = (input.match(/<tr\b/gi) || []).length
  const trClose = (input.match(/<\/tr>/gi) || []).length
  if (trOpen !== trClose) return true

  const tdOpen = (input.match(/<td\b/gi) || []).length
  const tdClose = (input.match(/<\/td>/gi) || []).length
  if (tdOpen !== tdClose) return true

  return false
}

const richContentClassName = [
  "text-sm leading-6 text-slate-700",
  "[&_p]:mb-3 [&_p:last-child]:mb-0",
  "[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6",
  "[&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6",
  "[&_li]:mb-1",
  "[&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-4 [&_blockquote]:italic",
  "[&_a]:text-emerald-700 [&_a]:underline",
  "[&_hr]:my-4 [&_hr]:border-slate-200",
  "[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse",
  "[&_th]:border [&_th]:border-[#d6dde7] [&_th]:bg-slate-100 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold",
  "[&_td]:border [&_td]:border-[#d6dde7] [&_td]:px-3 [&_td]:py-2",
].join(" ")

export function ProductDetailView({
  product,
  relatedProducts,
  previousProduct,
  nextProduct,
  shippingContent,
}: {
  product: ProductDetail
  relatedProducts: RelatedProduct[]
  previousProduct?: NavProduct | null
  nextProduct?: NavProduct | null
  shippingContent?: string | null
}) {
  const router = useRouter()
  const gallery = useMemo(() => {
    const records = parseProductImageRecords(product.images)
    if (records.length === 0) {
      return [
        {
          src: "/placeholder.jpg",
          zoomSrc: "/placeholder.jpg",
          thumbSrc: "/placeholder.jpg",
          alt: buildProductImageAlt({
            title: product.title,
            categories: product.categories,
            customAttributes: product.customAttributes,
          }),
          width: 1200,
          height: 1200,
        },
      ]
    }

    return records.map((image, index) => ({
      src: getProductImageUrl(image, "large") || "/placeholder.jpg",
      zoomSrc: getProductImageUrl(image, "master") || getProductImageUrl(image, "large") || "/placeholder.jpg",
      thumbSrc: getProductImageUrl(image, "thumb") || getProductImageUrl(image, "large") || "/placeholder.jpg",
      alt: buildProductImageAlt({
        title: product.title,
        fallbackAlt: image.alt,
        categories: product.categories,
        customAttributes: product.customAttributes,
        index,
      }),
      width: image.width ?? 1200,
      height: image.height ?? 1200,
    }))
  }, [product.images, product.title, product.categories, product.customAttributes])

  const [selectedImage, setSelectedImage] = useState(0)
  const [qty, setQty] = useState(1)
  const [imageLightboxOpen, setImageLightboxOpen] = useState(false)
  const [hoverZoomEnabled, setHoverZoomEnabled] = useState(false)
  const [zoomOrigin, setZoomOrigin] = useState("50% 50%")
  const [expandedDesc, setExpandedDesc] = useState(false)
  const [expandedBottomDesc, setExpandedBottomDesc] = useState(false)
  const [expandedShipping, setExpandedShipping] = useState(false)
  const [activeInfoTab, setActiveInfoTab] = useState<"description" | "shipping" | "attributes">("description")
  const [askQuestionOpen, setAskQuestionOpen] = useState(false)
  const [askSubmitting, setAskSubmitting] = useState(false)
  const [askForm, setAskForm] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  })

  const verticalThumbs = gallery.slice(0, 5)
  const bottomThumbs = gallery.slice(5)
  const selectedGalleryImage = gallery[selectedImage] || gallery[0]

  const discountActive = product.compareAtPrice && product.compareAtPrice > product.price
  const stockLimit = Math.max(0, product.stockCount)
  const safeQty = Math.min(Math.max(0, qty), stockLimit)
  const isMarkedOutOfStock = product.isStock === false && stockLimit > 0
  const isSold = stockLimit <= 0
  const discountPercent = discountActive
    ? Math.round((((product.compareAtPrice as number) - product.price) / (product.compareAtPrice as number)) * 100)
    : 0
  const primaryCategory = product.categories[0]
  const shortDescriptionHtml = sanitizeRichContent(product.seoDescription)
  const longDescriptionHtml = sanitizeRichContent(product.description)
  const descriptionHtml =
    (shortDescriptionHtml && !looksBrokenHtml(shortDescriptionHtml) ? shortDescriptionHtml : "") ||
    longDescriptionHtml ||
    "<p>Premium hand-crafted product detail text will appear here.</p>"
  const descriptionTextLength = stripHtml(descriptionHtml).length
  const canExpandDescription = descriptionTextLength > 320
  const bottomDescriptionHtml = longDescriptionHtml || "<p>Detailed product information is not available yet.</p>"
  const bottomDescriptionTextLength = stripHtml(bottomDescriptionHtml).length
  const canExpandBottomDescription = bottomDescriptionTextLength > 380
  const shippingText = shippingContent && shippingContent.trim().length > 0
    ? stripHtml(shippingContent)
    : "Delivery estimates and shipping details are shown at checkout."
  const canExpandShipping = shippingText.length > 520
  const visibleCategories = product.categories.slice(0, 2)

  useEffect(() => {
    if (typeof window === "undefined") return
    const storageKey = "rughouse_recently_viewed_products"
    const image = gallery[0]?.src || "/placeholder.jpg"
    const current = {
      id: product.id,
      slug: product.slug,
      title: product.title,
      image,
      price: Number(product.price || 0),
    }
    try {
      const raw = window.localStorage.getItem(storageKey)
      const parsed = raw ? JSON.parse(raw) : []
      const safe = Array.isArray(parsed) ? parsed : []
      const merged = [current, ...safe.filter((item) => item && item.id !== current.id)].slice(0, 3)
      window.localStorage.setItem(storageKey, JSON.stringify(merged))
      window.dispatchEvent(new CustomEvent("rughouse:recently-viewed-updated"))
    } catch {
      // Do not block product page on localStorage errors.
    }
  }, [product.id, product.slug, product.title, product.price, gallery])

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return
    const query = window.matchMedia("(hover: hover) and (pointer: fine)")
    const sync = () => setHoverZoomEnabled(query.matches)
    sync()
    query.addEventListener?.("change", sync)
    return () => query.removeEventListener?.("change", sync)
  }, [])


  useEffect(() => {
    if (!imageLightboxOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setImageLightboxOpen(false)
      if (event.key === "ArrowRight") setSelectedImage((prev) => (prev + 1) % gallery.length)
      if (event.key === "ArrowLeft") setSelectedImage((prev) => (prev - 1 + gallery.length) % gallery.length)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [imageLightboxOpen, gallery.length])

  const openShare = (url: string) => {
    if (typeof window === "undefined") return
    window.open(url, "_blank", "noopener,noreferrer,width=720,height=640")
  }

  const getShareUrl = () => {
    if (typeof window === "undefined") return ""
    return window.location.href
  }

  const handleAddToBasket = () => {
    if (product.stockCount <= 0 || !product.isStock) {
      toast.error("This product is out of stock.")
      return
    }
    if (safeQty <= 0) {
      toast.error("Quantity must be at least 1.")
      return
    }
    const result = addToCart({
      productId: product.id,
      slug: product.slug,
      title: product.title,
      sku: product.sku,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      image: gallery[0]?.src || "/placeholder.jpg",
      stockCount: product.stockCount,
      quantity: safeQty,
    })
    if (!result.ok) {
      toast.error(result.message)
      return
    }
    toast.success(`Added ${safeQty} item(s) to basket`)
  }

  const handleBuyNow = () => {
    if (product.stockCount <= 0 || !product.isStock) {
      toast.error("This product is out of stock.")
      return
    }
    if (safeQty <= 0) {
      toast.error("Quantity must be at least 1.")
      return
    }
    const result = addToCart({
      productId: product.id,
      slug: product.slug,
      title: product.title,
      sku: product.sku,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      image: gallery[0]?.src || "/placeholder.jpg",
      stockCount: product.stockCount,
      quantity: safeQty,
    })
    if (!result.ok) {
      toast.error(result.message)
      return
    }
    router.push("/basket")
  }

  const submitAskQuestion = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const name = askForm.name.trim()
    const email = askForm.email.trim()
    const messageBody = askForm.message.trim()
    if (!name || !email || messageBody.length < 10) {
      toast.error("Please fill required fields. Message must be at least 10 characters.")
      return
    }

    const productUrl = typeof window !== "undefined" ? window.location.href : `/product/${product.slug}`
    const composedMessage = [
      `Product: ${product.title}`,
      `Product URL: ${productUrl}`,
      "",
      messageBody,
    ].join("\n")

    try {
      setAskSubmitting(true)
      const response = await fetch("/api/messages/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone: askForm.phone.trim(),
          subject: `Product question - ${product.title}`,
          message: composedMessage,
        }),
      })
      const payload = await response.json().catch(() => null as null | { error?: string })
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to send your question.")
      }
      toast.success("Your question has been sent.")
      setAskQuestionOpen(false)
      setAskForm({ name: "", email: "", phone: "", message: "" })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send your question.")
    } finally {
      setAskSubmitting(false)
    }
  }

  return (
    <div className="bg-white min-h-screen pb-20">
      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="text-sm text-slate-500">
            <Link href="/" className="hover:text-slate-800">Home</Link>
            <span className="mx-2">/</span>
            {primaryCategory ? (
              <>
                <Link href={primaryCategory.path || `/${primaryCategory.slug}`} className="hover:text-slate-800">{primaryCategory.title}</Link>
                <span className="mx-2">/</span>
              </>
            ) : null}
            <span className="text-slate-900 font-medium">{product.title}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="group relative">
              {previousProduct ? (
                <Link href={`/product/${previousProduct.slug}`} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#dce3ed] bg-white text-slate-700 hover:bg-slate-50">
                  <ChevronLeft className="h-5 w-5" />
                </Link>
              ) : (
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#e5e9ef] bg-slate-100 text-slate-300">
                  <ChevronLeft className="h-5 w-5" />
                </span>
              )}
              {previousProduct ? (
                <div className="pointer-events-none absolute right-0 top-11 z-50 hidden w-64 rounded-md border border-[#dce3ed] bg-white p-3 shadow-[0_14px_34px_rgba(15,23,42,0.14)] group-hover:block">
                  <div className="flex items-center gap-3">
                    <img src={parseImages(previousProduct.images)[0] || "/placeholder.jpg"} alt={previousProduct.title} loading="lazy" decoding="async" className="h-16 w-16 rounded-md border border-[#dce3ed] object-cover" />
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold text-slate-900">{previousProduct.title}</p>
                      <p className="text-xl font-bold text-emerald-700">${previousProduct.price.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#dce3ed] bg-white text-slate-700">
              <Grid2x2 className="h-4 w-4" />
            </span>

            <div className="group relative">
              {nextProduct ? (
                <Link href={`/product/${nextProduct.slug}`} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#dce3ed] bg-white text-slate-700 hover:bg-slate-50">
                  <ChevronRight className="h-5 w-5" />
                </Link>
              ) : (
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#e5e9ef] bg-slate-100 text-slate-300">
                  <ChevronRight className="h-5 w-5" />
                </span>
              )}
              {nextProduct ? (
                <div className="pointer-events-none absolute right-0 top-11 z-50 hidden w-64 rounded-md border border-[#dce3ed] bg-white p-3 shadow-[0_14px_34px_rgba(15,23,42,0.14)] group-hover:block">
                  <div className="flex items-center gap-3">
                    <img src={parseImages(nextProduct.images)[0] || "/placeholder.jpg"} alt={nextProduct.title} loading="lazy" decoding="async" className="h-16 w-16 rounded-md border border-[#dce3ed] object-cover" />
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold text-slate-900">{nextProduct.title}</p>
                      <p className="text-xl font-bold text-emerald-700">${nextProduct.price.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
          <section>
            <div className="grid grid-cols-[72px_minmax(0,1fr)] sm:grid-cols-[92px_minmax(0,1fr)] gap-3 sm:gap-4 items-start">
              <div className="space-y-3">
                {verticalThumbs.map((img, i) => (
                  <button
                    key={`${img.src}-${i}`}
                    type="button"
                    onClick={() => setSelectedImage(i)}
                    className={`block h-14 w-14 sm:h-20 sm:w-20 rounded-md overflow-hidden border ${selectedImage === i ? "border-slate-900" : "border-[#dce3ed]"}`}
                  >
                    <img src={img.thumbSrc} alt={img.alt} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-[#dce3ed] bg-slate-50 p-2">
                <button
                  type="button"
                  className="group relative block aspect-square w-full overflow-hidden rounded-lg bg-white"
                  onMouseMove={(event) => {
                    if (!hoverZoomEnabled) return
                    const bounds = event.currentTarget.getBoundingClientRect()
                    const x = ((event.clientX - bounds.left) / bounds.width) * 100
                    const y = ((event.clientY - bounds.top) / bounds.height) * 100
                    setZoomOrigin(`${x}% ${y}%`)
                  }}
                  onMouseLeave={() => setZoomOrigin("50% 50%")}
                  onClick={() => setImageLightboxOpen(true)}
                >
                  {isMarkedOutOfStock ? (
                    <span className="pointer-events-none absolute left-2 top-2 z-20 rounded-sm bg-red-600 px-2 py-1 text-[10px] font-semibold tracking-[0.08em] text-white">
                      OUT OF STOCK
                    </span>
                  ) : isSold ? (
                    <span className="pointer-events-none absolute -left-9 top-4 z-20 w-28 -rotate-45 bg-red-600 px-0.5 py-1 text-center text-[10px] font-semibold tracking-[0.18em] text-white">
                      SOLD
                    </span>
                  ) : discountPercent > 0 ? (
                    <span className="pointer-events-none absolute -left-9 top-4 z-20 w-28 -rotate-45 bg-yellow-300 px-0.5 py-1 text-center text-[10px] font-semibold tracking-[0.05em] text-slate-900">
                      {discountPercent}% OFF
                    </span>
                  ) : null}
                  <img
                    src={selectedGalleryImage.src}
                    alt={selectedGalleryImage.alt}
                    width={selectedGalleryImage.width}
                    height={selectedGalleryImage.height}
                    loading="eager"
                    fetchPriority="high"
                    decoding="sync"
                    className={`h-full w-full object-cover transition-transform duration-300 ${hoverZoomEnabled ? "group-hover:scale-[1.85] cursor-zoom-in" : "group-hover:scale-105"}`}
                    style={{ transformOrigin: zoomOrigin }}
                  />
                </button>
              </div>
            </div>

            {bottomThumbs.length > 0 ? (
              <div className="grid grid-cols-[72px_minmax(0,1fr)] sm:grid-cols-[92px_minmax(0,1fr)] gap-3 sm:gap-4 mt-4">
                <div />
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {bottomThumbs.map((img, i) => {
                    const idx = i + 5
                    return (
                      <button
                        key={`${img.src}-${idx}`}
                        type="button"
                        onClick={() => setSelectedImage(idx)}
                        className={`block rounded-md overflow-hidden border ${selectedImage === idx ? "border-slate-900" : "border-[#dce3ed]"}`}
                      >
                        <div className="aspect-square">
                          <img src={img.thumbSrc} alt={img.alt} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </section>

          <section>
            <h1 className="font-serif text-3xl leading-tight text-slate-900">{product.title}</h1>
            <div className="mt-4 flex items-center gap-3">
              <span className="text-2xl font-bold text-emerald-700">${product.price.toFixed(2)}</span>
              {discountActive ? (
                <span className="text-base text-slate-400 line-through">${product.compareAtPrice?.toFixed(2)}</span>
              ) : null}
            </div>

            <div className="mt-6">
              <div
                className={`${richContentClassName} ${!expandedDesc && canExpandDescription ? "line-clamp-5" : ""}`}
                dangerouslySetInnerHTML={{ __html: descriptionHtml }}
              />
              {canExpandDescription ? (
                <button
                  type="button"
                  onClick={() => setExpandedDesc((prev) => !prev)}
                  className="mt-2 text-sm font-medium text-emerald-700 hover:underline"
                >
                  {expandedDesc ? "Show less" : "See more"}
                </button>
              ) : null}
            </div>

            <div className="mt-7 border-y border-[#e6edf5]">
              <div className="grid grid-cols-2 md:flex md:items-center md:gap-8">
                {[
                  { icon: "🧿", label: "One Of a Kind" },
                  { icon: "🧶", label: "Handmade" },
                  { icon: "🌿", label: "Natural Fiber" },
                  { icon: "🚚", label: "Free Shipping" },
                ].map((feature, index) => (
                  <div
                    key={feature.label}
                    className={`flex items-center gap-2 px-3 py-3 ${
                      index % 2 === 0 ? "border-r border-[#e6edf5]" : ""
                    } ${index < 2 ? "border-b border-[#e6edf5]" : ""} md:border-0 md:px-0`}
                  >
                    <span className="text-xl leading-none">{feature.icon}</span>
                    <span className="text-[16px] font-normal text-black">{feature.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8">
              <div className="grid grid-cols-1 gap-3 md:hidden">
                <div className="grid grid-cols-[auto_1fr] items-start gap-3">
                  <div>
                    <div className="inline-flex items-center rounded-md border border-[#dce3ed]">
                      <button
                        type="button"
                        className="h-10 w-10 text-base text-slate-600 hover:bg-slate-50"
                        onClick={() => setQty((prev) => Math.max(0, prev - 1))}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={stockLimit}
                        value={safeQty}
                        onChange={(e) => {
                          const raw = Number(e.target.value)
                          const next = Number.isFinite(raw) ? raw : 0
                          setQty(Math.min(Math.max(0, next), stockLimit))
                        }}
                        className="h-10 w-12 border-x border-[#dce3ed] bg-white text-center text-sm"
                      />
                      <button
                        type="button"
                        className="h-10 w-10 text-base text-slate-600 hover:bg-slate-50"
                        onClick={() => setQty((prev) => Math.min(prev + 1, stockLimit))}
                      >
                        +
                      </button>
                    </div>
                    <div className="mt-2 text-xs font-medium text-slate-500">
                      Quantity - {safeQty} - SKU - {product.sku || "-"}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="h-10 rounded-md bg-emerald-600 px-2 text-xs font-semibold text-white hover:bg-emerald-700"
                      onClick={handleAddToBasket}
                    >
                      Add to Basket
                    </button>
                    <button
                      type="button"
                      className="h-10 rounded-md border border-slate-800 bg-slate-900 px-2 text-xs font-semibold text-white hover:bg-slate-800"
                      onClick={handleBuyNow}
                    >
                      Buy Now
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className="h-10 w-full rounded-md border border-emerald-700 bg-white text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                  onClick={() => setAskQuestionOpen(true)}
                >
                  Ask Question
                </button>
              </div>

              <div className="hidden md:block">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="inline-flex items-center rounded-md border border-[#dce3ed]">
                    <button
                      type="button"
                      className="h-10 w-10 text-base text-slate-600 hover:bg-slate-50"
                      onClick={() => setQty((prev) => Math.max(0, prev - 1))}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={stockLimit}
                      value={safeQty}
                      onChange={(e) => {
                        const raw = Number(e.target.value)
                        const next = Number.isFinite(raw) ? raw : 0
                        setQty(Math.min(Math.max(0, next), stockLimit))
                      }}
                      className="h-10 w-12 border-x border-[#dce3ed] bg-white text-center text-sm"
                    />
                    <button
                      type="button"
                      className="h-10 w-10 text-base text-slate-600 hover:bg-slate-50"
                      onClick={() => setQty((prev) => Math.min(prev + 1, stockLimit))}
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    className="h-10 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
                    onClick={handleAddToBasket}
                  >
                    Add to Basket
                  </button>

                  <button
                    type="button"
                    className="h-10 rounded-md border border-slate-800 bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
                    onClick={handleBuyNow}
                  >
                    Buy Now
                  </button>

                  <button
                    type="button"
                    className="h-10 rounded-md border border-emerald-700 bg-white px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                    onClick={() => setAskQuestionOpen(true)}
                  >
                    Ask Question
                  </button>
                </div>
                <div className="mt-2 text-xs font-medium text-slate-500">
                  Quantity - {safeQty} - SKU - {product.sku || "-"}
                </div>
              </div>
            </div>

            <div className="mt-8 border-t border-[#e6edf5] pt-5 text-sm text-slate-700">
              <span className="font-semibold text-slate-900">Category:</span>{" "}
              {visibleCategories.length > 0 ? (
                <>
                  {visibleCategories.map((cat, i) => (
                    <span key={cat.id}>
                      <Link href={cat.path || `/${cat.slug}`} className="text-emerald-700 hover:underline">{cat.title}</Link>
                      {i < visibleCategories.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </>
              ) : (
                <span className="text-slate-500">Uncategorized</span>
              )}
            </div>

            <div className="mt-4 flex items-center gap-6 text-3xl">
              <button
                type="button"
                className="inline-flex items-center gap-2 text-slate-800 hover:text-red-600 hover:underline transition-colors"
                onClick={() => {
                  const res = addEngagementItem("rughouse_compare", {
                    productId: product.id,
                    slug: product.slug,
                    title: product.title,
                    image: gallery[0]?.src || "/placeholder.jpg",
                    price: product.price,
                  })
                  if (res.added) {
                    toast.success("Added to compare")
                  } else {
                    toast.info("Already in compare list")
                  }
                }}
              >
                <Shuffle className="h-5 w-5" />
                <span className="text-sm font-semibold">Compare</span>
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 text-slate-800 hover:text-red-600 hover:underline transition-colors"
                onClick={() => {
                  const res = addEngagementItem("rughouse_wishlist", {
                    productId: product.id,
                    slug: product.slug,
                    title: product.title,
                    image: gallery[0]?.src || "/placeholder.jpg",
                    price: product.price,
                  })
                  if (res.added) {
                    toast.success("Added to wishlist")
                  } else {
                    toast.info("Already in wishlist")
                  }
                }}
              >
                <Heart className="h-5 w-5" />
                <span className="text-sm font-semibold">Add to wishlist</span>
              </button>
            </div>

            <div className="mt-4 flex items-center gap-3 text-slate-700">
              <span className="font-semibold text-slate-900">Share:</span>
              <button
                type="button"
                onClick={() => openShare(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getShareUrl())}`)}
                className="rounded-md border border-[#dce3ed] p-2 text-[#1877F2] hover:bg-slate-50 hover:scale-105 transition-transform"
              >
                <Facebook className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => openShare(`https://twitter.com/intent/tweet?url=${encodeURIComponent(getShareUrl())}&text=${encodeURIComponent(product.title)}`)}
                className="rounded-md border border-[#dce3ed] p-2 text-black hover:bg-slate-50 hover:scale-105 transition-transform"
              >
                <span className="text-sm font-semibold">X</span>
              </button>
              <button
                type="button"
                onClick={() => openShare(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(getShareUrl())}`)}
                className="rounded-md border border-[#dce3ed] p-2 text-[#0A66C2] hover:bg-slate-50 hover:scale-105 transition-transform"
              >
                <Linkedin className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (typeof window === "undefined") return
                  const shareUrl = getShareUrl()
                  try {
                    await navigator.clipboard.writeText(shareUrl)
                    toast.success("Link copied. Paste it on Instagram.")
                  } catch {
                    toast.info("Copy the product URL and paste it on Instagram.")
                  }
                  window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer")
                }}
                className="rounded-md border border-[#dce3ed] p-2 text-[#E4405F] hover:bg-slate-50 hover:scale-105 transition-transform"
              >
                <Instagram className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => openShare(`https://t.me/share/url?url=${encodeURIComponent(getShareUrl())}&text=${encodeURIComponent(product.title)}`)}
                className="rounded-md border border-[#dce3ed] p-2 text-[#0088cc] hover:bg-slate-50 hover:scale-105 transition-transform"
              >
                <Send className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => openShare(`https://api.whatsapp.com/send?text=${encodeURIComponent(`${product.title} ${getShareUrl()}`)}`)}
                className="rounded-md border border-[#dce3ed] p-2 text-[#25D366] hover:bg-slate-50 hover:scale-105 transition-transform"
              >
                <MessageCircle className="h-4 w-4" />
              </button>
            </div>
          </section>
        </div>

        <section className="mt-16 border-t border-[#e6edf5] pt-8">
          <div className="rounded-xl border border-[#dce3ed] bg-white shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <div className="border-b border-[#e6edf5] p-3">
              <div className="grid w-full grid-cols-2 overflow-hidden rounded-lg border border-[#dce3ed] bg-white sm:grid-cols-4">
              <button
                type="button"
                onClick={() => setActiveInfoTab("description")}
                className={`h-11 border-r border-[#dce3ed] px-4 text-sm font-semibold transition-colors ${activeInfoTab === "description" ? "bg-[#3f4b63] text-white" : "bg-transparent text-slate-700 hover:bg-slate-100"}`}
              >
                Description
              </button>
              <button
                type="button"
                onClick={() => setActiveInfoTab("shipping")}
                className={`h-11 border-r border-[#dce3ed] px-4 text-sm font-semibold transition-colors ${activeInfoTab === "shipping" ? "bg-[#3f4b63] text-white" : "bg-transparent text-slate-700 hover:bg-slate-100"}`}
              >
                Shipping & Returns
              </button>
              <button
                type="button"
                onClick={() => setActiveInfoTab("attributes")}
                className={`h-11 px-4 text-sm font-semibold transition-colors ${activeInfoTab === "attributes" ? "bg-[#3f4b63] text-white" : "bg-transparent text-slate-700 hover:bg-slate-100"}`}
              >
                Attributes
              </button>
            </div>
            </div>

            <div className="p-5">
              {activeInfoTab === "description" ? (
                <div>
                  <div
                    className={`${richContentClassName} ${!expandedBottomDesc && canExpandBottomDescription ? "line-clamp-7" : ""}`}
                    dangerouslySetInnerHTML={{ __html: bottomDescriptionHtml }}
                  />
                  {canExpandBottomDescription ? (
                    <button
                      type="button"
                      onClick={() => setExpandedBottomDesc((prev) => !prev)}
                      className="mt-2 text-sm font-medium text-emerald-700 hover:underline"
                    >
                      {expandedBottomDesc ? "Show less" : "See more"}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {activeInfoTab === "shipping" ? (
                <div>
                  <p className={`text-slate-600 leading-6 text-sm ${!expandedShipping && canExpandShipping ? "line-clamp-10" : ""}`}>
                    {shippingText}
                  </p>
                  {canExpandShipping ? (
                    <button
                      type="button"
                      onClick={() => setExpandedShipping((prev) => !prev)}
                      className="mt-2 text-sm font-medium text-emerald-700 hover:underline"
                    >
                      {expandedShipping ? "Show less" : "See more"}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {activeInfoTab === "attributes" ? (
                <div>
                  {product.customAttributes && product.customAttributes.filter((item) => item.visible !== false).length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-collapse text-sm">
                        <tbody>
                          {product.customAttributes
                            .filter((item) => item.visible !== false)
                            .map((item, index) => (
                              <tr key={`${item.name}-${index}`}>
                                <th className="w-56 border border-[#dce3ed] bg-slate-50 px-3 py-2 text-left font-semibold text-slate-800">
                                  {item.name}
                                </th>
                                <td className="border border-[#dce3ed] px-3 py-2 text-slate-700">
                                  {item.values.join(", ")}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No product attributes have been added yet.</p>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {relatedProducts.length > 0 ? (
          <section className="mt-16">
            <h2 className="text-3xl font-serif font-bold text-slate-900 mb-6">You May Also Like</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-5">
              {relatedProducts.map((item) => (
                <CategoryHoverProductCard key={item.id} product={item} />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {askQuestionOpen ? (
        <div className="fixed inset-0 z-[1250] bg-black/45 p-4" onClick={() => setAskQuestionOpen(false)}>
          <div className="mx-auto mt-[8vh] w-full max-w-xl rounded-xl bg-white p-5 shadow-2xl sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Ask a Question</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Product: <span className="font-medium text-slate-800">{product.title}</span>
                </p>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
                onClick={() => setAskQuestionOpen(false)}
                aria-label="Close ask question form"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="space-y-3" onSubmit={submitAskQuestion}>
              <input
                value={askForm.name}
                onChange={(event) => setAskForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Your name"
                className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                required
              />
              <input
                type="email"
                value={askForm.email}
                onChange={(event) => setAskForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="Your email"
                className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                required
              />
              <input
                value={askForm.phone}
                onChange={(event) => setAskForm((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="Phone (optional)"
                className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
              />
              <textarea
                value={askForm.message}
                onChange={(event) => setAskForm((prev) => ({ ...prev, message: event.target.value }))}
                placeholder="Write your question..."
                className="min-h-[130px] w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                required
              />
              <p className="text-xs text-slate-500">
                Product link will be included automatically in your message.
              </p>
              <button
                type="submit"
                disabled={askSubmitting}
                className="inline-flex h-11 w-full items-center justify-center rounded-md bg-emerald-700 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {askSubmitting ? "Sending..." : "Send Question"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {imageLightboxOpen ? (
        <div className="fixed inset-0 z-[1300] bg-black/80 p-4" onClick={() => setImageLightboxOpen(false)}>
          <button
            type="button"
            className="absolute right-5 top-5 z-[1310] inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-black/40 text-white"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setImageLightboxOpen(false)
            }}
          >
            <X className="h-5 w-5" />
          </button>

          <button
            type="button"
            className="absolute left-4 top-1/2 z-[1310] -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/40 bg-black/40 text-white"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setSelectedImage((prev) => (prev - 1 + gallery.length) % gallery.length)
            }}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          <button
            type="button"
            className="absolute right-4 top-1/2 z-[1310] -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/40 bg-black/40 text-white"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setSelectedImage((prev) => (prev + 1) % gallery.length)
            }}
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          <div className="flex h-full w-full items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={selectedGalleryImage.zoomSrc}
              alt={selectedGalleryImage.alt}
              width={selectedGalleryImage.width}
              height={selectedGalleryImage.height}
              decoding="async"
              className="max-h-[88vh] max-w-[92vw] rounded-lg object-contain"
            />
          </div>
        </div>
      ) : null}

    </div>
  )
}
