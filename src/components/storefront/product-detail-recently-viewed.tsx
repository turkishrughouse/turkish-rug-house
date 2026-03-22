"use client"

import { useEffect } from "react"

export function ProductDetailRecentlyViewed({
  productId,
  slug,
  title,
  price,
  image,
}: {
  productId: string
  slug: string
  title: string
  price: number
  image: string
}) {
  useEffect(() => {
    const storageKey = "rughouse_recently_viewed_products"
    const current = {
      id: productId,
      slug,
      title,
      image,
      price: Number(price || 0),
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
  }, [image, price, productId, slug, title])

  return null
}
