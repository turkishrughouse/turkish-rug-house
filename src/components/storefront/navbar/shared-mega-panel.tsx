"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { getImageUrl } from "@/lib/storage/url"

interface SharedMegaPanelProps {
    activeTab: "categories" | "information" | null
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

type TreeCategory = {
    id: string
    title: string
    slug: string
    path?: string | null
    image?: string | null
    children?: TreeCategory[]
}

export function SharedMegaPanel({ activeTab, onMouseEnter, onMouseLeave, onLinkClick }: SharedMegaPanelProps) {
    const [infoItems, setInfoItems] = React.useState<MenuNode[]>([])
    const [categoryTree, setCategoryTree] = React.useState<TreeCategory[]>([])
    const [activeCategoryId, setActiveCategoryId] = React.useState<string | null>(null)
    const [activeChildId, setActiveChildId] = React.useState<string | null>(null)
    const [categoriesLoading, setCategoriesLoading] = React.useState(true)
    const [infoLoading, setInfoLoading] = React.useState(true)
    const categoriesLoadedRef = React.useRef(false)
    const infoLoadedRef = React.useRef(false)

    React.useEffect(() => {
        const fetchCategoryTree = async (force = false) => {
            if (categoriesLoadedRef.current && !force) {
                setCategoriesLoading(false)
                return
            }
            setCategoriesLoading(true)
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

        const fetchInfoData = async (force = false) => {
            if (infoLoadedRef.current && !force) {
                setInfoLoading(false)
                return
            }
            setInfoLoading(true)
            try {
                const menuRes = await fetch("/api/public/menus/HEADER_INFORMATION", { cache: "no-store" })
                if (menuRes.ok) {
                    const menuData = await menuRes.json()
                    setInfoItems(menuData && menuData.items ? (menuData.items as MenuNode[]) : [])
                } else {
                    setInfoItems([])
                }
                infoLoadedRef.current = true
            } catch (err) {
                setInfoItems([])
            } finally {
                setInfoLoading(false)
            }
        }

        void fetchCategoryTree()
        void fetchInfoData()
    }, [])

    React.useEffect(() => {
        if (categoryTree.length === 0) {
            setActiveCategoryId(null)
            return
        }
        setActiveCategoryId((current) => {
            if (current && categoryTree.some((item) => item.id === current)) return current
            return categoryTree[0]?.id || null
        })
    }, [categoryTree])

    const activeCategory = React.useMemo(
        () => categoryTree.find((item) => item.id === activeCategoryId) || categoryTree[0] || null,
        [activeCategoryId, categoryTree]
    )

    const activeChildren = React.useMemo(() => activeCategory?.children || [], [activeCategory])

    React.useEffect(() => {
        if (activeChildren.length === 0) {
            setActiveChildId(null)
            return
        }
        setActiveChildId((current) => {
            if (current && activeChildren.some((item) => item.id === current)) return current
            return activeChildren[0]?.id || null
        })
    }, [activeChildren])

    const activeChild = React.useMemo(
        () => activeChildren.find((item) => item.id === activeChildId) || activeChildren[0] || null,
        [activeChildId, activeChildren]
    )

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
                    <div className="grid min-h-[380px] grid-cols-[252px_minmax(0,1fr)] items-stretch">
                        <aside className="border-r border-[#d7e4dc] bg-[#edf5f0] px-8 py-7">
                            <p className="mb-5 text-[10px] font-medium uppercase tracking-[0.22em] text-[#8c8070]">
                                Shop Collections
                            </p>
                            {categoriesLoading ? (
                                <p className="text-sm text-[#8c8070]">Loading categories...</p>
                            ) : categoryTree.length === 0 ? (
                                <p className="text-sm text-[#8c8070]">No categories found.</p>
                            ) : (
                                <ul className="space-y-2.5">
                                    {categoryTree.map((group) => {
                                        const active = group.id === activeCategory?.id
                                        return (
                                            <li key={group.id}>
                                                <Link
                                                    href={group.path || `/${group.slug}`}
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
                                                    <span>{group.title}</span>
                                                    <ChevronRight className={cn("h-4 w-4 transition-transform duration-300", active ? "translate-x-0.5 text-[#6b645b]" : "text-[#9b9389] group-hover:translate-x-0.5")} />
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
                                activeChildren.length > 0 ? (
                                    <div className="max-w-[840px]">
                                        <div className="mb-5 flex items-center gap-4">
                                            <h3 className="font-serif text-[26px] font-semibold tracking-[-0.02em] text-[#231f1a]">
                                                {activeCategory.title}
                                            </h3>
                                            <div className="h-px flex-1 bg-[#e7ddd1]" />
                                        </div>
                                        <CategoryCardGrid
                                            items={activeChildren}
                                            activeId={activeChild?.id || null}
                                            onHover={setActiveChildId}
                                            onLinkClick={onLinkClick}
                                        />
                                    </div>
                                ) : null
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
                        <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Loading information...</div>
                    ) : infoItems.length === 0 ? (
                        <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
                            Information Menu is empty. Configure it in Menus. (Location: INFORMATION)
                        </div>
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

type CategoryCardGridProps = {
    items: TreeCategory[]
    activeId: string | null
    onHover: (id: string | null) => void
    onLinkClick: () => void
    interactive?: boolean
}

function CategoryCardGrid({
    items,
    activeId,
    onHover,
    onLinkClick,
    interactive = true,
}: CategoryCardGridProps) {
    return (
        <div className="grid grid-cols-4 gap-5">
            {items.map((item) => {
                const active = interactive && item.id === activeId
                return (
                    <Link
                        key={item.id}
                        href={item.path || `/${item.slug}`}
                        onClick={onLinkClick}
                        onMouseEnter={() => interactive && onHover(item.id)}
                        onFocus={() => interactive && onHover(item.id)}
                        className={cn(
                            "group min-w-0 max-w-[180px] overflow-hidden rounded-[2px] border border-[#e7ddd1] bg-white shadow-[0_6px_14px_rgba(43,37,30,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_18px_rgba(43,37,30,0.08)]",
                            active ? "border-[#d9c8b3] ring-1 ring-[#eadfce]" : ""
                        )}
                    >
                        <div className="aspect-square overflow-hidden bg-[linear-gradient(145deg,#f7f1ea_0%,#efe5d8_55%,#e6d7c5_100%)]">
                            <img
                                src={normalizeMenuImage(item.image) || createMenuFallbackImage(item.title)}
                                alt={item.title}
                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]"
                            />
                        </div>
                        <div className="border-t border-[#eee5db] bg-white px-2.5 py-2">
                            <p className="truncate font-serif text-[13px] font-semibold leading-4 text-[#231f1a]">{item.title}</p>
                        </div>
                    </Link>
                )
            })}
        </div>
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

function normalizeMenuImage(image: string | null | undefined) {
    if (!image || image.trim().length === 0) return ""
    return getImageUrl(image.trim())
}

function getSafeUrl(url: string | null | undefined): string {
    if (!url) return "#"
    if (url === "https://" || url === "http://") return "#"
    return url
}

function createMenuFallbackImage(title: string) {
    const encoded = encodeURIComponent(title)
    return `data:image/svg+xml;charset=UTF-8,
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 900 900'>
<defs>
<linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
<stop offset='0%' stop-color='%23f3ede5'/>
<stop offset='55%' stop-color='%23eadfd2'/>
<stop offset='100%' stop-color='%23dfcfbc'/>
</linearGradient>
</defs>
<rect width='900' height='900' fill='url(%23g)'/>
<rect x='80' y='80' width='740' height='740' rx='18' fill='none' stroke='%23c8b7a3' stroke-width='3' opacity='0.65'/>
<text x='450' y='470' text-anchor='middle' font-family='Georgia, serif' font-size='54' fill='%23776654'>${encoded}</text>
</svg>`.split("\n").join("")
}
