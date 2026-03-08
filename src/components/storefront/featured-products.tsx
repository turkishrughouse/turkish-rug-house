import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { CategoryHoverProductCard } from "@/components/storefront/category-hover-product-card"

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
}

export function FeaturedProducts({ products }: FeaturedProductsProps) {
    if (products.length === 0) return null

    return (
        <section className="container mx-auto px-4 py-12">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Featured Items</h2>
                    <p className="text-slate-500 mt-1">Newly added products</p>
                </div>
                <Link href="/products" className="text-sm font-medium text-teal-600 hover:text-teal-700 flex items-center gap-1">
                    View all <ArrowRight className="h-4 w-4" />
                </Link>
            </div>

            <div className="grid grid-cols-1 items-start sm:grid-cols-2 lg:grid-cols-5 gap-x-5 gap-y-8">
                {products.slice(0, 10).map((product) => (
                    <CategoryHoverProductCard key={product.id} product={product} />
                ))}
            </div>
        </section>
    )
}
