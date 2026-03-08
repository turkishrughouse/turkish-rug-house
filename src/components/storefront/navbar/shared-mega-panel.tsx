"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { parseProductImages } from "@/lib/product-images"
// Import data from the original files to avoid duplication
import { CATEGORIES } from "./mega-menu"

interface SharedMegaPanelProps {
    activeTab: 'categories' | 'information' | null
    onMouseEnter: () => void
    onMouseLeave: () => void
    onLinkClick: () => void
}

type MenuNode = {
    id: string
    label: string
    url?: string | null
    children?: MenuNode[]
}

type PreviewProduct = {
    id: string
    slug: string
    title: string
    images: string
}

type TreeCategory = {
    id: string
    title: string
    slug: string
    children?: Array<{
        id: string
        title: string
        slug: string
    }>
}

const CUSHION_COVERS = [
    `16" x 16" - 40x40 cm`,
    `18" x 18"`,
    `20" x 12"`,
    `20" x 20"`,
    `24" x 16"`,
    `24" x 24"`,
    `28" x 20"`,
    "Suzani Pillows",
    "Ikat Pillows",
    "Velvet Pillows",
]

const CATEGORY_GROUPS = [
    { key: "byArea", label: "By Area", categorySlug: "by-area", items: [] as string[], hrefBase: "/category", filterParam: "category" },
    { key: "byType", label: "By Type", categorySlug: "by-type", items: CATEGORIES.byType, hrefBase: "/category", filterParam: "type" },
    { key: "byStyle", label: "By Style", categorySlug: "by-style", items: CATEGORIES.byStyle, hrefBase: "/category", filterParam: "style" },
    { key: "byColor", label: "By Color", categorySlug: "by-color", items: CATEGORIES.byColor, hrefBase: "/category", filterParam: "color" },
    { key: "bySize", label: "By Size", categorySlug: "by-size", items: CATEGORIES.bySize, hrefBase: "/category", filterParam: "size" },
    { key: "byAge", label: "By Age", categorySlug: "by-age", items: CATEGORIES.byAge, hrefBase: "/category", filterParam: "age" },
    { key: "cushionCovers", label: "Cushion Covers", categorySlug: "cushion-covers", items: CUSHION_COVERS, hrefBase: "/category", filterParam: "category" },
] as const

export function SharedMegaPanel({ activeTab, onMouseEnter, onMouseLeave, onLinkClick }: SharedMegaPanelProps) {
    const [infoItems, setInfoItems] = React.useState<MenuNode[]>([])
    const [categoryTree, setCategoryTree] = React.useState<TreeCategory[]>([])
    const [activeCategoryGroup, setActiveCategoryGroup] = React.useState<string>("byArea")
    const [activeSubCategory, setActiveSubCategory] = React.useState("")
    const [previewProducts, setPreviewProducts] = React.useState<PreviewProduct[]>([])
    const [previewLoading, setPreviewLoading] = React.useState(false)
    const [hoverNonce, setHoverNonce] = React.useState(0)
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
        const fetchCategoryTree = async () => {
            try {
                const response = await fetch("/api/categories?tree=true", { cache: "no-store" })
                if (!response.ok) {
                    setCategoryTree([])
                    return
                }
                const data = await response.json()
                setCategoryTree(Array.isArray(data) ? (data as TreeCategory[]) : [])
            } catch {
                setCategoryTree([])
            }
        }

        const fetchInfoData = async () => {
            setLoading(true)
            try {
                // Fetch HEADER_INFORMATION menu
                // Using the specific location endpoint we created
                const menuRes = await fetch('/api/public/menus/location/HEADER_INFORMATION', { cache: "no-store" })

                if (menuRes.ok) {
                    const menuData = await menuRes.json()
                    // Check if items exist
                    if (menuData && menuData.items) {
                        // The API already returns a tree structure in 'items'
                        setInfoItems(menuData.items as MenuNode[])
                    } else {
                        setInfoItems([])
                    }
                } else {
                    console.log('[SharedMegaPanel] HEADER_INFORMATION menu not found')
                    setInfoItems([])
                }
            } catch (err) {
                console.error('[SharedMegaPanel] Failed to fetch Information menu', err)
                setInfoItems([])
            } finally {
                setLoading(false)
            }
        }

        if (activeTab === 'categories') {
            setActiveCategoryGroup("byArea")
            setActiveSubCategory(CATEGORY_GROUPS[0].items[0] || "")
            setLoading(false)
            fetchCategoryTree()
        } else if (activeTab === 'information') {
            fetchInfoData()
        }
    }, [activeTab])

    const menuGroups = React.useMemo(() => {
        if (!categoryTree.length) return CATEGORY_GROUPS

        const systemCategorySlugs = new Set<string>(CATEGORY_GROUPS.map((group) => group.categorySlug))
        const baseGroups = CATEGORY_GROUPS.map((group) => {
            const treeGroup = categoryTree.find((cat) => cat.slug === group.categorySlug)
            if (group.key === "byArea") {
                if (treeGroup?.children?.length) {
                    const childTitles = treeGroup.children.map((child) => child.title).filter(Boolean)
                    return { ...group, items: childTitles, filterParam: "category" as const }
                }
                const rootAreaItems = categoryTree
                    .filter((cat) => !systemCategorySlugs.has(cat.slug))
                    .map((cat) => cat.title)
                    .filter(Boolean)
                return { ...group, items: rootAreaItems, filterParam: "category" as const }
            }
            if (!treeGroup?.children?.length) return group
            const childTitles = treeGroup.children.map((child) => child.title).filter(Boolean)
            return childTitles.length > 0
                ? { ...group, items: childTitles, filterParam: "category" as const }
                : group
        })

        const usedBaseCategorySlugs = new Set<string>(CATEGORY_GROUPS.map((group) => group.categorySlug))
        const usedBaseLabels = new Set(CATEGORY_GROUPS.map((group) => slugify(group.label.trim())))
        const extraGroups = categoryTree
            .filter((cat) => !usedBaseCategorySlugs.has(cat.slug))
            .filter((cat) => !usedBaseLabels.has(slugify(cat.title.trim())))
            .map((cat) => ({
                key: `dynamic-${cat.slug}`,
                label: cat.title,
                categorySlug: cat.slug,
                items: (cat.children?.map((child) => child.title).filter(Boolean) || []),
                hrefBase: "/category",
                filterParam: "category" as const,
            }))
            .filter((group) => group.items.length > 0)

        return [...baseGroups, ...extraGroups]
    }, [categoryTree])

    const selectedGroup = menuGroups.find((group) => group.key === activeCategoryGroup) || menuGroups[0]
    const selectedTreeGroup = React.useMemo(() => {
        const groupSlug = "categorySlug" in selectedGroup ? selectedGroup.categorySlug : undefined
        if (!groupSlug) return null
        return categoryTree.find((cat) => cat.slug === groupSlug) || null
    }, [selectedGroup, categoryTree])

    const resolveMenuItemHref = React.useCallback((itemLabel: string) => {
        const fromTree = selectedTreeGroup?.children?.find(
            (child) => child.title.trim().toLowerCase() === itemLabel.trim().toLowerCase()
        )
        if (fromTree?.slug) return `/category/${fromTree.slug}`
        const fromRoot = categoryTree.find(
            (cat) => cat.title.trim().toLowerCase() === itemLabel.trim().toLowerCase()
        )
        if (fromRoot?.slug) return `/category/${fromRoot.slug}`
        const fallbackQuery = encodeURIComponent(itemLabel.trim())
        return fallbackQuery ? `/shop?q=${fallbackQuery}` : "/shop"
    }, [selectedTreeGroup, categoryTree])

    const submenuColumns = React.useMemo(() => {
        const cols: string[][] = []
        for (let i = 0; i < selectedGroup.items.length; i += 6) {
            cols.push(selectedGroup.items.slice(i, i + 6))
        }
        return cols
    }, [selectedGroup])
    const previewSlots = React.useMemo<(PreviewProduct | null)[]>(() => {
        const slots: (PreviewProduct | null)[] = [...previewProducts]
        while (slots.length < 4) slots.push(null)
        return slots.slice(0, 4)
    }, [previewProducts])

    const handleGroupHover = React.useCallback((groupKey: string) => {
        const targetGroup = menuGroups.find((group) => group.key === groupKey) || menuGroups[0]
        setActiveCategoryGroup(targetGroup.key)
        setActiveSubCategory(targetGroup.items[0] || "")
        setHoverNonce((prev) => prev + 1)
    }, [menuGroups])

    React.useEffect(() => {
        const firstItem = selectedGroup.items[0] || ""
        setActiveSubCategory(firstItem)
    }, [selectedGroup])

    React.useEffect(() => {
        if (activeTab !== "categories" || !activeSubCategory) {
            setPreviewProducts([])
            return
        }

        const controller = new AbortController()
        const fetchPreviewProducts = async () => {
            setPreviewLoading(true)
            try {
                const slug = slugify(activeSubCategory)
                const params = new URLSearchParams({ limit: "120", sort: "latest" })
                params.set(selectedGroup.filterParam, slug)

                const primaryResponse = await fetch(`/api/v1/public/products?${params.toString()}`, {
                    cache: "no-store",
                    signal: controller.signal,
                })
                const primaryData = await primaryResponse.json().catch(() => ({ products: [] as PreviewProduct[], metadata: { total: 0 } }))
                let products = Array.isArray(primaryData?.products) ? (primaryData.products as PreviewProduct[]) : []
                let total = Number(primaryData?.metadata?.total || products.length)

                if (products.length === 0 && selectedGroup.filterParam !== "category") {
                    const fallbackParams = new URLSearchParams({ limit: "120", sort: "latest", category: slug })
                    const fallbackResponse = await fetch(`/api/v1/public/products?${fallbackParams.toString()}`, {
                        cache: "no-store",
                        signal: controller.signal,
                    })
                    const fallbackData = await fallbackResponse.json().catch(() => ({ products: [] as PreviewProduct[], metadata: { total: 0 } }))
                    products = Array.isArray(fallbackData?.products) ? (fallbackData.products as PreviewProduct[]) : []
                    total = Number(fallbackData?.metadata?.total || products.length)
                }

                const source = total > 100 ? [...products].sort(() => Math.random() - 0.5) : products
                setPreviewProducts(source.slice(0, 4))
            } catch {
                setPreviewProducts([])
            } finally {
                setPreviewLoading(false)
            }
        }

        fetchPreviewProducts()
        return () => controller.abort()
    }, [activeTab, selectedGroup, activeSubCategory, hoverNonce])

    if (!activeTab) return null

    return (
        <div
            className={cn(
                "absolute top-full mt-1 z-50 bg-white border border-slate-100 shadow-xl rounded-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200",
                activeTab === 'categories' ? "left-0" : "right-0"
            )}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {activeTab === 'categories' && (
                <div className="w-[min(1240px,calc(100vw-80px))] bg-white">
                    <div className="grid min-h-[500px] grid-cols-[240px_minmax(0,1fr)]">
                        <aside className="h-full border-r border-[#93b1aa] bg-[#a6c2bb] p-3">
                            <ul className="flex h-full flex-col justify-start gap-2 py-2 pr-1">
                                {menuGroups.map((group) => {
                                    const active = activeCategoryGroup === group.key
                                    return (
                                        <li key={group.key}>
                                            <button
                                                type="button"
                                                onMouseEnter={() => handleGroupHover(group.key)}
                                                onFocus={() => handleGroupHover(group.key)}
                                                className={cn(
                                                    "flex w-full items-center justify-between rounded-md px-3.5 py-3.5 text-left text-sm font-medium transition-colors",
                                                    active
                                                        ? "bg-white text-slate-900"
                                                        : "text-white hover:bg-white/20"
                                                )}
                                            >
                                                <span>{group.label}</span>
                                                <ChevronRight className={cn("h-4 w-4", active ? "text-slate-500" : "text-white/90")} />
                                            </button>
                                        </li>
                                    )
                                })}
                            </ul>
                        </aside>

                        <div className="flex h-full flex-col p-6">
                            <h4 className="font-serif text-xl font-semibold text-slate-900">{selectedGroup.label}</h4>
                            <div className="mt-4 max-h-[236px] overflow-x-auto overflow-y-auto pb-2">
                                <div className="flex w-max min-w-full">
                                    {submenuColumns.map((column, columnIndex) => (
                                        <ul
                                            key={`${selectedGroup.key}-${columnIndex}`}
                                            className={`w-[190px] space-y-2 px-4 ${columnIndex < submenuColumns.length - 1 ? "border-r border-[#eef2f7]" : ""}`}
                                        >
                                            {column.map((item) => (
                                                <li key={item}>
                                                    <Link
                                                        href={resolveMenuItemHref(item)}
                                                        onClick={onLinkClick}
                                                        onMouseEnter={() => {
                                                            setActiveSubCategory(item)
                                                            setHoverNonce((prev) => prev + 1)
                                                        }}
                                                        className={cn(
                                                            "block whitespace-nowrap rounded px-1.5 py-0.5 text-sm transition-colors",
                                                            activeSubCategory === item ? "bg-slate-100 text-teal-700" : "text-slate-600 hover:text-teal-700"
                                                        )}
                                                    >
                                                        {item}
                                                    </Link>
                                                </li>
                                            ))}
                                        </ul>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-4 border-t border-[#eef2f7] pt-4">
                                <div className="mb-2 flex items-center justify-between">
                                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                                        {activeSubCategory} Picks
                                    </p>
                                    {previewLoading ? <span className="text-xs text-slate-400">Loading...</span> : null}
                                </div>

                                {previewProducts.length > 0 ? (
                                    <div className="flex flex-wrap gap-3">
                                        {previewSlots.map((product, index) => {
                                            if (!product) {
                                                return (
                                                    <div key={`preview-empty-${index}`} className="w-[118px]">
                                                        <div className="aspect-square rounded-md border border-dashed border-[#edf1f6] bg-slate-50" />
                                                    </div>
                                                )
                                            }
                                            const image = parseMainImage(product.images)
                                            return (
                                                <Link
                                                    key={product.id}
                                                    href={`/product/${product.slug}`}
                                                    onClick={onLinkClick}
                                                    className="group block w-[118px]"
                                                >
                                                    <div className="aspect-square overflow-hidden rounded-md border border-[#edf1f6] bg-white">
                                                        <img
                                                            src={image}
                                                            alt={product.title}
                                                            className="h-full w-full object-contain p-1 transition-transform duration-300 group-hover:scale-105"
                                                        />
                                                    </div>
                                                    <p className="mt-1 line-clamp-1 text-[11px] text-slate-600 group-hover:text-teal-700">
                                                        {product.title}
                                                    </p>
                                                </Link>
                                            )
                                        })}
                                    </div>
                                ) : !previewLoading ? (
                                    <p className="text-sm text-slate-400">No products found for this category.</p>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'information' && (
                <div className="w-[900px] p-8">
                    {loading ? (
                        <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Loading information...</div>
                    ) : infoItems.length === 0 ? (
                        <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
                            Information Menu is empty. Configure it in Menus. (Location: INFORMATION)
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-8">
                            {infoItems.map((col) => (
                                <div key={col.id} className="space-y-4">
                                    <h4 className="font-serif text-lg font-semibold text-slate-900 border-b border-slate-100 pb-2 mb-4">
                                        {col.label}
                                    </h4>
                                    <ul className="space-y-2">
                                        {col.children && col.children.length > 0 ? (
                                            col.children.map((child) => (
                                                <li key={child.id}>
                                                    <Link
                                                        href={getSafeUrl(child.url)}
                                                        onClick={onLinkClick}
                                                        className="block text-sm text-slate-600 hover:text-teal-700 hover:translate-x-1 transition-all"
                                                    >
                                                        {child.label}
                                                    </Link>
                                                </li>
                                            ))
                                        ) : ( // Handle flat list if user didn't nest items? 
                                            // Or if this item is a link itself? 
                                            // Typically Mega Menu expects Roots as Columns and Children as Links.
                                            // If root has no children, maybe render it as a link?
                                            // For now, assume structure: Column Header -> Links.
                                            // But if no children, show label as link if URL exists?
                                            getSafeUrl(col.url) !== "#" ? (
                                                <li>
                                                    <Link href={getSafeUrl(col.url)} onClick={onLinkClick} className="text-sm text-slate-600 hover:text-teal-700">{col.label}</Link>
                                                </li>
                                            ) : (
                                                <li className="text-xs text-slate-300 italic">No links</li>
                                            )
                                        )}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function slugify(text: string) {
    return text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '')
}

function getSafeUrl(url: string | null | undefined): string {
    if (!url) return "#"
    if (url === "https://" || url === "http://") return "#"
    return url
}

function parseMainImage(images: string) {
    return parseProductImages(images)[0] || "/placeholder.jpg"
}
