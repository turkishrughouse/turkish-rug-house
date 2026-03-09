
import { notFound } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/db"
import { getProducts, getProductOptions } from "@/lib/actions/product-actions"
import { Metadata } from "next"
import { LayoutGrid, Grid2x2, Rows3, List } from "lucide-react"
import { CategoryHoverProductCard } from "@/components/storefront/category-hover-product-card"
import { parseProductImages } from "@/lib/product-images"

type Props = {
    params: Promise<{ slug: string }>
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

// 1. Generate Metadata
export async function generateMetadata(
    { params }: Props
): Promise<Metadata> {
    const { slug } = await params
    const category = await prisma.category.findUnique({
        where: { slug }
    })

    if (!category) {
        return {
            title: "Category Not Found",
        }
    }

    return {
        title: `${category.title} | Turkish Rug House`,
        description: category.description || `Browse our collection of ${category.title}`,
    }
}

// 2. Main Page Component
export default async function CategoryPage({ params, searchParams }: Props) {
    const { slug } = await params
    const resolvedSearchParams = await searchParams

    const getParam = (key: string) => {
        const val = resolvedSearchParams[key]
        if (!val) return []
        return Array.isArray(val) ? val : [val]
    }

    const getSingle = (key: string) => {
        const val = resolvedSearchParams[key]
        if (!val) return ""
        return Array.isArray(val) ? (val[0] ?? "") : val
    }

    const selectedColors = getParam("color")
    const query = getSingle("q")
    const viewInput = getSingle("view")
    const viewMode: "2" | "3" | "4" | "list" = viewInput === "2" || viewInput === "3" || viewInput === "4" || viewInput === "list"
        ? viewInput
        : "3"
    const sortInput = getSingle("sort")
    const sortValue: "latest" | "oldest" | "price-asc" | "price-desc" =
        sortInput === "oldest" || sortInput === "price-asc" || sortInput === "price-desc" ? sortInput : "latest"
    const showInput = Number(getSingle("show") || 16)
    const showValue = [8, 16, 32, 36].includes(showInput) ? showInput : 16
    const inStockOnly = resolvedSearchParams["inStock"] === "true"
    const topRatedOnly = resolvedSearchParams["topRated"] === "true"
    const priceMin = Number(getSingle("priceMin") || 0)
    const priceMaxRaw = Number(getSingle("priceMax") || 0)
    const hasPriceFilter = Number.isFinite(priceMin) && Number.isFinite(priceMaxRaw) && priceMaxRaw > 0

    const baseFilters = {
        types: getParam("type"),
        styles: getParam("style"),
        colors: selectedColors,
        sizes: getParam("size"),
        ages: getParam("age"),
        inStock: inStockOnly,
        priceMin: hasPriceFilter ? priceMin : undefined,
        priceMax: hasPriceFilter ? priceMaxRaw : undefined,
    }

    const [category, options, maxPriceRow, categoryShortcutMenu, allCategoryNodes] = await Promise.all([
        prisma.category.findUnique({
            where: { slug },
            include: {
                children: {
                    orderBy: { sortOrder: "asc" },
                    select: {
                        id: true,
                        slug: true,
                        title: true,
                        image: true,
                        description: true,
                    },
                },
            },
        }),
        getProductOptions(),
        prisma.product.aggregate({
            where: {
                isPublished: true,
                categories: {
                    some: { slug },
                },
            },
            _max: { price: true },
        }),
        prisma.menu.findFirst({
            where: { location: "CATEGORY_ATTRIBUTE_SHORTCUTS" },
            include: {
                items: {
                    orderBy: { sortOrder: "asc" },
                },
            },
        }),
        prisma.category.findMany({
            select: {
                id: true,
                parentId: true,
            },
        }),
    ])

    if (!category) {
        notFound()
    }

    const categoryScopeIds = (() => {
        const childMap = new Map<string, string[]>()
        allCategoryNodes.forEach((node) => {
            const parentId = node.parentId || "__root__"
            const list = childMap.get(parentId) || []
            list.push(node.id)
            childMap.set(parentId, list)
        })

        const result = new Set<string>()
        const stack: string[] = [category.id]
        while (stack.length > 0) {
            const current = stack.pop()
            if (!current || result.has(current)) continue
            result.add(current)
            const children = childMap.get(current) || []
            children.forEach((childId) => stack.push(childId))
        }
        return Array.from(result)
    })()

    const maxCategoryPrice = Number(maxPriceRow._max.price?.toString?.() || 0)

    const topRatedSales = await prisma.orderItem.groupBy({
        by: ["productId"],
        where: { productId: { not: null } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 60,
    })

    const rankedIds = topRatedSales.map((row) => row.productId).filter((id): id is string => Boolean(id))
    const topRatedCandidates = rankedIds.length > 0
        ? await prisma.product.findMany({
            where: {
                id: { in: rankedIds },
                isPublished: true,
                categories: { some: { slug } },
            },
            select: {
                id: true,
                slug: true,
                title: true,
                price: true,
                compareAtPrice: true,
                images: true,
            },
        })
        : []

    const quantityMap = new Map(
        topRatedSales
            .filter((row) => row.productId)
            .map((row) => [row.productId as string, Number(row._sum.quantity || 0)])
    )

    const topRatedProducts = topRatedCandidates
        .sort((a, b) => (quantityMap.get(b.id) || 0) - (quantityMap.get(a.id) || 0))
        .slice(0, 5)
        .map((p) => ({
            ...p,
            price: Number(p.price),
            compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice) : null,
            soldCount: quantityMap.get(p.id) || 0,
        }))

    const topRatedIds = topRatedProducts.map((p) => p.id)

    const { products } = await getProducts(
        1,
        showValue,
        query,
        "published",
        sortValue,
        slug,
        {
            ...baseFilters,
            productIds: topRatedOnly ? topRatedIds : undefined,
        }
    )
    const { products: sidebarProducts } = await getProducts(1, 5, "", "published", "latest", slug)

    const colorCountWhere = {
        isPublished: true,
        categories: { some: { id: { in: categoryScopeIds } } },
        OR: query ? [{ title: { contains: query } }, { slug: { contains: query } }] : undefined,
        types: baseFilters.types.length ? { some: { slug: { in: baseFilters.types } } } : undefined,
        styles: baseFilters.styles.length ? { some: { slug: { in: baseFilters.styles } } } : undefined,
        sizes: baseFilters.sizes.length ? { some: { slug: { in: baseFilters.sizes } } } : undefined,
        ages: baseFilters.ages.length ? { some: { slug: { in: baseFilters.ages } } } : undefined,
        isStock: inStockOnly ? true : undefined,
        price: hasPriceFilter ? { gte: priceMin, lte: priceMaxRaw } : undefined,
    } as const

    const colorCounters = await prisma.color.findMany({
        select: {
            id: true,
            slug: true,
            _count: {
                select: {
                    products: {
                        where: colorCountWhere,
                    },
                },
            },
        },
    })
    const colorCountMap = new Map(colorCounters.map((entry) => [entry.slug, entry._count.products]))

    const childCounts = await Promise.all(
        category.children.map(async (child) => ({
            ...child,
            productCount: await prisma.product.count({
                where: {
                    isPublished: true,
                    categories: { some: { id: child.id } },
                },
            }),
        }))
    )

    const shortcutCategoryIds = (categoryShortcutMenu?.items || [])
        .filter((item) => item.type === "CATEGORY" && item.referenceId)
        .map((item) => item.referenceId as string)

    const shortcutCategories = shortcutCategoryIds.length > 0
        ? await prisma.category.findMany({
            where: { id: { in: shortcutCategoryIds } },
            select: {
                id: true,
                slug: true,
                title: true,
                image: true,
                _count: { select: { products: true } },
            },
        })
        : []

    const shortcutCategoryMap = new Map(shortcutCategories.map((item) => [item.id, item]))

    const buildQuery = (mutator: (params: URLSearchParams) => void) => {
        const params = new URLSearchParams()
        Object.entries(resolvedSearchParams).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                value.forEach((item) => params.append(key, item))
            } else if (value !== undefined) {
                params.set(key, value)
            }
        })
        mutator(params)
        const q = params.toString()
        return q ? `?${q}` : ""
    }

    const activePriceLabel = hasPriceFilter ? `$${priceMin} - $${priceMaxRaw}` : "Any"

    const pricePresets = [
        { min: 0, max: 500, label: "$0 - $500" },
        { min: 500, max: 1000, label: "$500 - $1000" },
        { min: 1000, max: 2500, label: "$1000 - $2500" },
        { min: 2500, max: Math.max(3000, Math.ceil(maxCategoryPrice / 100) * 100), label: `$2500 - $${Math.max(3000, Math.ceil(maxCategoryPrice / 100) * 100)}` },
    ]

    const menuShortcutBlocks = (categoryShortcutMenu?.items || [])
        .slice(0, 5)
        .map((item) => {
            if (item.type === "CATEGORY" && item.referenceId) {
                const linkedCategory = shortcutCategoryMap.get(item.referenceId)
                if (!linkedCategory) return null
                return {
                    id: item.id,
                    label: item.label || linkedCategory.title,
                    href: `/category/${linkedCategory.slug}`,
                    image: linkedCategory.image || null,
                    productCount: linkedCategory._count?.products || 0,
                }
            }

            return {
                id: item.id,
                label: item.label,
                href: item.url && item.url !== "http://" && item.url !== "https://" ? item.url : `/category/${slug}`,
                image: null,
                productCount: 0,
            }
        })
        .filter(Boolean) as Array<{ id: string; label: string; href: string; image: string | null; productCount: number }>

    const fallbackBlocks = childCounts.slice(0, 5).map((child) => ({
        id: `fallback-${child.id}`,
        label: child.title,
        href: `/category/${child.slug}`,
        image: child.image || null,
        productCount: child.productCount,
    }))

    const categoryFeatureBlocks = menuShortcutBlocks.length > 0 ? menuShortcutBlocks : fallbackBlocks

    return (
        <div className="bg-[#f5f7fb] min-h-screen pb-20">
            <div className="relative overflow-hidden border-b border-slate-200">
                {category.image ? (
                    <img src={category.image} alt={category.title} className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                    <div className="absolute inset-0 bg-[linear-gradient(120deg,#1e293b_0%,#0f172a_50%,#334155_100%)]" />
                )}
                <div className="absolute inset-0 bg-slate-900/60" />
                <div className="container relative mx-auto px-6 py-14 md:py-16">
                    <h1 className="font-serif text-4xl md:text-5xl font-bold text-white">{category.title}</h1>
                    {category.description ? (
                        <p className="mt-4 max-w-3xl text-slate-100/90 text-lg leading-relaxed">{category.description}</p>
                    ) : null}
                    {childCounts.length > 0 ? (
                        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            {childCounts.map((child) => (
                                <Link
                                    key={child.id}
                                    href={`/category/${child.slug}`}
                                    className="flex items-center gap-3 rounded-xl border border-white/25 bg-white/10 px-3 py-3 backdrop-blur-sm hover:bg-white/20"
                                >
                                    <div className="h-11 w-11 overflow-hidden rounded-md bg-white/10 border border-white/30 shrink-0">
                                        {child.image ? (
                                            <img src={child.image} alt={child.title} className="h-full w-full object-cover" />
                                        ) : null}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-white">{child.title}</p>
                                        <p className="text-xs text-white/80">{child.productCount} products</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>

            <div className="container mx-auto px-6 py-10">
                {categoryFeatureBlocks.length > 0 ? (
                    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {categoryFeatureBlocks.map((item) => (
                            <Link
                                key={item.id}
                                href={item.href}
                                className="group relative block overflow-hidden rounded-2xl border border-slate-200 bg-white"
                            >
                                <div className="relative aspect-[5/4] w-full">
                                    {item.image ? (
                                        <img src={item.image} alt={item.label} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                                    ) : (
                                        <div className="h-full w-full bg-slate-200" />
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/35 via-transparent to-transparent" />
                                </div>
                                <div className="absolute inset-x-4 bottom-4 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 text-center shadow-sm backdrop-blur-sm">
                                    <p className="truncate text-xl font-semibold text-slate-900">{item.label}</p>
                                    {item.productCount > 0 ? <p className="mt-1 text-sm text-slate-600">{item.productCount} products</p> : null}
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : null}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    <aside className="lg:col-span-3">
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-6">
                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">Product Status</h3>
                                <div className="mt-4 space-y-2">
                                    <Link
                                        href={`/category/${slug}${buildQuery((p) => (inStockOnly ? p.delete("inStock") : p.set("inStock", "true")))}`}
                                        className="flex items-center justify-between rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                    >
                                        <span>In stock only</span>
                                        <span className={`h-2.5 w-2.5 rounded-full ${inStockOnly ? "bg-teal-600" : "bg-slate-300"}`} />
                                    </Link>
                                    <Link
                                        href={`/category/${slug}${buildQuery((p) => (topRatedOnly ? p.delete("topRated") : p.set("topRated", "true")))}`}
                                        className="flex items-center justify-between rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                    >
                                        <span>Top rated only</span>
                                        <span className={`h-2.5 w-2.5 rounded-full ${topRatedOnly ? "bg-teal-600" : "bg-slate-300"}`} />
                                    </Link>
                                </div>
                            </div>

                            <div className="border-t border-slate-200 pt-5">
                                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">Filter By Color</h3>
                                <div className="mt-4 space-y-1.5">
                                    {options.colors.map((color) => {
                                        const active = selectedColors.includes(color.slug)
                                        const count = colorCountMap.get(color.slug) || 0
                                        return (
                                            <Link
                                                key={color.id}
                                                href={`/category/${slug}${buildQuery((p) => {
                                                    const existing = p.getAll("color")
                                                    p.delete("color")
                                                    if (existing.includes(color.slug)) {
                                                        existing.filter((item) => item !== color.slug).forEach((item) => p.append("color", item))
                                                    } else {
                                                        existing.forEach((item) => p.append("color", item))
                                                        p.append("color", color.slug)
                                                    }
                                                })}`}
                                                className={`flex items-center justify-between rounded-md px-2 py-2 text-sm ${active ? "bg-teal-50 text-teal-800" : "text-slate-700 hover:bg-slate-50"}`}
                                            >
                                                <span className="flex items-center gap-2">
                                                    <span className="h-3 w-3 rounded-full border border-slate-300" style={{ backgroundColor: color.hex || "#d1d5db" }} />
                                                    {color.name}
                                                </span>
                                                <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500">{count}</span>
                                            </Link>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="border-t border-slate-200 pt-5">
                                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">Filter By Price</h3>
                                <p className="mt-2 text-xs text-slate-500">Selected: {activePriceLabel}</p>
                                <div className="mt-4 space-y-2">
                                    {pricePresets.map((preset) => {
                                        const active = priceMin === preset.min && priceMaxRaw === preset.max
                                        return (
                                            <Link
                                                key={preset.label}
                                                href={`/category/${slug}${buildQuery((p) => {
                                                    p.set("priceMin", String(preset.min))
                                                    p.set("priceMax", String(preset.max))
                                                })}`}
                                                className={`block rounded-md px-2 py-2 text-sm ${active ? "bg-teal-50 text-teal-800" : "text-slate-700 hover:bg-slate-50"}`}
                                            >
                                                {preset.label}
                                            </Link>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="border-t border-slate-200 pt-5">
                                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">Category Products</h3>
                                <div className="mt-4 space-y-3">
                                    {sidebarProducts.length === 0 ? (
                                        <p className="text-sm text-slate-500">No products found in this category.</p>
                                    ) : sidebarProducts.map((product) => {
                                        const parsedImages = parseProductImages(product.images)
                                        const image = parsedImages[0] || "/placeholder.jpg"
                                        return (
                                            <Link key={product.id} href={`/product/${product.slug}`} className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-slate-50">
                                                <img src={image} alt={product.title} className="h-12 w-12 rounded-md border border-slate-200 object-cover" />
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium text-slate-900">{product.title}</p>
                                                    <p className="text-sm font-semibold text-emerald-700">${product.price.toFixed(2)}</p>
                                                </div>
                                            </Link>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </aside>

                    <section className="lg:col-span-9">
                        <div className="rounded-2xl border border-slate-200 bg-white p-5">
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                <div className="text-sm text-slate-500">
                                    Home / Shop / <span className="text-slate-900 font-medium">{category.title}</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex items-center gap-2 text-sm text-slate-700">
                                        <span className="font-semibold">Show :</span>
                                        {[8, 16, 32, 36].map((n) => (
                                            <Link
                                                key={n}
                                                href={`/category/${slug}${buildQuery((p) => p.set("show", String(n)))}`}
                                                className={showValue === n ? "font-semibold text-slate-900" : "text-slate-500 hover:text-slate-900"}
                                            >
                                                {n}
                                            </Link>
                                        ))}
                                    </div>
                                    <div className="h-5 w-px bg-slate-200" />
                                    <div className="flex items-center gap-1">
                                        <Link href={`/category/${slug}${buildQuery((p) => p.set("view", "2"))}`} className={`rounded border p-1.5 ${viewMode === "2" ? "bg-slate-900 text-white border-slate-900" : "text-slate-500 border-slate-200"}`}><Grid2x2 className="h-4 w-4" /></Link>
                                        <Link href={`/category/${slug}${buildQuery((p) => p.set("view", "3"))}`} className={`rounded border p-1.5 ${viewMode === "3" ? "bg-slate-900 text-white border-slate-900" : "text-slate-500 border-slate-200"}`}><Rows3 className="h-4 w-4" /></Link>
                                        <Link href={`/category/${slug}${buildQuery((p) => p.set("view", "4"))}`} className={`rounded border p-1.5 ${viewMode === "4" ? "bg-slate-900 text-white border-slate-900" : "text-slate-500 border-slate-200"}`}><LayoutGrid className="h-4 w-4" /></Link>
                                        <Link href={`/category/${slug}${buildQuery((p) => p.set("view", "list"))}`} className={`rounded border p-1.5 ${viewMode === "list" ? "bg-slate-900 text-white border-slate-900" : "text-slate-500 border-slate-200"}`}><List className="h-4 w-4" /></Link>
                                    </div>
                                    <form method="get" action={`/category/${slug}`} className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
                                        {Object.entries(resolvedSearchParams).flatMap(([key, value]) => {
                                            if (key === "sort" || value === undefined) return []
                                            if (Array.isArray(value)) {
                                                return value.map((item, idx) => (
                                                    <input key={`${key}-${item}-${idx}`} type="hidden" name={key} value={item} />
                                                ))
                                            }
                                            return <input key={key} type="hidden" name={key} value={value} />
                                        })}
                                        <select name="sort" defaultValue={sortValue} className="h-9 w-full min-w-0 rounded border border-slate-200 bg-white px-3 text-sm text-slate-700 sm:min-w-[190px]">
                                            <option value="latest">Default sorting</option>
                                            <option value="price-asc">Price: low to high</option>
                                            <option value="price-desc">Price: high to low</option>
                                            <option value="oldest">Oldest first</option>
                                        </select>
                                        <button type="submit" className="h-9 rounded border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">Apply</button>
                                    </form>
                                </div>
                            </div>

                            <form method="get" action={`/category/${slug}`} className="mt-4 rounded-md border border-slate-300 bg-white px-4 py-3">
                                {Object.entries(resolvedSearchParams).flatMap(([key, value]) => {
                                    if (key === "q" || value === undefined) return []
                                    if (Array.isArray(value)) {
                                        return value.map((item, idx) => (
                                            <input key={`${key}-${item}-${idx}`} type="hidden" name={key} value={item} />
                                        ))
                                    }
                                    return <input key={key} type="hidden" name={key} value={value} />
                                })}
                                <input
                                    name="q"
                                    defaultValue={query}
                                    placeholder="Search for products"
                                    className="w-full bg-transparent text-slate-900 placeholder:text-slate-400 outline-none"
                                />
                            </form>

                            <div className="mt-3 flex items-center justify-between">
                                <h2 className="text-sm font-medium text-slate-600">{products.length} products found</h2>
                                <Link href={`/category/${slug}`} className="text-sm text-slate-600 underline hover:text-slate-900">Clear all filters</Link>
                            </div>

                            {products.length === 0 ? (
                                <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-8 py-16 text-center text-slate-500">
                                    No products were found matching your selection.
                                </div>
                            ) : (
                                <div
                                    className={
                                        viewMode === "list"
                                            ? "mt-5 space-y-4"
                                            : viewMode === "2"
                                                ? "mt-5 grid grid-cols-1 gap-5 md:grid-cols-2"
                                                : viewMode === "4"
                                                    ? "mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4"
                                                    : "mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
                                    }
                                >
                                    {products.map((product) => {
                                        const parsedImages = parseProductImages(product.images)

                                        if (viewMode === "list") {
                                            const image = parsedImages[0] || "/placeholder.jpg"
                                            return (
                                                <Link key={product.id} href={`/product/${product.slug}`} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 hover:bg-slate-50 sm:flex-row">
                                                    <div className="h-40 w-full overflow-hidden rounded-md border border-slate-200 sm:h-36 sm:w-36 sm:shrink-0">
                                                        <img src={image} alt={product.title} className="h-full w-full object-cover transition-transform duration-300 hover:scale-105" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-2xl font-serif font-bold text-slate-900">{product.title}</p>
                                                        <p className="mt-1 text-sm text-slate-500">{product.categories?.map((c) => c.title).slice(0, 2).join(", ") || "Rug House Collection"}</p>
                                                        <div className="mt-3 flex items-center gap-2">
                                                            <span className="text-2xl font-bold text-slate-900">${product.price.toFixed(2)}</span>
                                                            {product.compareAtPrice && product.compareAtPrice > product.price ? (
                                                                <span className="text-base text-slate-400 line-through">${product.compareAtPrice.toFixed(2)}</span>
                                                            ) : null}
                                                        </div>
                                                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
                                                            {product.description || "Premium hand-crafted rug with authentic weaving details and durable natural fibers."}
                                                        </p>
                                                    </div>
                                                </Link>
                                            )
                                        }

                                        return <CategoryHoverProductCard key={product.id} product={product} />
                                    })}
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    )
}
