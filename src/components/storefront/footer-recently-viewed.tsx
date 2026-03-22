"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { useStorefrontCurrency } from "@/components/storefront/currency-provider"

type RecentProduct = {
  id: string
  slug: string
  title: string
  image: string
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
        <Link key={item.id} href={`/product/${item.slug}`} className="flex items-center justify-start gap-2 rounded-md border border-slate-200 bg-white p-1.5 transition-colors hover:border-red-200 hover:bg-red-50/40">
          <img src={item.image || "/placeholder.jpg"} alt={item.title} className="h-8 w-8 rounded object-cover border border-slate-200" />
          <div className="min-w-0 text-left">
            <p className="line-clamp-1 text-[11px] font-medium text-slate-800 hover:text-red-600">{item.title}</p>
            <p className="text-[10px] text-emerald-700">{formatUsd(item.price)}</p>
          </div>
        </Link>
      ))}
    </div>
  )
}
