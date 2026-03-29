"use client"

import { useCallback, useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import Image from "next/image"

import type { ProductGalleryImage } from "@/components/storefront/product-detail-shared"

function GalleryImageWithFallback({
  src,
  candidates,
  alt,
  width,
  height,
  sizes,
  className,
  priority = false,
  quality = 85,
}: {
  src: string
  candidates: string[]
  alt: string
  width: number
  height: number
  sizes: string
  className?: string
  priority?: boolean
  quality?: number
}) {
  const normalizedCandidates = Array.from(new Set([src, ...candidates].filter(Boolean)))
  const [candidateIndex, setCandidateIndex] = useState(0)

  const currentSrc = normalizedCandidates[candidateIndex] || "/placeholder.jpg"

  return (
    <Image
      src={currentSrc}
      alt={alt}
      width={width || 1200}
      height={height || 1200}
      sizes={sizes}
      className={className}
      priority={priority}
      quality={quality}
      style={{ width: "100%", height: "auto" }}
      unoptimized={currentSrc.startsWith("/uploads/") || /^https?:\/\//i.test(currentSrc)}
      onError={() => {
        setCandidateIndex((prev) => (prev + 1 < normalizedCandidates.length ? prev + 1 : prev))
      }}
    />
  )
}

function GalleryState({
  gallery,
  discountPercent,
  isMarkedOutOfStock,
  isSold,
}: {
  gallery: ProductGalleryImage[]
  discountPercent: number
  isMarkedOutOfStock: boolean
  isSold: boolean
}) {
  const [selectedImage, setSelectedImage] = useState(0)
  const [imageLightboxOpen, setImageLightboxOpen] = useState(false)
  const [hoverZoomEnabled, setHoverZoomEnabled] = useState(false)
  const [zoomBackgroundPosition, setZoomBackgroundPosition] = useState("50% 50%")
  const [mainImageZoomActive, setMainImageZoomActive] = useState(false)
  const [lightboxZoom, setLightboxZoom] = useState(1)
  const [lightboxZoomOrigin, setLightboxZoomOrigin] = useState("50% 50%")

  const activeImageIndex = selectedImage >= 0 && selectedImage < gallery.length ? selectedImage : 0
  const selectedGalleryImage = gallery[activeImageIndex] || gallery[0]
  const zoomSrc = selectedGalleryImage.zoomSrc

  const resetZoomState = useCallback(() => {
    setMainImageZoomActive(false)
    setZoomBackgroundPosition("50% 50%")
    setLightboxZoom(1)
    setLightboxZoomOrigin("50% 50%")
  }, [])

  const closeLightbox = useCallback(() => {
    setImageLightboxOpen(false)
    setLightboxZoom(1)
    setLightboxZoomOrigin("50% 50%")
  }, [])

  const selectImage = useCallback((index: number) => {
    setSelectedImage(index)
    resetZoomState()
  }, [resetZoomState])

  const moveSelection = useCallback((delta: number) => {
    if (gallery.length === 0) return
    setSelectedImage((prev) => {
      const safePrev = prev >= 0 && prev < gallery.length ? prev : 0
      return (safePrev + delta + gallery.length) % gallery.length
    })
    resetZoomState()
  }, [gallery.length, resetZoomState])

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
      if (event.key === "Escape") closeLightbox()
      if (event.key === "ArrowRight") moveSelection(1)
      if (event.key === "ArrowLeft") moveSelection(-1)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [closeLightbox, imageLightboxOpen, moveSelection])

  return (
    <>
      <div className="grid grid-cols-[72px_minmax(0,1fr)] sm:grid-cols-[92px_minmax(0,1fr)] gap-3 sm:gap-4 items-start">
        <div className="space-y-3">
          {gallery.map((img, i) => (
            <button
              key={`${img.src}-${i}`}
              type="button"
              onClick={() => selectImage(i)}
              className={`block h-14 w-14 sm:h-20 sm:w-20 rounded-md overflow-hidden border ${activeImageIndex === i ? "border-slate-900" : "border-[#dce3ed]"}`}
            >
              <GalleryImageWithFallback
                key={`${img.src}-${img.thumbSrc}-${img.thumbSrcCandidates.join("|")}`}
                src={img.thumbSrc}
                candidates={img.thumbSrcCandidates}
              alt={img.alt}
              width={80}
              height={80}
              sizes="80px"
                className="h-full w-full object-cover"
              />
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
              setZoomBackgroundPosition(`${x}% ${y}%`)
              setMainImageZoomActive(true)
            }}
            onMouseEnter={() => {
              if (!hoverZoomEnabled) return
              setMainImageZoomActive(true)
            }}
            onMouseLeave={() => {
              setZoomBackgroundPosition("50% 50%")
              setMainImageZoomActive(false)
            }}
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
            <GalleryImageWithFallback
              key={`${selectedGalleryImage.src}-${selectedGalleryImage.srcCandidates.join("|")}`}
              src={selectedGalleryImage.src}
              candidates={selectedGalleryImage.srcCandidates}
              alt={selectedGalleryImage.alt}
              width={selectedGalleryImage.width}
              height={selectedGalleryImage.height}
              priority
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 40vw"
              quality={85}
              className={`h-full w-full object-contain object-center transition-transform duration-300 ${hoverZoomEnabled ? "cursor-zoom-in" : "group-hover:scale-105"}`}
            />
            {hoverZoomEnabled ? (
              <div
                className={`pointer-events-none absolute inset-0 rounded-lg bg-white/5 transition-opacity duration-150 ${mainImageZoomActive ? "opacity-100" : "opacity-0"}`}
                style={{
                  backgroundImage: `url(${zoomSrc})`,
                  backgroundPosition: zoomBackgroundPosition,
                  backgroundRepeat: "no-repeat",
                  backgroundSize: "240%",
                }}
              />
            ) : null}
          </button>
        </div>
      </div>

      {imageLightboxOpen ? (
        <div className="fixed inset-0 z-[1300] bg-black/80 p-4" onClick={closeLightbox}>
          <button
            type="button"
            className="absolute right-5 top-5 z-[1310] inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-black/40 text-white"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              closeLightbox()
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
              moveSelection(-1)
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
              moveSelection(1)
            }}
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          <div className="flex h-full w-full items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <div className="relative flex max-h-[88vh] max-w-[92vw] items-center justify-center overflow-hidden rounded-lg">
              <button
                type="button"
                className={`block ${lightboxZoom > 1 ? "cursor-zoom-out" : "cursor-zoom-in"}`}
                onClick={() => setLightboxZoom((prev) => (prev > 1 ? 1 : 2.6))}
                onMouseMove={(event) => {
                  const bounds = event.currentTarget.getBoundingClientRect()
                  const x = ((event.clientX - bounds.left) / bounds.width) * 100
                  const y = ((event.clientY - bounds.top) / bounds.height) * 100
                  setLightboxZoomOrigin(`${x}% ${y}%`)
                }}
                style={{
                  transform: `scale(${lightboxZoom})`,
                  transformOrigin: lightboxZoomOrigin,
                  transitionDuration: "200ms",
                }}
              >
                <GalleryImageWithFallback
                  key={`${selectedGalleryImage.zoomSrc}-${selectedGalleryImage.zoomSrcCandidates.join("|")}`}
                  src={selectedGalleryImage.zoomSrc}
                  candidates={selectedGalleryImage.zoomSrcCandidates}
                  alt={selectedGalleryImage.alt}
                  width={selectedGalleryImage.width}
                  height={selectedGalleryImage.height}
                  sizes="(max-width: 768px) 100vw, 92vw"
                  quality={96}
                  className="max-h-[88vh] w-auto object-contain"
                />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

export function ProductDetailGallery({
  gallery,
  productImageStateKey,
  discountPercent,
  isMarkedOutOfStock,
  isSold,
}: {
  gallery: ProductGalleryImage[]
  productImageStateKey: string
  discountPercent: number
  isMarkedOutOfStock: boolean
  isSold: boolean
}) {
  return (
    <GalleryState
      key={productImageStateKey}
      gallery={gallery}
      discountPercent={discountPercent}
      isMarkedOutOfStock={isMarkedOutOfStock}
      isSold={isSold}
    />
  )
}
