"use client"

import { Heart, Shuffle } from "lucide-react"
import { toast } from "sonner"

import { addEngagementItem } from "@/lib/storefront/engagement"
import type { ProductDetailData } from "@/components/storefront/product-detail-shared"

export function ProductDetailEngagement({
  product,
  image,
}: {
  product: ProductDetailData
  image: string
}) {
  return (
    <div className="mt-4 flex items-center gap-6 text-3xl">
      <button
        type="button"
        className="inline-flex items-center gap-2 text-slate-800 hover:text-red-600 hover:underline transition-colors"
        onClick={() => {
          const res = addEngagementItem("rughouse_compare", {
            productId: product.id,
            slug: product.slug,
            title: product.title,
            image,
            price: product.price,
          })
          if (res.added) toast.success("Added to compare")
          else toast.info("Already in compare list")
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
            image,
            price: product.price,
          })
          if (res.added) toast.success("Added to wishlist")
          else toast.info("Already in compare list")
        }}
      >
        <Heart className="h-5 w-5" />
        <span className="text-sm font-semibold">Add to wishlist</span>
      </button>
    </div>
  )
}
