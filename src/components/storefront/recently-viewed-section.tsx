"use client"

import { useEffect, useState } from "react"
import { ShopProductCard } from "@/components/storefront/shop-product-card"

type RecentProduct = {
  id: string
  slug: string
  title: string
  image: string
  images?: string
  price: number
}

const STORAGE_KEY = "rughouse_recently_viewed_products"

export function RecentlyViewedSection({
  title = "Recently viewed items",
  subtitle = "Shows automatically after the visitor views product pages.",
  limit = 8,
}: {
  title?: string
  subtitle?: string
  limit?: number
}) {
  const [products, setProducts] = useState<RecentProduct[]>([])

  useEffect(() => {
    const readRecentlyViewed = () => {
      if (typeof window === "undefined") return
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        const parsed = raw ? JSON.parse(raw) : []
        const safe = Array.isArray(parsed) ? parsed : []
        const normalized = safe
          .filter((item) => item && typeof item.slug === "string" && typeof item.title === "string")
          .slice(0, limit)
          .map((item) => ({
            id: String(item.id || item.slug),
            slug: String(item.slug),
            title: String(item.title),
            image: String(item.image || "/placeholder.jpg"),
            images: typeof item.images === "string" ? item.images : "",
            price: Number(item.price || 0),
          }))
        setProducts(normalized)
      } catch {
        setProducts([])
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
  }, [limit])

  if (products.length === 0) return null

  return (
    <section className="container mx-auto px-4 py-10">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
        {subtitle ? <p className="mt-1 text-slate-500">{subtitle}</p> : null}
      </div>

      <div className="grid grid-cols-1 items-start gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((product) => (
          <ShopProductCard
            key={product.id}
            product={{
              id: product.id,
              slug: product.slug,
              title: product.title,
              price: product.price,
              images: product.images || JSON.stringify([product.image]),
            }}
          />
        ))}
      </div>
    </section>
  )
}
