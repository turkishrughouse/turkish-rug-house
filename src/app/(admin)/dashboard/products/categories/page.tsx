"use client"

import React, { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Edit2, Trash2, Folder, FolderOpen, ChevronRight, ChevronDown, Check, X } from "lucide-react"
import { toast } from "sonner"
import { SortableTree, FlatItem } from "@/components/admin/sortable-tree"
import { Switch } from "@/components/ui/switch"
import { MediaPickerDialog } from "@/components/admin/media/media-picker-dialog"
import type { SiteSettings } from "@/lib/site-settings"

// --- Types ---
type Category = {
    id: string
    title: string
    slug: string
    parentId: string | null
    description: string | null
    image: string | null
    _count?: { products: number }
    featuredPreview?: Array<{ id: string; title: string; image: string | null }>
    featuredCount?: number
    children?: Category[]
}

type ReviewAccessItem = {
    id: string
    email: string
    approved: boolean
    remainingReviews: number
    approvedAt?: string | null
    approvedBy?: string | null
}

// --- Schema ---
const categorySchema = z.object({
    title: z.string().min(1, "Name is required"),
    slug: z.string().min(1, "Slug is required")
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase and dash-separated"),
    parentId: z.string().optional().nullable(),
    description: z.string().optional(),
    image: z.string().optional(),
})

type CategoryFormValues = z.infer<typeof categorySchema>

// --- Helper: Flatten Tree for Dropdown ---
const flattenCategories = (categories: Category[], level = 0): { id: string, title: string, level: number }[] => {
    let result: { id: string, title: string, level: number }[] = []
    for (const cat of categories) {
        result.push({ id: cat.id, title: cat.title, level })
        if (cat.children && cat.children.length > 0) {
            result = [...result, ...flattenCategories(cat.children, level + 1)]
        }
    }
    return result
}

// Helper to fully flatten for SortableTree
const buildFlatItems = (categories: Category[], depth = 0, parentId: string | null = null): FlatItem[] => {
    let result: FlatItem[] = []
    let idx = 0
    // Sort by sortOrder logic if needed, but categories come sorted from API
    for (const cat of categories) {
        result.push({
            id: cat.id,
            parentId: parentId,
            title: cat.title,
            slug: cat.slug,
            count: cat._count?.products || 0,
            depth,
            index: idx++
        })
        if (cat.children && cat.children.length > 0) {
            result = [...result, ...buildFlatItems(cat.children, depth + 1, cat.id)]
        }
    }
    return result
}

const findCategoryById = (items: Category[], id: string): Category | null => {
    for (const item of items) {
        if (item.id === id) return item
        if (item.children?.length) {
            const nested = findCategoryById(item.children, id)
            if (nested) return nested
        }
    }
    return null
}

// ... existing code ...

// --- Helper: Build Tree from Flat List ---
const buildTree = (flatCategories: Category[]): Category[] => {
    const map = new Map<string, Category>()
    const roots: Category[] = []

    // Initialize map with empty children
    flatCategories.forEach(cat => {
        map.set(cat.id, { ...cat, children: [] })
    })

    // Build hierarchy
    flatCategories.forEach(cat => {
        const node = map.get(cat.id)!
        if (cat.parentId && map.has(cat.parentId)) {
            const parent = map.get(cat.parentId)!
            parent.children?.push(node)
        } else {
            roots.push(node) // No parent or parent not found -> Top level
        }
    })

    const withAggregatedCounts = (rows: Category[]): Category[] => {
        return rows.map((row) => {
            const children = row.children ? withAggregatedCounts(row.children) : []
            const ownCount = Number(row._count?.products || 0)
            const childCount = children.reduce((sum, child) => sum + Number(child._count?.products || 0), 0)
            return {
                ...row,
                children,
                _count: { products: ownCount + childCount },
            }
        })
    }

    return withAggregatedCounts(roots)
}

const collectParentIds = (items: Category[]): string[] => {
    const ids: string[] = []
    const walk = (rows: Category[]) => {
        rows.forEach((row) => {
            if (row.children && row.children.length > 0) {
                ids.push(row.id)
                walk(row.children)
            }
        })
    }
    walk(items)
    return ids
}

export default function CategoriesPage() {
    const [categories, setCategories] = useState<Category[]>([]) // Tree structure
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set()) // State for collapse/expand
    const hasInitializedCollapseRef = useRef(false)

    // New State for Reorder
    const [reorderMode, setReorderMode] = useState(false)
    const [flatItems, setFlatItems] = useState<FlatItem[]>([])
    const [shopByCategoryIds, setShopByCategoryIds] = useState<string[]>([])
    const [collectionCategoryIds, setCollectionCategoryIds] = useState<string[]>([])
    const [collectionSectionTitle, setCollectionSectionTitle] = useState("Shop by Collection")
    const [reviewShowcaseEnabled, setReviewShowcaseEnabled] = useState(false)
    const [reviewShowcaseTitle, setReviewShowcaseTitle] = useState("Over 210,000 Five-Star Reviews")
    const [reviewShowcaseSubtitle, setReviewShowcaseSubtitle] = useState("Explore the rugs everyone's raving about.")
    const [reviewAccessEmail, setReviewAccessEmail] = useState("")
    const [reviewAccessNote, setReviewAccessNote] = useState("")
    const [reviewAccessLoading, setReviewAccessLoading] = useState(false)
    const [reviewAccessItems, setReviewAccessItems] = useState<ReviewAccessItem[]>([])
    const [reviewAccessListLoading, setReviewAccessListLoading] = useState(false)
    const [homePromoSectionTitle, setHomePromoSectionTitle] = useState("Most Popular")
    const [homePromoCategoryId, setHomePromoCategoryId] = useState("")
    const [homeSlotsLoading, setHomeSlotsLoading] = useState(true)
    const [homeSlotsSaving, setHomeSlotsSaving] = useState(false)
    const [homeSectionsOpen, setHomeSectionsOpen] = useState(false)
    const [categoryMediaPickerOpen, setCategoryMediaPickerOpen] = useState(false)

    // Action States
    const [deleteModalOpen, setDeleteModalOpen] = useState(false)
    const [parentModalOpen, setParentModalOpen] = useState(false)
    const [actionLoading, setActionLoading] = useState(false)

    const form = useForm<CategoryFormValues>({
        resolver: zodResolver(categorySchema),
        defaultValues: {
            title: "",
            slug: "",
            parentId: "none",
            description: "",
            image: "",
        }
    })

    // Fetch Categories (Flat and build tree)
    const fetchCategories = async () => {
        setLoading(true)
        try {
            // Fetch flat list to get ALL categories including deep nesting
            const res = await fetch("/api/admin/categories", {
                cache: "no-store" // Disable cache to ensure fresh data
            })
            if (res.ok) {
                const flatData = await res.json()
                const tree = buildTree(flatData)
                setCategories(tree)
            } else {
                toast.error("Failed to load categories")
            }
        } catch (error) {
            console.error(error)
            toast.error("Error loading categories")
        } finally {
            setLoading(false)
        }
    }

    const fetchHomeCategorySlots = async () => {
        setHomeSlotsLoading(true)
        try {
            const res = await fetch("/api/admin/settings", { cache: "no-store" })
            if (!res.ok) throw new Error("Failed to load settings")
            const data = await res.json() as SiteSettings
            const ids = Array.isArray(data.shopByCategoryIds) ? data.shopByCategoryIds.slice(0, 8) : []
            const collectionIds = Array.isArray(data.collectionCategoryIds) ? data.collectionCategoryIds.slice(0, 7) : []
            setShopByCategoryIds(ids)
            setCollectionCategoryIds(collectionIds)
            setCollectionSectionTitle((data.collectionSectionTitle || "Shop by Collection").trim() || "Shop by Collection")
            setReviewShowcaseEnabled(Boolean(data.reviewShowcaseEnabled))
            setReviewShowcaseTitle((data.reviewShowcaseTitle || "Over 210,000 Five-Star Reviews").trim() || "Over 210,000 Five-Star Reviews")
            setReviewShowcaseSubtitle((data.reviewShowcaseSubtitle || "Explore the rugs everyone's raving about.").trim() || "Explore the rugs everyone's raving about.")
            setHomePromoSectionTitle((data.homePromoSectionTitle || "Most Popular").trim() || "Most Popular")
            setHomePromoCategoryId(data.homePromoCategoryId || "")
        } catch {
            setShopByCategoryIds([])
            setCollectionCategoryIds([])
            setCollectionSectionTitle("Shop by Collection")
            setReviewShowcaseEnabled(false)
            setReviewShowcaseTitle("Over 210,000 Five-Star Reviews")
            setReviewShowcaseSubtitle("Explore the rugs everyone's raving about.")
            setHomePromoSectionTitle("Most Popular")
            setHomePromoCategoryId("")
            toast.error("Failed to load home category slots")
        } finally {
            setHomeSlotsLoading(false)
        }
    }

    useEffect(() => {
        fetchCategories()
        fetchHomeCategorySlots()
        fetchReviewAccessList()
    }, [])

    async function fetchReviewAccessList() {
        setReviewAccessListLoading(true)
        try {
            const res = await fetch("/api/admin/review-access", { cache: "no-store" })
            if (!res.ok) throw new Error("Failed")
            const data = await res.json() as { items?: ReviewAccessItem[] }
            setReviewAccessItems(Array.isArray(data.items) ? data.items : [])
        } catch {
            setReviewAccessItems([])
        } finally {
            setReviewAccessListLoading(false)
        }
    }

    // Update flatItems (for drag & drop) when categories (tree) change
    // Note: buildFlatItems expects a tree
    useEffect(() => {
        setFlatItems(buildFlatItems(categories))
    }, [categories])

    useEffect(() => {
        if (hasInitializedCollapseRef.current) return
        if (categories.length === 0) return
        setCollapsedIds(new Set(collectParentIds(categories)))
        hasInitializedCollapseRef.current = true
    }, [categories])

    useEffect(() => {
        const validIds = new Set(flattenCategories(categories).map((cat) => cat.id))
        setShopByCategoryIds((prev) => prev.filter((id) => validIds.has(id)).slice(0, 8))
        setCollectionCategoryIds((prev) => prev.filter((id) => validIds.has(id)).slice(0, 7))
        setHomePromoCategoryId((prev) => (prev && !validIds.has(prev) ? "" : prev))
    }, [categories])

    useEffect(() => {
        if (!reorderMode) return
        setCollapsedIds(new Set(collectParentIds(categories)))
    }, [categories, reorderMode])

    const setHomeCategorySlot = (index: number, value: string) => {
        setShopByCategoryIds((prev) => {
            const next = [...prev]
            while (next.length < 8) next.push("")
            next[index] = value
            return next.slice(0, 8)
        })
    }

    const clearHomeCategorySlots = () => {
        setShopByCategoryIds([])
    }

    const setCollectionCategorySlot = (index: number, value: string) => {
        setCollectionCategoryIds((prev) => {
            const next = [...prev]
            while (next.length < 7) next.push("")
            next[index] = value
            return next.slice(0, 7)
        })
    }

    const saveHomeCategorySlots = async () => {
        setHomeSlotsSaving(true)
        try {
            const currentRes = await fetch("/api/admin/settings", { cache: "no-store" })
            if (!currentRes.ok) throw new Error("Failed to load current settings")
            const current = await currentRes.json() as SiteSettings
            const normalized = Array.from(new Set(shopByCategoryIds.filter((id) => id && id.trim().length > 0))).slice(0, 8)
            const normalizedCollection = Array.from(new Set(collectionCategoryIds.filter((id) => id && id.trim().length > 0))).slice(0, 7)

            const payload: SiteSettings = {
                ...current,
                shopByCategoryIds: normalized,
                collectionCategoryIds: normalizedCollection,
                collectionSectionTitle: collectionSectionTitle.trim() || "Shop by Collection",
                reviewShowcaseEnabled,
                reviewShowcaseTitle: reviewShowcaseTitle.trim() || "Over 210,000 Five-Star Reviews",
                reviewShowcaseSubtitle: reviewShowcaseSubtitle.trim() || "Explore the rugs everyone's raving about.",
                homePromoSectionTitle: homePromoSectionTitle.trim() || "Most Popular",
                homePromoCategoryId: homePromoCategoryId || "",
            }

            const saveRes = await fetch("/api/admin/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            if (!saveRes.ok) throw new Error("Failed to save")

            const saved = await saveRes.json() as SiteSettings
            setShopByCategoryIds(saved.shopByCategoryIds || [])
            setCollectionCategoryIds(saved.collectionCategoryIds || [])
            setCollectionSectionTitle((saved.collectionSectionTitle || "Shop by Collection").trim() || "Shop by Collection")
            setReviewShowcaseEnabled(Boolean(saved.reviewShowcaseEnabled))
            setReviewShowcaseTitle((saved.reviewShowcaseTitle || "Over 210,000 Five-Star Reviews").trim() || "Over 210,000 Five-Star Reviews")
            setReviewShowcaseSubtitle((saved.reviewShowcaseSubtitle || "Explore the rugs everyone's raving about.").trim() || "Explore the rugs everyone's raving about.")
            setHomePromoSectionTitle((saved.homePromoSectionTitle || "Most Popular").trim() || "Most Popular")
            setHomePromoCategoryId(saved.homePromoCategoryId || "")
            toast.success("Homepage sections saved")
        } catch {
            toast.error("Failed to save home category slots")
        } finally {
            setHomeSlotsSaving(false)
        }
    }

    const grantReviewAccess = async () => {
        const email = reviewAccessEmail.trim().toLowerCase()
        if (!email) {
            toast.error("Email is required")
            return
        }

        setReviewAccessLoading(true)
        try {
            const res = await fetch("/api/admin/review-access", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, notes: reviewAccessNote.trim() }),
            })
            const json = await res.json().catch(() => null as null | { error?: string })
            if (!res.ok) throw new Error(json?.error || "Failed to grant review access")
            toast.success("Review right granted")
            setReviewAccessEmail("")
            setReviewAccessNote("")
            fetchReviewAccessList()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to grant review access")
        } finally {
            setReviewAccessLoading(false)
        }
    }

    const toggleReviewAccess = async (item: ReviewAccessItem, approved: boolean) => {
        try {
            const res = await fetch(`/api/admin/review-access/${item.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ approved }),
            })
            if (!res.ok) throw new Error("Failed")
            setReviewAccessItems((prev) => prev.map((row) => row.id === item.id ? { ...row, approved } : row))
            toast.success(`Review access ${approved ? "activated" : "inactivated"}`)
        } catch {
            toast.error("Failed to update review access")
        }
    }

    // Auto-generate slug from title
    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const title = e.target.value
        form.setValue("title", title)
        const slug = title.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
        form.setValue("slug", slug)
    }

    // Edit Handler
    const handleEdit = (category: Category) => {
        setEditingId(category.id)
        form.setValue("title", category.title)
        form.setValue("slug", category.slug)
        form.setValue("parentId", category.parentId || "none")
        form.setValue("description", category.description || "")
        form.setValue("image", category.image || "")
    }

    const cancelEdit = () => {
        setEditingId(null)
        form.reset({ title: "", slug: "", parentId: "none", description: "", image: "" })
    }

    // Submit Handler (Create or Update)
    const onSubmit = async (data: CategoryFormValues) => {
        setSubmitting(true)
        try {
            const payload = {
                ...data,
                parentId: data.parentId === "none" ? null : data.parentId
            }

            const url = editingId
                ? `/api/admin/categories/${editingId}`
                : "/api/admin/categories"

            const method = editingId ? "PATCH" : "POST"

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })

            if (!res.ok) throw new Error("Failed")
            const responseData = await res.json() as Category | { category?: Category; categories?: Category[] }

            if (editingId) {
                toast.success("Category updated successfully!")
            } else {
                toast.success("Category created successfully!")
            }

            cancelEdit() // Reset form and mode

            if (!editingId && "categories" in responseData && Array.isArray(responseData.categories)) {
                const nextTree = buildTree(responseData.categories)
                setCategories(nextTree)
                setFlatItems(buildFlatItems(nextTree))
            } else {
                await fetchCategories()
            }

        } catch (error) {
            toast.error(editingId ? "Failed to update" : "Failed to create")
        } finally {
            setSubmitting(false)
        }
    }

    // Delete Handler
    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure?")) return

        try {
            await fetch(`/api/admin/categories/${id}`, { method: "DELETE" })
            await fetchCategories()
            toast.success("Category deleted successfully!")
        } catch (error) {
            toast.error("Failed to delete")
        }
    }

    // Bulk Handlers
    const flatList = flattenCategories(categories)
    const allIds = flatList.map(c => c.id)

    const toggleSelectAll = () => {
        if (selectedIds.size === allIds.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(allIds))
        }
    }

    const toggleSelection = (id: string) => {
        const next = new Set(selectedIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelectedIds(next)
    }

    const toggleCollapse = (id: string) => {
        setCollapsedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const handleBulkDelete = async (strategy: 'reassign' | 'orphan' | 'delete') => {
        setActionLoading(true)
        try {
            const res = await fetch("/api/admin/categories/bulk", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: Array.from(selectedIds), strategy })
            })
            if (res.ok) {
                toast.success("Categories deleted")
                setSelectedIds(new Set())
                setDeleteModalOpen(false)
                fetchCategories()
            } else {
                const data = await res.json()
                toast.error(data.error || "Bulk delete failed")
            }
        } catch (error) {
            toast.error("Bulk delete failed")
        } finally {
            setActionLoading(false)
        }
    }

    const handleBulkParent = async (parentId: string | null) => {
        setActionLoading(true)
        try {
            const action = parentId ? 'setParent' : 'removeParent'
            const res = await fetch("/api/admin/categories/bulk", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: Array.from(selectedIds), action, targetParentId: parentId })
            })
            if (res.ok) {
                toast.success("Parents updated")
                setSelectedIds(new Set())
                setParentModalOpen(false)
                fetchCategories()
            } else {
                const data = await res.json()
                toast.error(data.error || "Update failed")
            }
        } catch (error) {
            toast.error("Bulk update failed")
        } finally {
            setActionLoading(false)
        }
    }

    const handleReorder = async (updates: Array<{ id: string; parentId: string | null; sortOrder: number }>) => {
        try {
            const res = await fetch("/api/admin/categories/reorder", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ updates })
            })

            if (!res.ok) throw new Error("Reorder failed")
            const data = await res.json() as { success?: boolean; categories?: Category[]; error?: string }
            if (!data.success || !Array.isArray(data.categories)) {
                throw new Error(data.error || "Reorder failed")
            }
            const nextTree = buildTree(data.categories)
            setCategories(nextTree)
            setFlatItems(buildFlatItems(nextTree))
            toast.success("Order saved")
        } catch (e) {
            toast.error("Failed to save order")
            await fetchCategories() // Revert
        }
    }

    return (
        <div className="p-6 max-w-[1600px] mx-auto">
            {/* Bulk Action Bar */}
            {selectedIds.size > 0 && !reorderMode && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-6 backdrop-blur-md animate-in slide-in-from-top-4 fade-in duration-300">
                    <span className="font-medium text-sm">{selectedIds.size} selected</span>
                    <div className="h-4 w-px bg-white/20" />
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-white hover:bg-white/10 hover:text-white"
                            onClick={() => setParentModalOpen(true)}
                        >
                            Set Parent
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-300 hover:bg-red-500/20 hover:text-red-200"
                            onClick={() => setDeleteModalOpen(true)}
                        >
                            Delete
                        </Button>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-full hover:bg-white/20 text-white ml-2"
                        onClick={() => setSelectedIds(new Set())}
                    >
                        <X className="h-3 w-3" />
                    </Button>
                </div>
            )}

            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Product Categories</h1>
                    <p className="text-slate-500 text-sm mt-1">Manage hierarchy and organization</p>
                </div>
                <div className="flex items-center gap-3 bg-white px-4 py-2 border rounded-lg shadow-sm">
                    <Label htmlFor="reorder-mode" className="text-sm font-medium">Enable Reorder</Label>
                    <Switch
                        id="reorder-mode"
                        checked={reorderMode}
                        onCheckedChange={(checked) => {
                            setReorderMode(checked)
                            if (checked) setSelectedIds(new Set()) // Clear selection when entering reorder mode
                        }}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                {/* Left Column: Form */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white p-6 rounded-lg border shadow-sm sticky top-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold">
                                {editingId ? "Edit Category" : "Add New Category"}
                            </h2>
                            {editingId && (
                                <Button variant="ghost" size="sm" onClick={cancelEdit} className="h-8 text-xs">
                                    Cancel
                                </Button>
                            )}
                        </div>

                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            {/* Name */}
                            <div className="space-y-2">
                                <Label htmlFor="title">Name</Label>
                                <Input
                                    id="title"
                                    {...form.register("title")}
                                    onChange={handleTitleChange}
                                    placeholder="e.g. Vintage Rugs"
                                />
                                {form.formState.errors.title && (
                                    <p className="text-xs text-red-500">{form.formState.errors.title.message}</p>
                                )}
                            </div>

                            {/* Slug */}
                            <div className="space-y-2">
                                <Label htmlFor="slug">Slug</Label>
                                <Input
                                    id="slug"
                                    {...form.register("slug")}
                                    placeholder="e.g. vintage-rugs"
                                />
                                <p className="text-[11px] text-slate-400">The “slug” is the URL-friendly version of the name.</p>
                                {form.formState.errors.slug && (
                                    <p className="text-xs text-red-500">{form.formState.errors.slug.message}</p>
                                )}
                            </div>

                            {/* Parent */}
                            <div className="space-y-2">
                                <Label htmlFor="parent">Parent Category</Label>
                                <select
                                    id="parent"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    {...form.register("parentId")}
                                    disabled={reorderMode} // Disable parent selection in reorder mode? Maybe not needed but cleaner.
                                >
                                    <option value="none">None (Top Level)</option>
                                    {flatList.map(cat => (
                                        <option key={cat.id} value={cat.id}>
                                            {'\u00A0'.repeat(cat.level * 4)}{cat.title}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Description */}
                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    {...form.register("description")}
                                    placeholder="Optional description..."
                                    className="min-h-[100px]"
                                />
                            </div>

                            {/* Image */}
                            <div className="space-y-2">
                                <Label>Category Image</Label>
                                {form.watch("image") ? (
                                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                                        <img
                                            src={form.watch("image") || ""}
                                            alt={form.watch("title") || "Category image"}
                                            className="h-48 w-full object-cover"
                                        />
                                    </div>
                                ) : (
                                    <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                                        No category image selected
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    <Button type="button" variant="outline" onClick={() => setCategoryMediaPickerOpen(true)}>
                                        Select from Media
                                    </Button>
                                    {form.watch("image") ? (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() => form.setValue("image", "", { shouldDirty: true, shouldValidate: true })}
                                        >
                                            Remove
                                        </Button>
                                    ) : null}
                                </div>
                                <p className="text-[11px] text-slate-400">Optional. Used for the category header.</p>
                            </div>

                            <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700" disabled={submitting || reorderMode}>
                                {submitting ? "Saving..." : (editingId ? "Update Category" : "Add New Category")}
                            </Button>
                        </form>
                    </div>

                </div>

                {/* Right Column: List */}
                <div className="lg:col-span-8">
                    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                        {reorderMode ? (
                            <SortableTree
                                items={flatItems}
                                setItems={setFlatItems}
                                onEdit={(item: any) => {
                                    const full = findCategoryById(categories, item.id)
                                    if (full) {
                                        handleEdit(full)
                                        return
                                    }
                                    handleEdit({ ...item, children: [] } as Category)
                                }}
                                onDelete={handleDelete}
                                onReorder={handleReorder}
                            />
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50">
                                        <TableHead className="w-[50px]">
                                            <Checkbox
                                                checked={selectedIds.size === allIds.length && allIds.length > 0}
                                                onCheckedChange={toggleSelectAll}
                                            />
                                        </TableHead>
                                        <TableHead className="w-[40%]">Name</TableHead>
                                        <TableHead>Slug</TableHead>
                                        <TableHead>Count</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-slate-500">Loading...</TableCell>
                                        </TableRow>
                                    ) : categories.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-slate-500">No categories found.</TableCell>
                                        </TableRow>
                                    ) : (
                                        <CategoryTreeList
                                            categories={categories}
                                            selectedIds={selectedIds}
                                            onToggle={toggleSelection}
                                            onDelete={handleDelete}
                                            onEdit={handleEdit}
                                            collapsedIds={collapsedIds}
                                            onToggleCollapse={toggleCollapse}
                                        />
                                    )}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                </div>
            </div>

            {/* Modals */}
            <BulkDeleteModal
                open={deleteModalOpen}
                onOpenChange={setDeleteModalOpen}
                count={selectedIds.size}
                onConfirm={handleBulkDelete}
                loading={actionLoading}
            />

            <MediaPickerDialog
                open={categoryMediaPickerOpen}
                onOpenChange={setCategoryMediaPickerOpen}
                multiple={false}
                onSelect={(urls) => {
                    form.setValue("image", urls[0] || "", { shouldDirty: true, shouldValidate: true })
                    setCategoryMediaPickerOpen(false)
                }}
                title="Select category image"
                productMeta={{
                    title: form.watch("title") || "",
                    description: form.watch("description") || "",
                }}
            />

            <BulkParentModal
                open={parentModalOpen}
                onOpenChange={setParentModalOpen}
                categories={flatList}
                selectedIds={selectedIds}
                onConfirm={handleBulkParent}
                loading={actionLoading}
            />
        </div>
    )
}

// ... CategoryTreeList ...
// ... Modals ...


// --- Modals ---
function BulkDeleteModal({ open, onOpenChange, count, onConfirm, loading }: any) {
    const [strategy, setStrategy] = useState<'reassign' | 'orphan' | 'delete'>('reassign')

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete {count} Categories</DialogTitle>
                    <DialogDescription>
                        This action cannot be undone. What should happen to the sub-categories?
                    </DialogDescription>
                </DialogHeader>

                <RadioGroup value={strategy} onValueChange={(v: any) => setStrategy(v)} className="space-y-3 py-4">
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="reassign" id="reassign" />
                        <Label htmlFor="reassign" className="font-normal">
                            <span className="font-medium">Reassign children to parent</span> (Default)
                            <p className="text-xs text-muted-foreground">Children will move up one level.</p>
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="orphan" id="orphan" />
                        <Label htmlFor="orphan" className="font-normal">
                            <span className="font-medium">Make children top-level</span>
                            <p className="text-xs text-muted-foreground">Parent will be set to None.</p>
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="delete" id="delete" />
                        <Label htmlFor="delete" className="font-normal text-red-600">
                            <span className="font-medium">Delete children too</span>
                            <p className="text-xs text-red-400">Everything inside will be removed.</p>
                        </Label>
                    </div>
                </RadioGroup>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button variant="destructive" onClick={() => onConfirm(strategy)} disabled={loading}>
                        {loading ? "Deleting..." : "Confirm Delete"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function BulkParentModal({ open, onOpenChange, categories, selectedIds, onConfirm, loading }: any) {
    const [parentId, setParentId] = useState<string>("none")

    // Filter out invalid options: 
    // 1. The selected categories themselves
    // 2. Descendants of selected categories (simplified check: if start with selection? No, simplified flat list doesn't show lineage easily here without processing. 
    // We will just filter self for now. API will reject cycles if complex.)
    const validOptions = categories.filter((c: any) => !selectedIds.has(c.id))

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Set Parent for Selection</DialogTitle>
                    <DialogDescription>
                        Move selected categories to a new parent.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <Label className="mb-2 block">New Parent Category</Label>
                    <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={parentId}
                        onChange={(e) => setParentId(e.target.value)}
                    >
                        <option value="none">None (Top Level)</option>
                        {validOptions.map((cat: any) => (
                            <option key={cat.id} value={cat.id}>
                                {'\u00A0'.repeat(cat.level * 4)}{cat.title}
                            </option>
                        ))}
                    </select>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={() => onConfirm(parentId === "none" ? null : parentId)} disabled={loading}>
                        {loading ? "Updating..." : "Save Changes"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// --- Recursive Row Renderer ---
function CategoryTreeList({ categories, selectedIds, onToggle, onDelete, onEdit, collapsedIds, onToggleCollapse, level = 0 }: any) {
    return (
        <>
            {categories.map((cat: Category) => (
                <React.Fragment key={cat.id}>
                    <TableRow className={`group transition-colors ${selectedIds.has(cat.id) ? 'bg-teal-50 hover:bg-teal-100/50' : 'hover:bg-slate-50'}`}>
                        <TableCell>
                            <Checkbox
                                checked={selectedIds.has(cat.id)}
                                onCheckedChange={() => onToggle(cat.id)}
                            />
                        </TableCell>
                        <TableCell className="font-medium text-slate-900">
                            <div className="flex items-center gap-2">
                                {/* Indentation */}
                                <div style={{ width: level * 24 }} />
                                {level > 0 && (
                                    <div
                                        className="h-8 w-8 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100"
                                        title={cat.title}
                                    >
                                        {(cat.image || cat.featuredPreview?.[0]?.image) ? (
                                            <img
                                                src={cat.image || cat.featuredPreview?.[0]?.image || ""}
                                                alt={cat.title}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center text-[9px] text-slate-500">N/A</div>
                                        )}
                                    </div>
                                )}
                                {/* Dash for children */}
                                {level > 0 && <span className="text-slate-300">——</span>}
                                {cat.title}
                                {cat.children && cat.children.length > 0 && (
                                    <button
                                        onClick={() => onToggleCollapse(cat.id)}
                                        className="ml-2 p-1 text-slate-400 hover:text-teal-600 hover:bg-slate-100 rounded transition-colors"
                                        title={collapsedIds.has(cat.id) ? "Expand" : "Collapse"}
                                    >
                                        {collapsedIds.has(cat.id) ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </button>
                                )}
                            </div>
                        </TableCell>
                        <TableCell className="text-slate-500">{cat.slug}</TableCell>
                        <TableCell>
                            <span className="inline-flex items-center justify-center h-6 min-w-[24px] px-1.5 rounded bg-slate-100 text-xs font-medium text-slate-600">
                                {cat._count?.products || 0}
                            </span>
                        </TableCell>
                        <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    onClick={() => onEdit(cat)}
                                >
                                    <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => onDelete(cat.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </TableCell>
                    </TableRow>
                    {/* Recursion for Children */}
                    {cat.children && cat.children.length > 0 && !collapsedIds.has(cat.id) && (
                        <CategoryTreeList
                            categories={cat.children}
                            selectedIds={selectedIds}
                            onToggle={onToggle}
                            onDelete={onDelete}
                            onEdit={onEdit}
                            collapsedIds={collapsedIds}
                            onToggleCollapse={onToggleCollapse}
                            level={level + 1}
                        />
                    )}
                </React.Fragment>
            ))}
        </>
    )
}
