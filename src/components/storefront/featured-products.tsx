import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { CategoryHoverProductCardServer } from "@/components/storefront/category-hover-product-card-server"
import { type CurrencySettings } from "@/lib/storefront/currency"

interface Product {
    id: string
    title: string
    slug: string
    price: number
    compareAtPrice?: number | null
    images: string // JSON string
    description?: string | null
    stockCount?: number
    isStock?: boolean
    categories?: Array<{ id: string; title: string; slug: string }>
}

interface FeaturedProductsProps {
    products: Product[]
    title?: string
    currencySettings?: CurrencySettings
}

export function FeaturedProducts({ products, title = "Featured Rugs", currencySettings }: FeaturedProductsProps) {
    if (products.length === 0) return null

    return (
        <section className="container mx-auto px-4 py-12">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
                </div>
                <Link href="/products" className="text-sm font-medium text-teal-600 hover:text-teal-700 flex items-center gap-1">
                    View all <ArrowRight className="h-4 w-4" />
                </Link>
            </div>

            <div className="grid grid-cols-2 items-start gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-5">
                {products.slice(0, 8).map((product) => (
                    <CategoryHoverProductCardServer key={product.id} product={product} currencySettings={currencySettings} />
                ))}
            </div>
        </section>
    )
}
