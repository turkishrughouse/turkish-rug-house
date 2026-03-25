"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { useStorefrontCurrency } from "@/components/storefront/currency-provider"
import { StorefrontProductImage } from "@/components/storefront/storefront-product-image"
import { buildProductImageAlt, getPrimaryProductImageCandidates, parseProductImageRecords } from "@/lib/product-images"

type RecentProduct = {
  id: string
  slug: string
  title: string
  image: string
  images?: string
  price: number
}

const STORAGE_KEY = "rughouse_recently_viewed_products"

export function FooterRecentlyViewed() {
  const { formatUsd } = useStorefrontCurrency()
  const [recentlyViewed, setRecentlyViewed] = useState<RecentProduct[]>([])

  useEffect(() => {
    const readRecentlyViewed = () => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        const parsed = raw ? JSON.parse(raw) : []
        const safe = Array.isArray(parsed) ? parsed : []
        setRecentlyViewed(
          safe
            .filter((item) => item && typeof item.slug === "string" && typeof item.title === "string")
            .slice(0, 3)
            .map((item) => ({
              id: String(item.id || item.slug),
              slug: String(item.slug),
              title: String(item.title),
              image: String(item.image || "/placeholder.jpg"),
              images: typeof item.images === "string" ? item.images : "",
              price: Number(item.price || 0),
            }))
        )
      } catch {
        setRecentlyViewed([])
      }
    }

    readRecentlyViewed()
    window.addEventListener("focus", readRecentlyViewed)
    window.addEventListener("storage", readRecentlyViewed)
    window.addEventListener("pageshow", readRecentlyViewed)
    window.addEventListener("rughouse:recently-viewed-updated", readRecentlyViewed)
    return () => {
      window.removeEventListener("focus", readRecentlyViewed)
      window.removeEventListener("storage", readRecentlyViewed)
      window.removeEventListener("pageshow", readRecentlyViewed)
      window.removeEventListener("rughouse:recently-viewed-updated", readRecentlyViewed)
    }
  }, [])

  if (recentlyViewed.length === 0) {
    return <p className="mt-3 text-xs text-slate-500">No viewed products yet.</p>
  }

  return (
    <div className="mt-3 space-y-1.5 lg:ml-auto lg:max-w-[230px]">
      {recentlyViewed.map((item) => (
        <FooterRecentlyViewedItem key={item.id} item={item} formatUsd={formatUsd} />
      ))}
    </div>
  )
}

function FooterRecentlyViewedItem({
  item,
  formatUsd,
}: {
  item: RecentProduct
  formatUsd: (value: number) => string
}) {
  const images = parseProductImageRecords(item.images || JSON.stringify([item.image]))
  const candidates = getPrimaryProductImageCandidates(item.images || JSON.stringify([item.image]))
  const alt = buildProductImageAlt({ title: item.title, fallbackAlt: images[0]?.alt })

  return (
    <Link href={`/product/${item.slug}`} className="flex items-center justify-start gap-2 rounded-md border border-slate-200 bg-white p-1.5 transition-colors hover:border-red-200 hover:bg-red-50/40">
      <div className="relative h-8 w-8 overflow-hidden rounded border border-slate-200 bg-slate-100">
        <StorefrontProductImage
          candidates={candidates}
          alt={alt}
          fill
          sizes="32px"
          className="object-cover"
        />
      </div>
      <div className="min-w-0 text-left">
        <p className="line-clamp-1 text-[11px] font-medium text-slate-800 hover:text-red-600">{item.title}</p>
        <p className="text-[10px] text-emerald-700">{formatUsd(item.price)}</p>
      </div>
    </Link>
  )
}
