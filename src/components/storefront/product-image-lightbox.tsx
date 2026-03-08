"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, X } from "lucide-react"

type Props = {
  images: string[]
  alt: string
  buttonClassName?: string
  imageClassName?: string
}

export function ProductImageLightbox({
  images,
  alt,
  buttonClassName = "",
  imageClassName = "",
}: Props) {
  const gallery = useMemo(() => (images.length > 0 ? images : ["/placeholder.jpg"]), [images])
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
      if (e.key === "ArrowLeft") setIndex((prevIndex) => (prevIndex - 1 + gallery.length) % gallery.length)
      if (e.key === "ArrowRight") setIndex((prevIndex) => (prevIndex + 1) % gallery.length)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, gallery.length])

  return (
    <>
      <button
        type="button"
        className={`block ${buttonClassName}`}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIndex(0)
          setOpen(true)
        }}
      >
        <img
          src={gallery[0]}
          alt={alt}
          className={`h-full w-full object-cover transition-transform duration-300 hover:scale-105 ${imageClassName}`}
        />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[1300] bg-black/80 p-4" onClick={() => setOpen(false)}>
          <button
            type="button"
            className="absolute right-5 top-5 z-[1310] inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-black/40 text-white"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setOpen(false)
            }}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <button
            type="button"
            className="absolute left-4 top-1/2 z-[1310] -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/40 bg-black/40 text-white"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIndex((prevIndex) => (prevIndex - 1 + gallery.length) % gallery.length)
            }}
            aria-label="Previous image"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          <button
            type="button"
            className="absolute right-4 top-1/2 z-[1310] -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/40 bg-black/40 text-white"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIndex((prevIndex) => (prevIndex + 1) % gallery.length)
            }}
            aria-label="Next image"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          <div className="flex h-full w-full items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <img src={gallery[index]} alt={alt} className="max-h-[88vh] max-w-[92vw] rounded-lg object-contain" />
          </div>
        </div>
      ) : null}
    </>
  )
}
