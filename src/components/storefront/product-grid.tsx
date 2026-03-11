
import Link from "next/link"
import { ShoppingCart, Search, Shuffle, Heart } from "lucide-react"
import { buildProductImageAlt, getProductImageUrl, parseProductImageRecords } from "@/lib/product-images"

interface Product {
    id: string
    title: string
    slug: string
    price: number
    compareAtPrice?: number | null
    images: string // JSON string
    stockCount?: number
    isStock?: boolean
}

interface ProductGridProps {
    products: Product[]
}

export function ProductGrid({ products }: ProductGridProps) {
    if (products.length === 0) return null

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
            {products.map((product) => {
                const images = parseProductImageRecords(product.images)
                const mainImage = getProductImageUrl(images[0], "large") || "/placeholder.jpg"
                const imageAlt = buildProductImageAlt({ title: product.title, fallbackAlt: images[0]?.alt })
                const stockCount = Math.max(0, product.stockCount ?? 999)
                const isMarkedOutOfStock = product.isStock === false && stockCount > 0
                const isSold = stockCount <= 0
                const hasDiscount = Boolean(product.compareAtPrice && product.compareAtPrice > product.price)
                const discountPercent = hasDiscount
                    ? Math.round((((product.compareAtPrice as number) - product.price) / (product.compareAtPrice as number)) * 100)
                    : 0
                return (
                    <Link key={product.id} href={`/product/${product.slug}`} className="group block">
                        {/* Image */}
                        <div className="aspect-[4/5] w-full overflow-hidden rounded-lg bg-slate-100 relative">
                            {isMarkedOutOfStock ? (
                                <span className="pointer-events-none absolute left-2 top-2 z-20 rounded-sm bg-red-600 px-2 py-1 text-[10px] font-semibold tracking-[0.08em] text-white">
                                    OUT OF STOCK
                                </span>
                            ) : isSold ? (
                                <span className="pointer-events-none absolute -left-9 top-4 z-20 w-28 -rotate-45 bg-red-600 px-0.5 py-1 text-center text-[10px] font-semibold tracking-[0.18em] text-white">
                                    SOLD
                                </span>
                            ) : hasDiscount && discountPercent > 0 ? (
                                <span className="pointer-events-none absolute -left-9 top-4 z-20 w-28 -rotate-45 bg-yellow-300 px-0.5 py-1 text-center text-[10px] font-semibold tracking-[0.05em] text-slate-900">
                                    {discountPercent}% OFF
                                </span>
                            ) : null}
                            <img
                                src={mainImage}
                                alt={imageAlt}
                                loading="lazy"
                                decoding="async"
                                className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                            />
                            {/* Hover Action Bar */}
                            <div className="pointer-events-none absolute left-1/2 bottom-4 -translate-x-1/2 translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                                <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white/95 px-2 py-1.5 shadow-lg backdrop-blur">
                                    <span className="h-8 w-8 rounded-md flex items-center justify-center text-slate-700">
                                        <ShoppingCart className="h-4 w-4" />
                                    </span>
                                    <span className="h-8 w-8 rounded-md flex items-center justify-center text-slate-700">
                                        <Search className="h-4 w-4" />
                                    </span>
                                    <span className="h-8 w-8 rounded-md flex items-center justify-center text-slate-700">
                                        <Shuffle className="h-4 w-4" />
                                    </span>
                                    <span className="h-8 w-8 rounded-md flex items-center justify-center text-slate-700">
                                        <Heart className="h-4 w-4" />
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Details */}
                        <div className="mt-4 space-y-1">
                            <h3 className="text-sm font-medium text-slate-900 group-hover:text-teal-700 transition-colors line-clamp-1">
                                {product.title}
                            </h3>
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-slate-900">
                                    ${product.price.toFixed(2)}
                                </p>
                                {product.compareAtPrice && product.compareAtPrice > product.price && (
                                    <p className="text-xs text-slate-500 line-through">
                                        ${product.compareAtPrice.toFixed(2)}
                                    </p>
                                )}
                            </div>
                        </div>
                    </Link>
                )
            })}
        </div>
    )
}
