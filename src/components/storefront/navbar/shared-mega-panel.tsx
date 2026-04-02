"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { StorefrontProductImage } from "@/components/storefront/storefront-product-image"
import { buildProductImageAlt, getPrimaryProductImageCandidates } from "@/lib/product-images"
import { formatCurrency } from "@/lib/storefront/currency"
import { cn } from "@/lib/utils"

interface SharedMegaPanelProps {
    activeTab: "categories" | "information" | null
    categoryItems?: MenuNode[]
    infoItems?: MenuNode[]
    onMouseEnter: () => void
    onMouseLeave: () => void
    onLinkClick: () => void
}

type MenuNode = {
    id: string
    label: string
    url?: string | null
    referenceId?: string | null
    kind?: "PAGE" | "CATEGORY" | "CUSTOM"
    children?: MenuNode[]
}

type TreeCategory = {
    id: string
    title: string
    slug: string
    path?: string | null
    image?: string | null
    children?: TreeCategory[]
}

type TextNode = {
    id: string
    label: string
    href: string
    categoryId?: string | null
    children: TextNode[]
}

type PreviewProduct = {
    id: string
    slug: string
    title: string
    price: number
    images: string
}

type CollectionPreviewCategory = {
    id: string
    title: string
    slug: string
    path: string
    image: string | null
}

export function SharedMegaPanel({
    activeTab,
    categoryItems: initialCategoryItems = [],
    infoItems: initialInfoItems = [],
    onMouseEnter,
    onMouseLeave,
    onLinkClick,
}: SharedMegaPanelProps) {
    const [infoItems, setInfoItems] = React.useState<MenuNode[]>([])
    const [categoryTree, setCategoryTree] = React.useState<TreeCategory[]>([])
    const [activeCategoryId, setActiveCategoryId] = React.useState<string | null>(null)
    const [activeChildPath, setActiveChildPath] = React.useState<string[]>([])
    const [previewByHref, setPreviewByHref] = React.useState<Record<string, PreviewProduct[]>>({})
    const [previewLoadingHref, setPreviewLoadingHref] = React.useState<string | null>(null)
    const [collectionsItems, setCollectionsItems] = React.useState<CollectionPreviewCategory[] | null>(null)
    const [collectionsLoading, setCollectionsLoading] = React.useState(false)
    const [categoriesLoading, setCategoriesLoading] = React.useState(true)
    const [infoLoading, setInfoLoading] = React.useState(true)
    const categoriesLoadedRef = React.useRef(false)

    React.useEffect(() => {
        const fetchCategoryTree = async () => {
            if (categoriesLoadedRef.current) {
                setCategoriesLoading(false)
                return
            }
            const shouldShowLoading = !Array.isArray(initialCategoryItems) || initialCategoryItems.length === 0
            if (shouldShowLoading) {
                setCategoriesLoading(true)
            } else {
                setCategoriesLoading(false)
            }
            try {
                const response = await fetch("/api/categories?tree=true", { cache: "no-store" })
                if (!response.ok) {
                    setCategoryTree([])
                    return
                }
                const data = await response.json()
                setCategoryTree(normalizeCategoryTree(data))
                categoriesLoadedRef.current = true
            } catch {
                setCategoryTree([])
            } finally {
                setCategoriesLoading(false)
            }
        }

        void fetchCategoryTree()
    }, [initialCategoryItems])

    React.useEffect(() => {
        setInfoItems(Array.isArray(initialInfoItems) ? initialInfoItems : [])
        setInfoLoading(false)
    }, [initialInfoItems])

    const categoryNodes = React.useMemo<TextNode[]>(() => {
        if (initialCategoryItems.length > 0) {
            return normalizeMenuNodes(initialCategoryItems)
        }
        return normalizeTreeNodes(categoryTree)
    }, [initialCategoryItems, categoryTree])

    const activeCategory = React.useMemo(
        () => categoryNodes.find((item) => item.id === activeCategoryId) || categoryNodes[0] || null,
        [activeCategoryId, categoryNodes]
    )

    const activeCollectionsCategory = React.useMemo(
        () => (activeCategory && isCollectionsEntry(activeCategory) ? activeCategory : null),
        [activeCategory]
    )

    const activePreviewCategory = React.useMemo(() => {
        if (!activeCategory) return null
        if (activeChildPath.length === 0 || activeCategory.children.length === 0) return activeCategory

        let nodes = activeCategory.children
        let current: TextNode | null = null

        for (const id of activeChildPath) {
            const match = nodes.find((node) => node.id === id)
            if (!match) break
            current = match
            nodes = match.children
        }

        return current || activeCategory
    }, [activeCategory, activeChildPath])

    const previewProducts = React.useMemo(() => {
        const href = activePreviewCategory?.href || ""
        const source = previewByHref[href] || []
        return source.slice(0, 6)
    }, [activePreviewCategory, previewByHref])

    React.useEffect(() => {
        if (categoryNodes.length === 0) {
            setActiveCategoryId(null)
            return
        }
        setActiveCategoryId((current) => {
            if (current && categoryNodes.some((item) => item.id === current)) return current
            return categoryNodes[0]?.id || null
        })
    }, [categoryNodes])

    React.useEffect(() => {
        if (!activeCategory || activeCategory.children.length === 0) {
            setActiveChildPath([])
            return
        }

        setActiveChildPath((current) => {
            if (current.length === 0) return [activeCategory.children[0].id]

            let nodes = activeCategory.children
            const nextPath: string[] = []
            for (const id of current) {
                const match = nodes.find((node) => node.id === id)
                if (!match) break
                nextPath.push(match.id)
                nodes = match.children
            }
            return nextPath.length > 0 ? nextPath : [activeCategory.children[0].id]
        })
    }, [activeCategory])

    React.useEffect(() => {
        const href = activePreviewCategory?.href
        if (!href || href === "#" || previewByHref[href]) return

        let cancelled = false
        setPreviewLoadingHref(href)

        const load = async () => {
            try {
                const response = await fetch(`/api/categories/previews?path=${encodeURIComponent(href)}`, { cache: "no-store" })
                const data = await response.json().catch(() => ({ products: [] })) as { products?: PreviewProduct[] }
                if (cancelled) return
                setPreviewByHref((current) => ({ ...current, [href]: Array.isArray(data.products) ? data.products : [] }))
            } catch {
                if (cancelled) return
                setPreviewByHref((current) => ({ ...current, [href]: [] }))
            } finally {
                if (!cancelled) setPreviewLoadingHref((current) => (current === href ? null : current))
            }
        }

        void load()

        return () => {
            cancelled = true
        }
    }, [activePreviewCategory, previewByHref])

    React.useEffect(() => {
        if (!activeCollectionsCategory) {
            setCollectionsItems(null)
            setCollectionsLoading(false)
            return
        }

        let cancelled = false
        setCollectionsLoading(true)

        const params = new URLSearchParams()
        if (activeCollectionsCategory.categoryId) {
            params.set("categoryId", activeCollectionsCategory.categoryId)
        }
        const slugToken = getLastPathToken(activeCollectionsCategory.href)
        if (slugToken) {
            params.set("slug", slugToken)
        } else {
            params.set("slug", "collections")
        }

        const loadCollectionsChildren = async () => {
            try {
                const response = await fetch(`/api/categories/collections?${params.toString()}`, { cache: "no-store" })
                const data = await response.json().catch(() => ({ children: [] })) as { children?: CollectionPreviewCategory[] }
                if (cancelled) return
                setCollectionsItems(Array.isArray(data.children) ? data.children : [])
            } catch {
                if (cancelled) return
                setCollectionsItems([])
            } finally {
                if (!cancelled) setCollectionsLoading(false)
            }
        }

        void loadCollectionsChildren()

        return () => {
            cancelled = true
        }
    }, [activeCollectionsCategory])

    if (!activeTab) return null

    return (
        <div
            className={cn(
                "absolute top-full z-50 overflow-hidden transition-[opacity,transform] duration-150 ease-out",
                activeTab === "categories" ? "left-0 mt-1 w-full" : "right-0 mt-1"
            )}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {activeTab === "categories" && (
                <div className="w-full border-y border-[#ece5dc] bg-white shadow-[0_22px_50px_rgba(26,25,22,0.08)]">
                    <div className="grid min-h-[320px] grid-cols-[252px_minmax(0,1fr)] items-stretch">
                        <aside className="border-r border-[#d7e4dc] bg-[#edf5f0] px-8 py-7">
                            <p className="mb-5 text-[10px] font-medium uppercase tracking-[0.22em] text-[#8c8070]">
                                Shop Collections
                            </p>
                            {categoriesLoading ? (
                                <p className="text-sm text-[#8c8070]">Loading categories...</p>
                            ) : categoryNodes.length === 0 ? (
                                <p className="text-sm text-[#8c8070]">No categories found.</p>
                            ) : (
                                <ul className="space-y-2.5">
                                    {categoryNodes.map((group) => {
                                        const active = group.id === activeCategory?.id
                                        return (
                                            <li key={group.id}>
                                                <Link
                                                    href={group.href}
                                                    onClick={onLinkClick}
                                                    onMouseEnter={() => setActiveCategoryId(group.id)}
                                                    onFocus={() => setActiveCategoryId(group.id)}
                                                    className={cn(
                                                        "group flex items-center justify-between rounded-sm px-4 py-3 font-serif text-[16px] font-medium text-[#2d2a26] transition-all duration-300",
                                                        active
                                                            ? "bg-[#f4ede5] text-[#1f1b16] shadow-[inset_0_0_0_1px_rgba(88,75,61,0.05)]"
                                                            : "hover:bg-[#faf5ef] hover:text-[#1f1b16]"
                                                    )}
                                                >
                                                    <span>{group.label}</span>
                                                    <ChevronRight
                                                        className={cn(
                                                            "h-4 w-4 transition-transform duration-300",
                                                            active ? "translate-x-0.5 text-[#6b645b]" : "text-[#9b9389] group-hover:translate-x-0.5"
                                                        )}
                                                    />
                                                </Link>
                                            </li>
                                        )
                                    })}
                                </ul>
                            )}
                        </aside>

                        <div className="bg-white px-9 py-7">
                            {categoriesLoading ? (
                                <div className="flex h-40 items-center justify-center text-sm text-[#8c8070]">Loading categories...</div>
                            ) : activeCategory ? (
                                <div className="max-w-[840px]">
                                    <div className="mb-5 flex items-center gap-4">
                                        <h3 className="font-serif text-[26px] font-semibold tracking-[-0.02em] text-[#231f1a]">
                                            {activeCategory.label}
                                        </h3>
                                        <div className="h-px flex-1 bg-[#e7ddd1]" />
                                    </div>

                                    {activeCollectionsCategory ? (
                                        <CollectionsCategoryGrid
                                            items={collectionsItems || []}
                                            loading={collectionsLoading}
                                            onLinkClick={onLinkClick}
                                        />
                                    ) : activeCategory.children.length > 0 ? (
                                        <CategoryTextColumns
                                            items={activeCategory.children}
                                            activePath={activeChildPath}
                                            setActivePath={setActiveChildPath}
                                            onLinkClick={onLinkClick}
                                            previewProducts={previewProducts}
                                            previewLoading={previewLoadingHref === activePreviewCategory?.href}
                                        />
                                    ) : getSafeUrl(activeCategory.href) !== "#" ? (
                                        <div className="space-y-5">
                                            <Link href={activeCategory.href} onClick={onLinkClick} className="text-sm text-slate-600 hover:text-teal-700">
                                                {activeCategory.label}
                                            </Link>
                                            <ProductPreviewGrid
                                                products={previewProducts}
                                                loading={previewLoadingHref === activePreviewCategory?.href}
                                                emptyLabel="No products found in this category yet."
                                                onLinkClick={onLinkClick}
                                                columns={3}
                                                maxItems={6}
                                                compact
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex h-32 items-center justify-center text-sm text-[#8c8070]">No subcategories found.</div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex h-40 items-center justify-center text-sm text-[#8c8070]">No categories found.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === "information" && (
                <div className="w-[900px] rounded-[22px] border border-[#dce3ed] bg-white p-8 shadow-[0_22px_50px_rgba(15,23,42,0.12)]">
                    {infoLoading ? (
                        <div className="flex h-40 items-center justify-center text-sm text-slate-400">Loading information...</div>
                    ) : infoItems.length === 0 ? (
                        <div className="flex h-40 items-center justify-center text-sm text-slate-400">No information pages available.</div>
                    ) : (
                        <div className="grid grid-cols-3 gap-8">
                            {infoItems.map((col) => (
                                <div key={col.id} className="space-y-4">
                                    <h4 className="mb-4 border-b border-slate-100 pb-2 font-serif text-lg font-semibold text-slate-900">
                                        {col.label}
                                    </h4>
                                    <ul className="space-y-2">
                                        {col.children && col.children.length > 0 ? (
                                            col.children.map((child) => (
                                                <li key={child.id}>
                                                    <Link
                                                        href={getSafeUrl(child.url)}
                                                        onClick={onLinkClick}
                                                        className="block text-sm text-slate-600 transition-all hover:translate-x-1 hover:text-teal-700"
                                                    >
                                                        {child.label}
                                                    </Link>
                                                </li>
                                            ))
                                        ) : getSafeUrl(col.url) !== "#" ? (
                                            <li>
                                                <Link href={getSafeUrl(col.url)} onClick={onLinkClick} className="text-sm text-slate-600 hover:text-teal-700">
                                                    {col.label}
                                                </Link>
                                            </li>
                                        ) : (
                                            <li className="text-xs italic text-slate-300">No links</li>
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

function CategoryTextColumns({
    items,
    activePath,
    setActivePath,
    onLinkClick,
    previewProducts,
    previewLoading,
}: {
    items: TextNode[]
    activePath: string[]
    setActivePath: React.Dispatch<React.SetStateAction<string[]>>
    onLinkClick: () => void
    previewProducts: PreviewProduct[]
    previewLoading: boolean
}) {
    const activeNode = items.find((item) => item.id === activePath[0]) || items[0] || null
    const hasDeeperSubcategories = Boolean(activeNode?.children.length)

    React.useEffect(() => {
        if (items.length === 0) {
            setActivePath([])
            return
        }
        setActivePath((current) => {
            if (current[0] && items.some((item) => item.id === current[0])) return current
            return [items[0].id]
        })
    }, [items, setActivePath])

    return (
        <div className="grid grid-cols-[240px_minmax(0,1fr)] gap-8">
            <ul className="space-y-2 border-r border-[#ece5dc] pr-8">
                {items.map((item) => {
                    const active = item.id === activeNode?.id
                    return (
                        <li key={item.id}>
                            <Link
                                href={item.href}
                                onClick={onLinkClick}
                                onMouseEnter={() => setActivePath([item.id])}
                                onFocus={() => setActivePath([item.id])}
                                className={cn(
                                    "group flex items-center justify-between rounded-sm px-3 py-2.5 text-sm font-medium text-[#3f3a34] transition-colors",
                                    active ? "bg-[#f7f2eb] text-[#201c17]" : "hover:bg-[#fbf8f3] hover:text-[#201c17]"
                                )}
                            >
                                <span className="truncate">{item.label}</span>
                                {item.children.length > 0 ? (
                                    <ChevronRight className={cn("h-4 w-4 text-[#9b9389] transition-transform", active ? "translate-x-0.5" : "group-hover:translate-x-0.5")} />
                                ) : null}
                            </Link>
                        </li>
                    )
                })}
            </ul>

            <div className="min-w-0">
                {hasDeeperSubcategories ? (
                    <div className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-5">
                        <div className="min-w-0">
                            {activeNode?.children.length ? (
                                <NestedTextList
                                    items={activeNode.children}
                                    pathPrefix={[activeNode.id]}
                                    activePath={activePath}
                                    setActivePath={setActivePath}
                                    onLinkClick={onLinkClick}
                                />
                            ) : (
                                <div className="pt-2 text-sm text-[#8c8070]">No deeper subcategories found.</div>
                            )}
                        </div>
                        <div className="min-w-0 pt-1">
                            <ProductPreviewGrid
                                products={previewProducts}
                                loading={previewLoading}
                                emptyLabel="No products found in this category yet."
                                onLinkClick={onLinkClick}
                                columns={2}
                                maxItems={4}
                                compact
                            />
                        </div>
                    </div>
                ) : (
                    <div className="pt-1">
                        <ProductPreviewGrid
                            products={previewProducts}
                            loading={previewLoading}
                            emptyLabel="No products found in this category yet."
                            onLinkClick={onLinkClick}
                            columns={3}
                            maxItems={6}
                            compact
                        />
                    </div>
                )}
            </div>
        </div>
    )
}

function NestedTextList({
    items,
    pathPrefix,
    activePath,
    setActivePath,
    onLinkClick,
    depth = 0,
}: {
    items: TextNode[]
    pathPrefix: string[]
    activePath: string[]
    setActivePath: React.Dispatch<React.SetStateAction<string[]>>
    onLinkClick: () => void
    depth?: number
}) {
    return (
        <ul className={cn("space-y-1", depth > 0 && "mt-2 border-l border-[#ece5dc] pl-4")}>
            {items.map((item) => {
                const currentPath = [...pathPrefix, item.id]
                const isBranchOpen = currentPath.every((segment, index) => activePath[index] === segment)
                return (
                    <li key={item.id}>
                        <div
                            className={cn(
                                "flex items-start justify-between gap-3 rounded-sm px-3 py-2 transition-colors",
                                isBranchOpen ? "bg-[#faf6f0]" : "hover:bg-[#fcf8f3]"
                            )}
                            onMouseEnter={() => setActivePath(currentPath)}
                        >
                            <Link
                                href={item.href}
                                onClick={onLinkClick}
                                onFocus={() => setActivePath(currentPath)}
                                className={cn(
                                    "min-w-0 flex-1 text-sm transition-colors hover:text-teal-700",
                                    depth === 0 ? "font-medium text-[#2d2a26]" : "text-[#5f584f]"
                                )}
                            >
                                <span className="flex items-center gap-2">
                                    {depth > 0 ? <span className="h-px w-3 shrink-0 bg-[#d9cec0]" /> : null}
                                    <span className="truncate">{item.label}</span>
                                </span>
                            </Link>
                            {item.children.length > 0 ? <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#9b9389]" /> : null}
                        </div>
                        {item.children.length > 0 && isBranchOpen ? (
                            <NestedTextList
                                items={item.children}
                                pathPrefix={currentPath}
                                activePath={activePath}
                                setActivePath={setActivePath}
                                onLinkClick={onLinkClick}
                                depth={depth + 1}
                            />
                        ) : null}
                    </li>
                )
            })}
        </ul>
    )
}

function normalizeCategoryTree(items: unknown): TreeCategory[] {
    if (!Array.isArray(items)) return []
    return items
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item, index) => ({
            id: typeof item.id === "string" ? item.id : `category-${index}`,
            title: typeof item.title === "string" && item.title.trim().length > 0 ? item.title.trim() : "Category",
            slug: typeof item.slug === "string" ? item.slug : "",
            path: typeof item.path === "string" ? item.path : null,
            image: typeof item.image === "string" ? item.image : null,
            children: normalizeCategoryTree(item.children),
        }))
        .filter((item) => item.slug.length > 0)
}

function normalizeTreeNodes(items: TreeCategory[]): TextNode[] {
    return items.map((item) => ({
        id: item.id,
        label: item.title,
        href: item.path || `/${item.slug}`,
        categoryId: item.id,
        children: normalizeTreeNodes(item.children || []),
    }))
}

function normalizeMenuNodes(items: MenuNode[]): TextNode[] {
    return items.map((item) => ({
        id: item.id,
        label: item.label,
        href: getSafeUrl(item.url),
        categoryId: item.kind === "CATEGORY" ? item.referenceId || null : null,
        children: normalizeMenuNodes(item.children || []),
    }))
}

function getSafeUrl(url: string | null | undefined): string {
    if (!url) return "#"
    if (url === "https://" || url === "http://") return "#"
    return url
}

function normalizeCategoryToken(value: string | null | undefined): string {
    return (value || "")
        .trim()
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]+/g, "")
}

function getLastPathToken(path: string | null | undefined): string {
    const safePath = getSafeUrl(path)
    if (safePath === "#") return ""
    const trimmed = safePath.replace(/[?#].*$/, "").replace(/\/+$/, "")
    const segments = trimmed.split("/").filter(Boolean)
    return normalizeCategoryToken(segments[segments.length - 1] || "")
}

function isCollectionsEntry(node: TextNode): boolean {
    return normalizeCategoryToken(node.label) === "collections" || getLastPathToken(node.href) === "collections"
}

function CollectionsCategoryGrid({
    items,
    loading,
    onLinkClick,
}: {
    items: CollectionPreviewCategory[]
    loading: boolean
    onLinkClick: () => void
}) {
    if (loading) {
        return (
            <div className="grid grid-cols-5 gap-x-4 gap-y-5">
                {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="min-w-0">
                        <div className="overflow-hidden rounded-[16px] border border-[#ece5dc] bg-[#f8f5f0]">
                            <div className="aspect-[4/5] animate-pulse bg-[#efe7dc]" />
                        </div>
                        <div className="mx-auto mt-2.5 h-4 w-3/4 animate-pulse rounded bg-[#efe7dc]" />
                    </div>
                ))}
            </div>
        )
    }

    const visibleItems = items.slice(0, 15)

    if (visibleItems.length === 0) {
        return (
            <div className="rounded-[18px] border border-dashed border-[#ece5dc] bg-[#faf7f2] px-4 py-8 text-sm text-[#8c8070]">
                No collection categories found.
            </div>
        )
    }

    return (
        <div className="grid grid-cols-5 gap-x-4 gap-y-5">
            {visibleItems.map((item) => {
                const href = getSafeUrl(item.path || `/${item.slug}`)
                return (
                    <Link
                        key={item.id}
                        href={href}
                        onClick={onLinkClick}
                        className="group min-w-0"
                    >
                        <div className="overflow-hidden rounded-[16px] border border-[#ece5dc] bg-[#f8f5f0] shadow-[0_8px_20px_rgba(32,26,20,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(32,26,20,0.08)]">
                            <div className="relative aspect-[4/5] overflow-hidden bg-[linear-gradient(180deg,#f5efe6_0%,#ece2d5_100%)]">
                                {item.image ? (
                                    <img
                                        src={item.image}
                                        alt={item.title}
                                        loading="lazy"
                                        decoding="async"
                                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#f7f2eb_0%,#e8ddd1_100%)] px-4 text-center">
                                        <span className="font-serif text-lg font-semibold tracking-[-0.02em] text-[#7b6b58]">
                                            {item.title}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <p className="mt-2.5 line-clamp-2 text-center text-[13px] font-medium leading-5 text-[#312b25] transition-colors group-hover:text-[#7c6a52]">
                            {item.title}
                        </p>
                    </Link>
                )
            })}
        </div>
    )
}

function ProductPreviewGrid({
    products,
    loading,
    emptyLabel,
    onLinkClick,
    columns = 2,
    maxItems = 4,
    compact = false,
}: {
    products: PreviewProduct[]
    loading: boolean
    emptyLabel: string
    onLinkClick: () => void
    columns?: 1 | 2 | 3
    maxItems?: number
    compact?: boolean
}) {
    const visibleProducts = products.slice(0, maxItems)
    const gridClass =
        columns === 3 ? "grid-cols-3" : columns === 1 ? "grid-cols-1" : "grid-cols-2"
    const cardRadius = compact ? "rounded-[14px]" : "rounded-[18px]"
    const imageAspect = compact ? "aspect-[4/3]" : "aspect-[4/3]"

    if (loading) {
        return (
            <div className={cn("grid gap-3", gridClass)}>
                {Array.from({ length: Math.min(maxItems, columns * 2) }).map((_, slot) => (
                    <div key={slot} className={cn("overflow-hidden border border-[#ece5dc] bg-[#faf7f2]", cardRadius)}>
                        <div className={cn("animate-pulse bg-[#f1ebe2]", imageAspect)} />
                        <div className={cn("space-y-2", compact ? "px-2.5 py-2.5" : "px-3 py-3")}>
                            <div className="h-3 w-3/4 animate-pulse rounded bg-[#ece4d9]" />
                            <div className="h-3 w-1/3 animate-pulse rounded bg-[#ece4d9]" />
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    if (products.length === 0) {
        return <div className="rounded-[18px] border border-dashed border-[#ece5dc] bg-[#faf7f2] px-4 py-8 text-sm text-[#8c8070]">{emptyLabel}</div>
    }

    return (
        <div className={cn("grid gap-3", visibleProducts.length === 1 ? "grid-cols-1" : gridClass)}>
            {visibleProducts.map((product) => {
                const candidates = getPrimaryProductImageCandidates(product.images)
                const imageAlt = buildProductImageAlt({ title: product.title })
                return (
                    <Link
                        key={product.id}
                        href={`/product/${product.slug}`}
                        onClick={onLinkClick}
                        className={cn(
                            "group overflow-hidden border border-[#ece5dc] bg-[#fffdfa] shadow-[0_8px_20px_rgba(32,26,20,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(32,26,20,0.08)]",
                            cardRadius
                        )}
                    >
                        <div className={cn("relative overflow-hidden bg-[linear-gradient(180deg,#f4ede3_0%,#ede3d6_100%)]", imageAspect, compact ? "p-2.5" : "p-3")}>
                            <StorefrontProductImage
                                candidates={candidates}
                                alt={imageAlt}
                                fill
                                sizes={columns === 3 ? "(max-width: 1280px) 180px, 220px" : "(max-width: 1280px) 220px, 260px"}
                                className="transition-transform duration-500 group-hover:scale-105"
                            />
                        </div>
                        <div className={cn(compact ? "px-2.5 py-2.5" : "px-3 py-3")}>
                            <p className={cn("line-clamp-2 font-medium text-[#2d2a26]", compact ? "text-[12px] leading-4" : "text-[13px] leading-5")}>
                                {product.title}
                            </p>
                            <p className={cn("mt-1 font-semibold text-[#7c6a52]", compact ? "text-[11px]" : "text-[12px]")}>
                                {formatCurrency(product.price)}
                            </p>
                        </div>
                    </Link>
                )
            })}
        </div>
    )
}
