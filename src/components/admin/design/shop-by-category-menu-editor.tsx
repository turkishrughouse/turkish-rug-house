"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Save } from "lucide-react"
import { toast } from "sonner"

type Category = {
    id: string
    name: string
    slug: string
}

export function ShopByCategoryMenuEditor() {
    const router = useRouter()
    const [categories, setCategories] = useState<Category[]>([])
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const [catRes, settingsRes] = await Promise.all([
                fetch("/api/admin/categories"),
                fetch("/api/admin/settings"),
            ])
            if (catRes.ok) {
                const catData = await catRes.json()
                setCategories(Array.isArray(catData.data) ? catData.data : (Array.isArray(catData) ? catData : []))
            }
            if (settingsRes.ok) {
                const settingsData = await settingsRes.json()
                const ids = settingsData?.shopByCategoryIds
                if (Array.isArray(ids)) setSelectedIds(ids)
            }
        } catch {
            toast.error("Failed to load data")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const toggleCategory = (id: string) => {
        setSelectedIds((prev) => {
            if (prev.includes(id)) return prev.filter((x) => x !== id)
            if (prev.length >= 8) {
                toast.error("Maximum 8 categories allowed")
                return prev
            }
            return [...prev, id]
        })
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await fetch("/api/admin/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ shopByCategoryIds: selectedIds }),
            })
            if (!res.ok) {
                toast.error("Failed to save")
                return
            }
            toast.success("Shop by category updated")
            router.refresh()
        } catch {
            toast.error("Failed to save")
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <Card className="bg-white border border-[#dce3ed] shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-slate-900">Shop by Category</CardTitle>
                        <p className="text-sm text-slate-500 mt-1">
                            Select up to 8 categories to feature on the homepage banner. ({selectedIds.length}/8)
                        </p>
                    </div>
                    <Button onClick={handleSave} disabled={saving} size="sm">
                        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        Save
                    </Button>
                </CardHeader>
                <CardContent>
                    {categories.length === 0 ? (
                        <p className="text-sm text-slate-500">No categories found.</p>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {categories.map((cat) => {
                                const isSelected = selectedIds.includes(cat.id)
                                const order = selectedIds.indexOf(cat.id)
                                return (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => toggleCategory(cat.id)}
                                        className={`relative rounded-lg border px-3 py-2.5 text-left text-sm transition-all ${
                                            isSelected
                                                ? "border-teal-500 bg-teal-50 text-teal-900"
                                                : "border-[#dce3ed] bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                                        }`}
                                    >
                                        {isSelected && (
                                            <span className="absolute right-2 top-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-teal-500 text-[10px] font-bold text-white">
                                                {order + 1}
                                            </span>
                                        )}
                                        <span className="font-medium block truncate pr-5">{cat.name}</span>
                                        <span className="text-xs text-slate-500 block truncate">{cat.slug}</span>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {selectedIds.length > 0 && (
                <Card className="bg-white border border-[#dce3ed] shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
                    <CardHeader>
                        <CardTitle className="text-slate-900">Selected Order</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {selectedIds.map((id, index) => {
                                const cat = categories.find((c) => c.id === id)
                                if (!cat) return null
                                return (
                                    <div key={id} className="flex items-center gap-3 rounded-lg border border-[#dce3ed] bg-slate-50 px-3 py-2">
                                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-teal-500 text-xs font-bold text-white">
                                            {index + 1}
                                        </span>
                                        <span className="flex-1 text-sm font-medium text-slate-900">{cat.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => toggleCategory(id)}
                                            className="text-xs text-red-500 hover:text-red-700"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
