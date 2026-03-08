"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import type { HomePromoSection, SiteSettings } from "@/lib/site-settings"

type CategoryNode = {
    id: string
    title: string
    parentId: string | null
}

type FlatCategory = {
    id: string
    title: string
    level: number
}

const buildTree = (flatCategories: CategoryNode[]) => {
    const map = new Map<string, (CategoryNode & { children: CategoryNode[] })>()
    const roots: (CategoryNode & { children: CategoryNode[] })[] = []

    flatCategories.forEach((cat) => {
        map.set(cat.id, { ...cat, children: [] })
    })

    flatCategories.forEach((cat) => {
        const current = map.get(cat.id)
        if (!current) return
        if (cat.parentId && map.has(cat.parentId)) {
            map.get(cat.parentId)?.children.push(current)
        } else {
            roots.push(current)
        }
    })

    return roots
}

const flattenCategories = (rows: Array<CategoryNode & { children?: CategoryNode[] }>, level = 0): FlatCategory[] => {
    let result: FlatCategory[] = []
    rows.forEach((row) => {
        result.push({ id: row.id, title: row.title, level })
        if (row.children && row.children.length > 0) {
            result = [...result, ...flattenCategories(row.children as Array<CategoryNode & { children?: CategoryNode[] }>, level + 1)]
        }
    })
    return result
}

function createPromoSection(): HomePromoSection {
    return {
        id: `promo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: "Anatolian Treasures",
        categoryId: "",
    }
}

export function ShopByCategoryMenuEditor() {
    const [categories, setCategories] = useState<FlatCategory[]>([])
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [radiusLinked, setRadiusLinked] = useState(true)
    const [radiusTopLeft, setRadiusTopLeft] = useState(15)
    const [radiusTopRight, setRadiusTopRight] = useState(15)
    const [radiusBottomRight, setRadiusBottomRight] = useState(15)
    const [radiusBottomLeft, setRadiusBottomLeft] = useState(15)
    const [radiusOpen, setRadiusOpen] = useState(false)
    const [collectionCategoryIds, setCollectionCategoryIds] = useState<string[]>([])
    const [collectionSectionTitle, setCollectionSectionTitle] = useState("Shop by Collection")
    const [reviewShowcaseEnabled, setReviewShowcaseEnabled] = useState(false)
    const [reviewShowcaseTitle, setReviewShowcaseTitle] = useState("Over 210,000 Five-Star Reviews")
    const [reviewShowcaseSubtitle, setReviewShowcaseSubtitle] = useState("Explore the rugs everyone's raving about.")
    const [homePromoSections, setHomePromoSections] = useState<HomePromoSection[]>([])
    const [promoAddOpen, setPromoAddOpen] = useState(false)
    const [promoDraft, setPromoDraft] = useState<HomePromoSection>(createPromoSection())
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            try {
                const [categoriesRes, settingsRes] = await Promise.all([
                    fetch("/api/admin/categories", { cache: "no-store" }),
                    fetch("/api/admin/settings", { cache: "no-store" }),
                ])
                if (!categoriesRes.ok || !settingsRes.ok) throw new Error("load failed")
                const categoryRows = await categoriesRes.json() as CategoryNode[]
                const settings = await settingsRes.json() as SiteSettings
                const tree = buildTree(categoryRows)
                setCategories(flattenCategories(tree))
                setSelectedIds(Array.isArray(settings.shopByCategoryIds) ? settings.shopByCategoryIds.slice(0, 8) : [])
                setRadiusLinked(settings.categoryCardRadiusLinked !== false)
                setRadiusTopLeft(typeof settings.categoryCardRadiusTopLeft === "number" ? settings.categoryCardRadiusTopLeft : 15)
                setRadiusTopRight(typeof settings.categoryCardRadiusTopRight === "number" ? settings.categoryCardRadiusTopRight : 15)
                setRadiusBottomRight(typeof settings.categoryCardRadiusBottomRight === "number" ? settings.categoryCardRadiusBottomRight : 15)
                setRadiusBottomLeft(typeof settings.categoryCardRadiusBottomLeft === "number" ? settings.categoryCardRadiusBottomLeft : 15)
                setCollectionCategoryIds(Array.isArray(settings.collectionCategoryIds) ? settings.collectionCategoryIds.slice(0, 7) : [])
                setCollectionSectionTitle((settings.collectionSectionTitle || "Shop by Collection").trim() || "Shop by Collection")
                setReviewShowcaseEnabled(Boolean(settings.reviewShowcaseEnabled))
                setReviewShowcaseTitle((settings.reviewShowcaseTitle || "Over 210,000 Five-Star Reviews").trim() || "Over 210,000 Five-Star Reviews")
                setReviewShowcaseSubtitle((settings.reviewShowcaseSubtitle || "Explore the rugs everyone's raving about.").trim() || "Explore the rugs everyone's raving about.")
                const loadedPromoSections = Array.isArray(settings.homePromoSections) && settings.homePromoSections.length > 0
                    ? settings.homePromoSections
                    : [{
                        id: "default-home-promo",
                        title: (settings.homePromoSectionTitle || "Most Popular").trim() || "Most Popular",
                        categoryId: settings.homePromoCategoryId || "",
                    }]
                setHomePromoSections(loadedPromoSections)
            } catch {
                toast.error("Failed to load Shop by Category settings")
            } finally {
                setLoading(false)
            }
        }

        void load()
    }, [])

    const setSlot = (index: number, value: string) => {
        setSelectedIds((prev) => {
            const next = [...prev]
            while (next.length < 8) next.push("")
            next[index] = value
            return next.slice(0, 8)
        })
    }

    const clearAll = () => setSelectedIds([])

    const updateLinkedRadius = (value: number) => {
        const next = Math.max(0, Math.min(200, Math.round(value || 0)))
        setRadiusTopLeft(next)
        setRadiusTopRight(next)
        setRadiusBottomRight(next)
        setRadiusBottomLeft(next)
    }

    const toggleRadiusLinked = () => {
        setRadiusLinked((prev) => {
            const next = !prev
            if (next) {
                const unified = Math.max(radiusTopLeft, radiusTopRight, radiusBottomRight, radiusBottomLeft)
                updateLinkedRadius(unified)
            }
            return next
        })
    }

    const setCollectionSlot = (index: number, value: string) => {
        setCollectionCategoryIds((prev) => {
            const next = [...prev]
            while (next.length < 7) next.push("")
            next[index] = value
            return next.slice(0, 7)
        })
    }

    const updatePromoSection = (id: string, patch: Partial<HomePromoSection>) => {
        setHomePromoSections((prev) => prev.map((item) => item.id === id ? { ...item, ...patch } : item))
    }

    const addPromoSection = () => {
        setHomePromoSections((prev) => [...prev, promoDraft])
        setPromoDraft(createPromoSection())
        setPromoAddOpen(false)
    }

    const save = async () => {
        setSaving(true)
        try {
            const currentRes = await fetch("/api/admin/settings", { cache: "no-store" })
            if (!currentRes.ok) throw new Error("load current settings failed")
            const current = await currentRes.json() as SiteSettings
            const normalized = Array.from(new Set(selectedIds.filter((id) => id && id.trim().length > 0))).slice(0, 8)
            const normalizedCollection = Array.from(new Set(collectionCategoryIds.filter((id) => id && id.trim().length > 0))).slice(0, 7)
            const payload: SiteSettings = {
                ...current,
                shopByCategoryIds: normalized,
                categoryCardRadiusLinked: radiusLinked,
                categoryCardRadiusTopLeft: Math.max(0, Math.min(200, Math.round(radiusTopLeft || 0))),
                categoryCardRadiusTopRight: Math.max(0, Math.min(200, Math.round(radiusTopRight || 0))),
                categoryCardRadiusBottomRight: Math.max(0, Math.min(200, Math.round(radiusBottomRight || 0))),
                categoryCardRadiusBottomLeft: Math.max(0, Math.min(200, Math.round(radiusBottomLeft || 0))),
                collectionCategoryIds: normalizedCollection,
                collectionSectionTitle: collectionSectionTitle.trim() || "Shop by Collection",
                reviewShowcaseEnabled,
                reviewShowcaseTitle: reviewShowcaseTitle.trim() || "Over 210,000 Five-Star Reviews",
                reviewShowcaseSubtitle: reviewShowcaseSubtitle.trim() || "Explore the rugs everyone's raving about.",
                homePromoSections,
                homePromoSectionTitle: (homePromoSections[0]?.title || "Most Popular").trim() || "Most Popular",
                homePromoCategoryId: homePromoSections[0]?.categoryId || "",
            }
            const saveRes = await fetch("/api/admin/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            if (!saveRes.ok) throw new Error("save failed")
            const saved = await saveRes.json() as SiteSettings
            setSelectedIds(Array.isArray(saved.shopByCategoryIds) ? saved.shopByCategoryIds.slice(0, 8) : [])
            setRadiusLinked(saved.categoryCardRadiusLinked !== false)
            setRadiusTopLeft(typeof saved.categoryCardRadiusTopLeft === "number" ? saved.categoryCardRadiusTopLeft : 15)
            setRadiusTopRight(typeof saved.categoryCardRadiusTopRight === "number" ? saved.categoryCardRadiusTopRight : 15)
            setRadiusBottomRight(typeof saved.categoryCardRadiusBottomRight === "number" ? saved.categoryCardRadiusBottomRight : 15)
            setRadiusBottomLeft(typeof saved.categoryCardRadiusBottomLeft === "number" ? saved.categoryCardRadiusBottomLeft : 15)
            setCollectionCategoryIds(Array.isArray(saved.collectionCategoryIds) ? saved.collectionCategoryIds.slice(0, 7) : [])
            setCollectionSectionTitle((saved.collectionSectionTitle || "Shop by Collection").trim() || "Shop by Collection")
            setReviewShowcaseEnabled(Boolean(saved.reviewShowcaseEnabled))
            setReviewShowcaseTitle((saved.reviewShowcaseTitle || "Over 210,000 Five-Star Reviews").trim() || "Over 210,000 Five-Star Reviews")
            setReviewShowcaseSubtitle((saved.reviewShowcaseSubtitle || "Explore the rugs everyone's raving about.").trim() || "Explore the rugs everyone's raving about.")
            setHomePromoSections(
                Array.isArray(saved.homePromoSections) && saved.homePromoSections.length > 0
                    ? saved.homePromoSections
                    : [{
                        id: "default-home-promo",
                        title: (saved.homePromoSectionTitle || "Most Popular").trim() || "Most Popular",
                        categoryId: saved.homePromoCategoryId || "",
                    }]
            )
            toast.success("Banner settings saved")
        } catch {
            toast.error("Failed to save banner settings")
        } finally {
            setSaving(false)
        }
    }

    const slots = useMemo(() => Array.from({ length: 8 }), [])

    const saveRadiusOnly = async () => {
        setSaving(true)
        try {
            const currentRes = await fetch("/api/admin/settings", { cache: "no-store" })
            if (!currentRes.ok) throw new Error("load current settings failed")
            const current = await currentRes.json() as SiteSettings
            const payload: SiteSettings = {
                ...current,
                categoryCardRadiusLinked: radiusLinked,
                categoryCardRadiusTopLeft: Math.max(0, Math.min(200, Math.round(radiusTopLeft || 0))),
                categoryCardRadiusTopRight: Math.max(0, Math.min(200, Math.round(radiusTopRight || 0))),
                categoryCardRadiusBottomRight: Math.max(0, Math.min(200, Math.round(radiusBottomRight || 0))),
                categoryCardRadiusBottomLeft: Math.max(0, Math.min(200, Math.round(radiusBottomLeft || 0))),
                homePromoSections,
            }
            const saveRes = await fetch("/api/admin/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            if (!saveRes.ok) throw new Error("save failed")
            const saved = await saveRes.json() as SiteSettings
            setRadiusLinked(saved.categoryCardRadiusLinked !== false)
            setRadiusTopLeft(typeof saved.categoryCardRadiusTopLeft === "number" ? saved.categoryCardRadiusTopLeft : 15)
            setRadiusTopRight(typeof saved.categoryCardRadiusTopRight === "number" ? saved.categoryCardRadiusTopRight : 15)
            setRadiusBottomRight(typeof saved.categoryCardRadiusBottomRight === "number" ? saved.categoryCardRadiusBottomRight : 15)
            setRadiusBottomLeft(typeof saved.categoryCardRadiusBottomLeft === "number" ? saved.categoryCardRadiusBottomLeft : 15)
            setRadiusOpen(false)
            toast.success("Radius updated")
        } catch {
            toast.error("Failed to update radius")
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">Shop by Category Menu (8)</h2>
                    <p className="text-xs text-slate-500">Homepage category cards are managed from this section.</p>
                </div>
                <div className="relative flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setRadiusOpen((prev) => !prev)} disabled={saving || loading}>
                        Radius
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={clearAll} disabled={saving || loading}>
                        Clear All
                    </Button>
                    <Button type="button" size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={save} disabled={saving || loading}>
                        {saving ? "Saving..." : "Save"}
                    </Button>
                    {radiusOpen ? (
                        <>
                            <button
                                type="button"
                                className="fixed inset-0 z-40 bg-black/20"
                                aria-label="Close rounded corners popup"
                                onClick={() => setRadiusOpen(false)}
                            />
                            <div className="fixed left-1/2 top-1/2 z-50 w-[440px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="text-base font-semibold text-slate-900">Rounded Corners</h3>
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-lg font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                                        onClick={() => setRadiusOpen(false)}
                                        aria-label="Close"
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>
                            <div className="rounded-lg border border-slate-200 p-4">
                                <div className="grid grid-cols-3 items-center gap-3">
                                    <Input
                                        type="number"
                                        min={0}
                                        max={200}
                                        value={radiusTopLeft}
                                        onChange={(event) => {
                                            const next = Math.max(0, Math.min(200, Number(event.target.value) || 0))
                                            if (radiusLinked) updateLinkedRadius(next)
                                            else setRadiusTopLeft(next)
                                        }}
                                    />
                                    <div
                                        className="mx-auto flex h-24 w-32 cursor-pointer items-center justify-center border-2 border-blue-500 bg-slate-50"
                                        style={{
                                            borderRadius: `${radiusTopLeft}px ${radiusTopRight}px ${radiusBottomRight}px ${radiusBottomLeft}px`,
                                        }}
                                        onClick={toggleRadiusLinked}
                                        role="button"
                                        aria-label="Toggle linked corners"
                                        title={radiusLinked ? "Linked corners active" : "Linked corners inactive"}
                                    >
                                        <span className={`text-2xl ${radiusLinked ? "text-blue-500" : "text-slate-400"}`}>🔗</span>
                                    </div>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={200}
                                        value={radiusTopRight}
                                        onChange={(event) => {
                                            const next = Math.max(0, Math.min(200, Number(event.target.value) || 0))
                                            if (radiusLinked) updateLinkedRadius(next)
                                            else setRadiusTopRight(next)
                                        }}
                                    />
                                    <Input
                                        type="number"
                                        min={0}
                                        max={200}
                                        value={radiusBottomLeft}
                                        onChange={(event) => {
                                            const next = Math.max(0, Math.min(200, Number(event.target.value) || 0))
                                            if (radiusLinked) updateLinkedRadius(next)
                                            else setRadiusBottomLeft(next)
                                        }}
                                    />
                                    <div className="text-center text-[11px] font-medium text-slate-500">
                                        Click the link to {radiusLinked ? "unlock" : "link"} all four corners.
                                    </div>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={200}
                                        value={radiusBottomRight}
                                        onChange={(event) => {
                                            const next = Math.max(0, Math.min(200, Number(event.target.value) || 0))
                                            if (radiusLinked) updateLinkedRadius(next)
                                            else setRadiusBottomRight(next)
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="mt-4 flex justify-end">
                                <Button
                                    type="button"
                                    size="sm"
                                    className="bg-teal-600 hover:bg-teal-700"
                                    onClick={saveRadiusOnly}
                                    disabled={saving}
                                >
                                    {saving ? "Updating..." : "Update"}
                                </Button>
                            </div>
                        </div>
                        </>
                    ) : null}
                </div>
            </div>

            {loading ? (
                <p className="text-sm text-slate-500">Loading slots...</p>
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4 xl:grid-cols-8">
                        {slots.map((_, index) => {
                            const selectedValue = selectedIds[index] || ""
                            return (
                                <div key={`design-shop-slot-${index}`} className="space-y-1">
                                    <Label className="text-xs text-slate-600">Slot {index + 1}</Label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={selectedValue}
                                        onChange={(event) => setSlot(index, event.target.value)}
                                    >
                                        <option value="">None</option>
                                        {categories.map((cat) => {
                                            const selectedElsewhere = selectedIds.some((id, idx) => idx !== index && id === cat.id)
                                            return (
                                                <option key={`design-shop-opt-${cat.id}`} value={cat.id} disabled={selectedElsewhere}>
                                                    {"\u00A0".repeat(cat.level * 3)}{cat.title}
                                                </option>
                                            )
                                        })}
                                    </select>
                                </div>
                            )
                        })}
                    </div>

                    <div className="mt-6 border-t border-slate-200 pt-6">
                        <div className="mb-4">
                            <h3 className="text-base font-semibold text-slate-900">Shop by Collection Section (7)</h3>
                            <p className="text-xs text-slate-500">Section title and 7 category slots under Anatolian Treasures.</p>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-4 lg:grid-cols-8">
                            <div className="space-y-1 md:col-span-1">
                                <Label className="text-xs text-slate-600">Section Title</Label>
                                <Input
                                    value={collectionSectionTitle}
                                    onChange={(event) => setCollectionSectionTitle(event.target.value)}
                                    placeholder="Shop by Collection"
                                    disabled={saving}
                                />
                            </div>
                            {Array.from({ length: 7 }).map((_, index) => {
                                const selectedValue = collectionCategoryIds[index] || ""
                                return (
                                    <div key={`design-collection-slot-${index}`} className="space-y-1">
                                        <Label className="text-xs text-slate-600">Collection {index + 1}</Label>
                                        <select
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            value={selectedValue}
                                            onChange={(event) => setCollectionSlot(index, event.target.value)}
                                            disabled={saving}
                                        >
                                            <option value="">None</option>
                                            {categories.map((cat) => {
                                                const selectedElsewhere = collectionCategoryIds.some((id, idx) => idx !== index && id === cat.id)
                                                return (
                                                    <option key={`design-collection-opt-${cat.id}`} value={cat.id} disabled={selectedElsewhere}>
                                                        {"\u00A0".repeat(cat.level * 3)}{cat.title}
                                                    </option>
                                                )
                                            })}
                                        </select>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="mt-6 border-t border-slate-200 pt-6">
                        <div className="mb-4 flex items-start justify-between gap-3">
                            <div>
                            <h3 className="text-base font-semibold text-slate-900">Homepage Banner + Products Section</h3>
                            <p className="text-xs text-slate-500">Title and banner category for the section under Featured Items.</p>
                            </div>
                            <div className="relative">
                                <Button type="button" size="sm" variant="outline" onClick={() => setPromoAddOpen(true)} disabled={saving}>
                                    Ekle
                                </Button>
                                {promoAddOpen ? (
                                    <>
                                        <button
                                            type="button"
                                            className="fixed inset-0 z-40 bg-black/10"
                                            onClick={() => setPromoAddOpen(false)}
                                            aria-label="Close add section popup"
                                        />
                                        <div className="fixed left-1/2 top-1/2 z-50 w-[420px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
                                            <div className="mb-4 flex items-center justify-between">
                                                <h4 className="text-base font-semibold text-slate-900">Yeni Section Ekle</h4>
                                                <button
                                                    type="button"
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-lg font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                                    onClick={() => setPromoAddOpen(false)}
                                                >
                                                    ×
                                                </button>
                                            </div>
                                            <div className="space-y-3">
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-slate-600">Section Title</Label>
                                                    <Input
                                                        value={promoDraft.title}
                                                        onChange={(event) => setPromoDraft((prev) => ({ ...prev, title: event.target.value }))}
                                                        placeholder="Anatolian Treasures"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-slate-600">Banner Category</Label>
                                                    <select
                                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                        value={promoDraft.categoryId}
                                                        onChange={(event) => setPromoDraft((prev) => ({ ...prev, categoryId: event.target.value }))}
                                                    >
                                                        <option value="">Select category</option>
                                                        {categories.map((cat) => (
                                                            <option key={`design-new-promo-cat-${cat.id}`} value={cat.id}>
                                                                {"\u00A0".repeat(cat.level * 3)}{cat.title}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="flex justify-end">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        className="bg-teal-600 hover:bg-teal-700"
                                                        onClick={addPromoSection}
                                                    >
                                                        Ekle
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : null}
                            </div>
                        </div>
                        <div className="space-y-4">
                            {homePromoSections.map((section, index) => (
                                <div key={section.id} className="rounded-lg border border-slate-200 p-4">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <h4 className="text-sm font-semibold text-slate-900">Section {index + 1}</h4>
                                        {homePromoSections.length > 1 ? (
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setHomePromoSections((prev) => prev.filter((item) => item.id !== section.id))}
                                                disabled={saving}
                                            >
                                                Kaldır
                                            </Button>
                                        ) : null}
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        <div className="space-y-1">
                                            <Label className="text-xs text-slate-600">Section Title</Label>
                                            <Input
                                                value={section.title}
                                                onChange={(event) => updatePromoSection(section.id, { title: event.target.value })}
                                                placeholder="Anatolian Treasures"
                                                disabled={saving}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-slate-600">Banner Category</Label>
                                            <select
                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                value={section.categoryId}
                                                onChange={(event) => updatePromoSection(section.id, { categoryId: event.target.value })}
                                                disabled={saving}
                                            >
                                                <option value="">Select category</option>
                                                {categories.map((cat) => (
                                                    <option key={`design-promo-cat-${section.id}-${cat.id}`} value={cat.id}>
                                                        {"\u00A0".repeat(cat.level * 3)}{cat.title}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-6 border-t border-slate-200 pt-6">
                        <div className="mb-4">
                            <h3 className="text-base font-semibold text-slate-900">Customer Reviews Showcase</h3>
                            <p className="text-xs text-slate-500">Control visibility and text of the review block on homepage.</p>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-600">Status</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={reviewShowcaseEnabled ? "active" : "inactive"}
                                    onChange={(event) => setReviewShowcaseEnabled(event.target.value === "active")}
                                    disabled={saving}
                                >
                                    <option value="inactive">Inactive</option>
                                    <option value="active">Active</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-600">Section Title</Label>
                                <Input
                                    value={reviewShowcaseTitle}
                                    onChange={(event) => setReviewShowcaseTitle(event.target.value)}
                                    placeholder="Over 210,000 Five-Star Reviews"
                                    disabled={saving}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-600">Section Subtitle</Label>
                                <Input
                                    value={reviewShowcaseSubtitle}
                                    onChange={(event) => setReviewShowcaseSubtitle(event.target.value)}
                                    placeholder="Explore the rugs everyone's raving about."
                                    disabled={saving}
                                />
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
