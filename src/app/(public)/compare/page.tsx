"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Scale, ShoppingCart, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { addToCart } from "@/lib/storefront/cart"
import {
  getEngagementEventName,
  readEngagementList,
  removeEngagementItem,
  type EngagementItem,
} from "@/lib/storefront/engagement"

export default function ComparePage() {
  const [items, setItems] = useState<EngagementItem[]>([])

  const refresh = () => setItems(readEngagementList("rughouse_compare"))

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

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <section className="border-b border-slate-200 bg-white">
        <div className="container mx-auto px-6 py-10">
          <h1 className="font-serif text-4xl font-bold text-slate-900">Compare Products</h1>
          <p className="mt-2 text-slate-600">Compared items: {items.length}</p>
        </div>
      </section>

      <div className="container mx-auto px-6 py-10">
        {items.length === 0 ? (
          <div className="rounded-md border border-slate-200 bg-white p-10 text-center">
            <Scale className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-3 text-slate-600">No products in comparison list.</p>
            <Link href="/products" className="mt-4 inline-flex h-10 items-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800">
              Browse products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <article key={item.productId} className="rounded-md border border-slate-200 bg-white p-4">
                <Link href={`/product/${item.slug}`} className="block aspect-[4/3] overflow-hidden rounded border border-slate-200">
                  <img src={item.image || "/placeholder.jpg"} alt={item.title} className="h-full w-full object-cover" />
                </Link>
                <Link href={`/product/${item.slug}`} className="mt-3 line-clamp-1 block text-lg font-semibold text-slate-900 hover:text-emerald-700">
                  {item.title}
                </Link>
                <p className="mt-1 text-sm font-semibold text-emerald-700">${item.price.toFixed(2)}</p>
                <div className="mt-4 flex items-center gap-2">
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
                      removeEngagementItem("rughouse_compare", item.productId)
                      refresh()
                    }}
                    aria-label="Remove from compare"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
