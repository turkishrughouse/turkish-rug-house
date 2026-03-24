"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { ChevronDown, ChevronRight, Loader2, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CreateMenuModal } from "./create-menu-modal"
import { MenuBuilder, MenuItem } from "./menu-builder"
import { MenuSourcesPanel } from "./menu-sources-panel"

export const MENU_LOCATIONS = [
    { value: "PRIMARY_HEADER", label: "Primary Header" },
    { value: "TOP_BAR", label: "Top Bar" },
    { value: "INFORMATION_FOOTER", label: "Information (Footer)" },
    { value: "HEADER_INFORMATION", label: "Header - Information" },
    { value: "HOME_TOP_CATEGORIES", label: "Home - Top 5 Categories" },
    { value: "CATEGORY_ATTRIBUTE_SHORTCUTS", label: "Category - Featured 5 Large Blocks" },
] as const

// Helper to extract values for Zod/Types
export const MENU_LOCATION_VALUES = MENU_LOCATIONS.map(l => l.value) as [string, ...string[]]

type MenuManagerProps = {
    forcedLocation?: string
}

export function MenuManager({ forcedLocation }: MenuManagerProps = {}) {
    const searchParams = useSearchParams()
    const requestedLocation = forcedLocation || searchParams.get("location")
    // --- Global State ---
    const [menus, setMenus] = useState<{ id: string, title: string, location: string | null }[]>([])
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
    const [activeMenuItems, setActiveMenuItems] = useState<MenuItem[]>([])
    const [loading, setLoading] = useState(true)
    const [itemsLoading, setItemsLoading] = useState(false)
    const [isStructureOpen, setIsStructureOpen] = useState(true)

    // --- Actions ---
    const [isCreateOpen, setIsCreateOpen] = useState(false)

    // 1. Initial Load
    useEffect(() => {
        loadMenus()
    }, [])

    useEffect(() => {
        if (!requestedLocation || menus.length === 0) return
        const found = menus.find((menu) => menu.location === requestedLocation)
        if (found && found.id !== activeMenuId) {
            setActiveMenuId(found.id)
        }
    }, [requestedLocation, menus, activeMenuId])

    // 2. Load Items when Menu Changes
    useEffect(() => {
        if (activeMenuId) {
            loadMenuDetails(activeMenuId)
        } else {
            setActiveMenuItems([])
        }
    }, [activeMenuId])

    const loadMenus = async () => {
        setLoading(true)
        try {
                const res = await fetch("/api/admin/menus")
                if (res.ok) {
                    const data = await res.json()
                    setMenus(data)
                    // Auto-select requested location first, fallback to first existing menu.
                    if (data.length > 0 && !activeMenuId) {
                        const byLocation = requestedLocation
                            ? data.find((menu: { id: string, location: string | null }) => menu.location === requestedLocation)
                            : null
                        setActiveMenuId(byLocation?.id || data[0].id)
                    } else if (data.length === 0) {
                        setActiveMenuId(null)
                    }
                }
        } catch (error) {
            toast.error("Failed to load menus")
        } finally {
            setLoading(false)
        }
    }

    const loadMenuDetails = async (id: string) => {
        setItemsLoading(true)
        try {
            const res = await fetch(`/api/admin/menus/${id}`)
            if (res.ok) {
                const menu = await res.json()
                // Convert Tree to Flat with Depth
                const flat = flattenTree(menu.items || [])
                setActiveMenuItems(flat)
            }
        } catch (error) {
            console.error(error)
            toast.error("Failed to load menu items")
        } finally {
            setItemsLoading(false)
        }
    }

    // Helper: Flatten Tree
    const flattenTree = (items: any[], depth = 0): MenuItem[] => {
        let result: MenuItem[] = []
        // Sort by order first (should be sorted by API, but safety)
        items.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))

        for (const item of items) {
            result.push({
                id: item.id,
                type: item.type,
                label: item.label,
                url: item.url,
                referenceId: item.referenceId,
                depth: depth,
                parentId: item.parentId
            })
            if (item.children && item.children.length > 0) {
                result = [...result, ...flattenTree(item.children, depth + 1)]
            }
        }
        return result
    }

    const handleCreate = async (name: string, location: string) => {
        try {
            const res = await fetch("/api/admin/menus", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, location })
            })

            if (!res.ok) {
                const err = await res.json()
                toast.error(err.error || "Creation failed")
                return
            }

            const newMenu = await res.json()
            toast.success("Menu created")

            // Refresh list & Select new
            await loadMenus()
            if (newMenu?.id) setActiveMenuId(newMenu.id)

        } catch (error) {
            toast.error("Failed to create menu")
        }
    }

    const handleDelete = async () => {
        if (!activeMenuId || !confirm("Delete this menu?")) return
        try {
            const res = await fetch(`/api/admin/menus/${activeMenuId}`, {
                method: "DELETE"
            })
            if (res.ok) {
                toast.success("Menu deleted")
                await loadMenus()
                setActiveMenuId(null) // Reset selection, loadMenus will pick first if exists
            } else {
                toast.error("Deletion failed")
            }
        } catch (error) {
            toast.error("Error deleting menu")
        }
    }

    const handleSaveMenu = async () => {
        if (!activeMenuId) return
        await persistMenuItems(activeMenuItems, true)
    }

    const persistMenuItems = async (itemsToPersist: MenuItem[], withLoaderToast = false) => {
        if (!activeMenuId) return false
        const currentMenu = menus.find(m => m.id === activeMenuId)
        const toastId = withLoaderToast ? toast.loading("Saving menu structure...") : undefined
        try {
            const payloadItems = itemsToPersist.map((item, index) => ({
                id: item.id.startsWith("temp-") ? undefined : item.id,
                type: item.type,
                label: item.label,
                url: item.url,
                referenceId: item.referenceId,
                sortOrder: index,
                parentId: item.parentId || null,
            }))

            const res = await fetch(`/api/admin/menus/${activeMenuId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: currentMenu?.title,
                    location: currentMenu?.location,
                    items: payloadItems,
                }),
            })

            if (!res.ok) throw new Error("Save failed")
            if (toastId) {
                toast.success("Menu saved successfully", { id: toastId })
            } else {
                toast.success("Items added and published")
            }
            await loadMenuDetails(activeMenuId)
            return true
        } catch {
            if (toastId) {
                toast.error("Failed to save menu", { id: toastId })
            } else {
                toast.error("Added locally but publish failed. Click Save Menu.")
            }
            return false
        }
    }

    const handleAddItems = (newRawItems: any[]) => {
        if (!activeMenuId) return

        // Convert raw items to MenuItems
        const newItems: MenuItem[] = newRawItems.map((item, idx) => ({
            id: `temp-${Date.now()}-${idx}`, // Temp ID, will be replaced by DB ID on save
            type: item.type,
            label: item.label,
            url: item.url,
            referenceId: item.referenceId,
            depth: 0,
            parentId: null
        }))

        const merged = [...activeMenuItems, ...newItems]
        setActiveMenuItems(merged)
        void persistMenuItems(merged, false)
    }

    const activeMenu = menus.find(m => m.id === activeMenuId)
    const isFooterMenu = activeMenu?.location === "INFORMATION_FOOTER"
    const structureStorageKey = activeMenuId ? `rughouse:menu-structure-open:${activeMenuId}` : null
    const locationLabel = MENU_LOCATIONS.find((loc) => loc.value === (forcedLocation || activeMenu?.location || ""))?.label

    useEffect(() => {
        if (!activeMenuId || !activeMenu) return

        if (!isFooterMenu) {
            setIsStructureOpen(true)
            return
        }

        if (typeof window === "undefined" || !structureStorageKey) {
            setIsStructureOpen(false)
            return
        }

        const saved = window.localStorage.getItem(structureStorageKey)
        if (saved === null) {
            // First time opening footer menu: collapsed by default.
            setIsStructureOpen(false)
            window.localStorage.setItem(structureStorageKey, "0")
            return
        }
        setIsStructureOpen(saved === "1")
    }, [activeMenuId, activeMenu, isFooterMenu, structureStorageKey])

    const toggleStructureOpen = () => {
        setIsStructureOpen((prev) => {
            const next = !prev
            if (typeof window !== "undefined" && structureStorageKey) {
                window.localStorage.setItem(structureStorageKey, next ? "1" : "0")
            }
            return next
        })
    }
    const isSocialMenuItem = (item: MenuItem) => {
        if (item.type !== "CUSTOM") return false
        const label = (item.label || "").toLowerCase()
        const url = (item.url || "").toLowerCase()
        return (
            label.includes("facebook") ||
            label.includes("instagram") ||
            label === "x" ||
            label.includes("twitter") ||
            label.includes("youtube") ||
            label.includes("tiktok") ||
            label.includes("linkedin") ||
            label.includes("pinterest") ||
            url.includes("facebook.com") ||
            url.includes("instagram.com") ||
            url.includes("x.com") ||
            url.includes("twitter.com") ||
            url.includes("youtube.com") ||
            url.includes("youtu.be") ||
            url.includes("tiktok.com") ||
            url.includes("linkedin.com") ||
            url.includes("pinterest.com")
        )
    }
    const hiddenSocialItems = isFooterMenu ? activeMenuItems.filter(isSocialMenuItem) : []
    const visibleMenuItems = isFooterMenu ? activeMenuItems.filter((item) => !isSocialMenuItem(item)) : activeMenuItems

    if (loading && menus.length === 0) {
        return <div className="flex h-96 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-teal-600" /></div>
    }

    return (
        <div className="p-6 max-w-[1600px] mx-auto min-h-screen pb-20">
            {/* Header / Toolbar */}
            <div className="bg-white border rounded-lg p-4 shadow-sm mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    {forcedLocation ? (
                        <span className="text-sm font-medium text-slate-600">
                            Editing location: {MENU_LOCATIONS.find((loc) => loc.value === forcedLocation)?.label || forcedLocation}
                        </span>
                    ) : (
                        <>
                            <span className="text-sm font-medium text-slate-500 whitespace-nowrap">Select a menu to edit:</span>
                            <Select value={activeMenuId || ""} onValueChange={setActiveMenuId}>
                                <SelectTrigger className="w-[250px] md:w-[300px]">
                                    <SelectValue placeholder="Select menu..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {menus.map(m => (
                                        <SelectItem key={m.id} value={m.id}>
                                            {m.title} {m.location ? <span className="text-slate-400 text-xs ml-1">({m.location})</span> : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <span className="text-slate-300">|</span>
                            <Button variant="link" className="text-blue-600 p-0 h-auto" onClick={() => setIsCreateOpen(true)}>
                                Create new menu
                            </Button>
                        </>
                    )}
                    {forcedLocation ? (
                        <Button variant="link" className="text-blue-600 p-0 h-auto" onClick={() => setIsCreateOpen(true)}>
                            Create new menu
                        </Button>
                    ) : null}
                </div>

                {activeMenu && (
                    <div className="flex items-center gap-2">
                        <div className="text-xs bg-slate-100 px-3 py-1.5 rounded text-slate-600">
                            Location: <strong className="text-slate-900">{activeMenu.location || "None"}</strong>
                        </div>
                        <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50 hover:text-red-600" onClick={handleDelete}>
                            Delete
                        </Button>
                    </div>
                )}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                {/* LEFT: Sources */}
                <div className="lg:col-span-4 bg-white border rounded-lg shadow-sm overflow-hidden self-start">
                    <div className="p-4 bg-slate-50 border-b">
                        <h3 className="font-semibold text-slate-800">Add Menu Items</h3>
                    </div>
                    <MenuSourcesPanel
                        disabled={!activeMenuId}
                        onAddItems={handleAddItems}
                    />
                </div>

                {/* RIGHT: Builder */}
                <div className="lg:col-span-8 bg-white border rounded-lg shadow-sm min-h-[600px] flex flex-col">
                    {forcedLocation ? (
                        <div className="border-b bg-white px-4 py-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Editing Location</p>
                                    <p className="text-sm font-medium text-slate-800">{locationLabel || forcedLocation}</p>
                                </div>
                                <div className="relative z-20 w-full md:w-[320px]">
                                    <Select value={activeMenuId || ""} onValueChange={setActiveMenuId}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select menu..." />
                                        </SelectTrigger>
                                        <SelectContent
                                            position="popper"
                                            side="bottom"
                                            sideOffset={8}
                                            className="z-[120] w-[var(--radix-select-trigger-width)] border-slate-200 bg-white shadow-xl"
                                        >
                                            {menus.map((menu) => (
                                                <SelectItem key={menu.id} value={menu.id}>
                                                    {menu.title}{menu.location ? ` (${MENU_LOCATIONS.find((loc) => loc.value === menu.location)?.label || menu.location})` : ""}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    <div className="p-4 bg-slate-50 border-b flex justify-between items-center sticky top-0 z-10">
                        <div>
                            <button
                                type="button"
                                onClick={toggleStructureOpen}
                                className="inline-flex items-center gap-2 font-semibold text-slate-800"
                            >
                                {isStructureOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                <span>Menu Structure</span>
                            </button>
                            {isFooterMenu ? (
                                <p className="text-xs text-slate-500 mt-1">
                                    Footer menu: drag to reorder, drag right to make submenu, drag left to move back.
                                </p>
                            ) : null}
                        </div>
                        {activeMenuId && (
                            <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={handleSaveMenu} disabled={itemsLoading}>
                                <Save className="h-4 w-4 mr-2" /> Save Menu
                            </Button>
                        )}
                    </div>

                    {isStructureOpen ? (
                        <div className="flex-1 p-6 bg-slate-50/50">
                            {!activeMenuId ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 select-none">
                                    <p>Select a menu to start editing.</p>
                                </div>
                            ) : itemsLoading ? (
                                <div className="h-60 flex flex-col items-center justify-center text-slate-400">
                                    <Loader2 className="h-6 w-6 animate-spin mb-2" />
                                </div>
                            ) : (
                                <MenuBuilder
                                    items={visibleMenuItems}
                                    onChange={(nextVisibleItems) => {
                                        if (!isFooterMenu) {
                                            setActiveMenuItems(nextVisibleItems)
                                            return
                                        }
                                        setActiveMenuItems([...nextVisibleItems, ...hiddenSocialItems])
                                    }}
                                />
                            )}
                        </div>
                    ) : (
                        <div className="px-6 py-5 text-sm text-slate-500">
                            Menu Structure is collapsed. Click the title to expand.
                        </div>
                    )}
                </div>
            </div>

            <CreateMenuModal
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                onCreate={handleCreate}
            />
        </div>
    )
}
