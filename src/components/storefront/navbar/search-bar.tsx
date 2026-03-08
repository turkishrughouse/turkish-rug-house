"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Loader2, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { saveSearch } from "@/lib/storefront/saved-searches"
import { parseProductImages } from "@/lib/product-images"

type ProductItem = {
    id: string
    title: string
    slug: string
    price?: number
    images?: string
    categories?: Array<{ slug: string }>
}

type SearchResult = {
    id: string
    title: string
    subtitle?: string
    image?: string
    price?: number
    href: string
    type: "Product"
}

function parseFirstImage(images: string | undefined) {
    return parseProductImages(images)[0] || ""
}

export function SearchBar() {
    const router = useRouter()
    const rootRef = useRef<HTMLDivElement | null>(null)
    const [query, setQuery] = useState("")
    const [results, setResults] = useState<SearchResult[]>([])
    const [activeIndex, setActiveIndex] = useState(-1)
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const closeOnOutside = (event: MouseEvent) => {
            if (!rootRef.current) return
            if (!rootRef.current.contains(event.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener("mousedown", closeOnOutside)
        return () => document.removeEventListener("mousedown", closeOnOutside)
    }, [])

    useEffect(() => {
        const term = query.trim().toLowerCase()
        if (term.length < 1) {
            setResults([])
            setOpen(false)
            setActiveIndex(-1)
            setLoading(false)
            return
        }

        const timer = setTimeout(async () => {
            setLoading(true)
            try {
                const productRes = await fetch(`/api/v1/public/products?limit=8&q=${encodeURIComponent(term)}&sort=latest`, {
                    cache: "no-store",
                })
                const productsData: { products?: ProductItem[] } = productRes.ok ? await productRes.json() : {}
                const products: ProductItem[] = productsData.products || []

                const productResults: SearchResult[] = products
                    .filter((item) => item.title.toLowerCase().includes(term))
                    .map((item) => ({
                        id: `prod-${item.id}`,
                        title: item.title,
                        subtitle: item.categories?.[0]?.slug ? item.categories[0].slug.replaceAll("-", " ") : undefined,
                        image: parseFirstImage(item.images),
                        price: typeof item.price === "number" ? item.price : undefined,
                        href: `/product/${item.slug}`,
                        type: "Product",
                    }))

                setResults(productResults.slice(0, 8))
                setActiveIndex(-1)
                setOpen(true)
            } catch {
                setResults([])
                setActiveIndex(-1)
                setOpen(false)
            } finally {
                setLoading(false)
            }
        }, 220)

        return () => clearTimeout(timer)
    }, [query])

    const emptyMessage = useMemo(() => {
        if (loading) return "Searching..."
        if (query.trim().length < 1) return "Start typing to search products"
        return "No results found"
    }, [loading, query])

    const handleEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "ArrowDown") {
            e.preventDefault()
            if (!open) setOpen(true)
            setActiveIndex((prev) => Math.min(prev + 1, results.length - 1))
            return
        }
        if (e.key === "ArrowUp") {
            e.preventDefault()
            setActiveIndex((prev) => Math.max(prev - 1, 0))
            return
        }
        if (e.key === "Escape") {
            setOpen(false)
            setActiveIndex(-1)
            return
        }
        if (e.key !== "Enter") return
        e.preventDefault()
        const selected = activeIndex >= 0 ? results[activeIndex] : results[0]
        if (selected) {
            saveSearch({ query: query.trim(), href: selected.href, type: selected.type })
            setOpen(false)
            setActiveIndex(-1)
            router.push(selected.href)
        }
    }

    const handleSearchClick = () => {
        const selected = activeIndex >= 0 ? results[activeIndex] : results[0]
        if (!selected) return
        saveSearch({ query: query.trim(), href: selected.href, type: selected.type })
        setOpen(false)
        setActiveIndex(-1)
        router.push(selected.href)
    }

    return (
        <div ref={rootRef} className="relative group w-full h-full">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 transition-colors" />
            <Input
                placeholder="Search rugs, kilims, styles…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => {
                    if (query.trim().length >= 1) setOpen(true)
                }}
                onKeyDown={handleEnter}
                className="pl-14 pr-28 h-full bg-transparent border-none shadow-none focus-visible:ring-0 rounded-none text-base placeholder:text-slate-400 w-full"
            />
            <button
                type="button"
                onClick={handleSearchClick}
                className="absolute right-2 top-1/2 inline-flex h-12 -translate-y-1/2 items-center gap-1.5 rounded-md border border-[#93b1aa] bg-[#a6c2bb] px-4 text-sm font-semibold text-slate-900 transition-colors hover:bg-[#93b1aa]"
            >
                <Search className="h-4 w-4" />
                Search
            </button>

            {open && (
                <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-slate-200 bg-white shadow-[0_20px_40px_rgba(15,23,42,0.12)] overflow-hidden z-[60]">
                    {results.length > 0 ? (
                        <ul className="max-h-96 overflow-y-auto py-2">
                            <li className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                                Products
                            </li>
                            {results.map((item, index) => (
                                <li key={item.id}>
                                    <Link
                                        href={item.href}
                                        onClick={() => {
                                            saveSearch({ query: query.trim(), href: item.href, type: item.type })
                                            setOpen(false)
                                            setActiveIndex(-1)
                                        }}
                                        className={`flex items-center justify-between gap-3 px-4 py-2.5 transition-colors ${activeIndex === index ? "bg-slate-100" : "hover:bg-slate-50"}`}
                                    >
                                        <div className="flex min-w-0 items-center gap-3">
                                            <div className="h-11 w-11 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                                                {item.image ? (
                                                    <Image src={item.image} alt={item.title} width={44} height={44} className="h-full w-full object-cover" />
                                                ) : null}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
                                                {item.subtitle ? (
                                                    <p className="truncate text-xs text-slate-500">{item.subtitle}</p>
                                                ) : null}
                                            </div>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            {typeof item.price === "number" ? (
                                                <span className="text-sm font-semibold text-slate-900">${item.price.toFixed(2)}</span>
                                            ) : null}
                                        </div>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="flex items-center gap-2 px-4 py-4 text-sm text-slate-500">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            <span>{emptyMessage}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
