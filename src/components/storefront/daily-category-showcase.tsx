import Link from "next/link"
import { CategoryHoverProductCardServer } from "@/components/storefront/category-hover-product-card-server"
import { type CurrencySettings } from "@/lib/storefront/currency"

type ShowcaseCategory = {
  id: string
  title: string
  slug: string
  image?: string | null
}

type ShowcaseProduct = {
  id: string
  title: string
  slug: string
  price: number
  images: string
  description?: string | null
  compareAtPrice?: number | null
  stockCount?: number
  isStock?: boolean
  categories?: Array<{ id: string; title: string; slug: string }>
}

export function DailyCategoryShowcase({
  title,
  category,
  products,
  bannerImage,
  currencySettings,
}: {
  title?: string
  category: ShowcaseCategory | null
  products: ShowcaseProduct[]
  bannerImage?: string | null
  currencySettings?: CurrencySettings
}) {
  if (!category) return null

  return (
    <section className="container mx-auto px-4 pt-5 pb-8">
      <div className="mb-4 border-b border-slate-200 pb-2">
        <h2 className="text-2xl font-bold uppercase tracking-wide text-slate-900">
          {title?.trim() ? title : `Most Popular In ${category.title}`}
        </h2>
      </div>

      <div className="rounded-md border border-slate-200 bg-white">
        <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)]">
          <Link href={`/category/${category.slug}`} className="group relative block min-h-[320px] bg-slate-100">
            {(bannerImage || category.image) ? (
              <img
                src={bannerImage || category.image || "/placeholder.jpg"}
                alt={category.title}
                className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
              />
            ) : (
              <div className="h-full w-full bg-slate-200" />
            )}
            <div className="absolute inset-x-4 bottom-4 bg-sky-900/55 px-4 py-3 text-white backdrop-blur-[1px]">
              <p className="text-2xl font-semibold">{category.title}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.1em]">Daily Picks</p>
            </div>
          </Link>

          <div className="grid grid-cols-2 gap-3 border-l border-slate-200 p-3 sm:grid-cols-4">
            {products.slice(0, 8).map((product) => (
              <CategoryHoverProductCardServer key={product.id} product={product} currencySettings={currencySettings} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
