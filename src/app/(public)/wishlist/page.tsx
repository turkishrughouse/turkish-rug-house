"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Heart, House, ShoppingCart, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { addToCart } from "@/lib/storefront/cart"
import {
  getEngagementEventName,
  readEngagementList,
  removeEngagementItem,
  type EngagementItem,
} from "@/lib/storefront/engagement"
import { pickPrimaryImage } from "@/lib/product-images"

export default function WishlistPage() {
  const [items, setItems] = useState<EngagementItem[]>([])
  const [fallbackBannerImage, setFallbackBannerImage] = useState("")

  const refresh = () => setItems(readEngagementList("rughouse_wishlist"))

  useEffect(() => {
    const eventName = getEngagementEventName()
    const onUpdate = () => refresh()
    window.addEventListener(eventName, onUpdate)
    window.addEventListener("storage", onUpdate)
    const timer = window.setTimeout(onUpdate, 0)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener(eventName, onUpdate)
      window.removeEventListener("storage", onUpdate)
    }
  }, [])

  useEffect(() => {
    const loadFallbackBanner = async () => {
      try {
        const res = await fetch("/api/v1/public/products?limit=1&sort=latest", { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json().catch(() => ({}))) as {
          products?: Array<{ image?: string; featuredImage?: string; images?: unknown }>
        }
        const product = Array.isArray(data.products) ? data.products[0] : null
        if (!product) return
        const image =
          (typeof product.image === "string" ? product.image : "") ||
          pickPrimaryImage(product.featuredImage ?? "", product.images)
        if (image) setFallbackBannerImage(image)
      } catch {
        // keep placeholder fallback
      }
    }

    void loadFallbackBanner()
  }, [])

  const bannerImage = items[0]?.image || fallbackBannerImage || "/placeholder.jpg"

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <section className="relative overflow-hidden border-b border-slate-200">
        <img src={bannerImage} alt="Wishlist banner" className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative z-10 container mx-auto px-6 py-14 md:py-16">
          <h1 className="text-4xl font-bold text-white">Wishlist</h1>
          <p className="mt-2 text-white/90">Saved items: {items.length}</p>
          <div className="mt-4 flex items-center gap-2 text-sm text-white/85">
            <Link href="/" className="inline-flex items-center gap-2 hover:text-white">
              <House className="h-4 w-4" />
              <span>Home</span>
            </Link>
            <span>/</span>
            <span className="font-medium text-white">Wishlist</span>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-6 py-10">
        {items.length === 0 ? (
          <div className="rounded-md border border-slate-200 bg-white p-10 text-center">
            <Heart className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-3 text-slate-600">Your wishlist is empty.</p>
            <Link href="/products" className="mt-4 inline-flex h-10 items-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800">
              Browse products
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.productId} className="flex items-center gap-4 rounded-md border border-slate-200 bg-white p-3">
                <Link href={`/product/${item.slug}`} className="h-20 w-20 overflow-hidden rounded border border-slate-200">
                  <img src={item.image || "/placeholder.jpg"} alt={item.title} className="h-full w-full object-cover" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/product/${item.slug}`} className="line-clamp-1 text-lg font-semibold text-slate-900 hover:text-emerald-700">
                    {item.title}
                  </Link>
                  <p className="mt-1 text-sm font-semibold text-emerald-700">${item.price.toFixed(2)}</p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    const result = addToCart({
                      productId: item.productId,
                      slug: item.slug,
                      title: item.title,
                      price: item.price,
                      compareAtPrice: null,
                      image: item.image || "/placeholder.jpg",
                      stockCount: 999,
                      quantity: 1,
                    })
                    if (!result.ok) {
                      toast.error(result.message)
                      return
                    }
                    toast.success("Added to basket")
                  }}
                >
                  <ShoppingCart className="h-4 w-4" />
                  Add
                </button>
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
                  onClick={() => {
                    removeEngagementItem("rughouse_wishlist", item.productId)
                    refresh()
                  }}
                  aria-label="Remove from wishlist"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
