"use client"

import { useState, useEffect } from "react"
import { Search, FileText, Folder, Link as LinkIcon, Plus, Instagram, X } from "lucide-react"
import { toast } from "sonner"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type SourceItemFunc = (items: { type: "PAGE" | "CATEGORY" | "CUSTOM", label: string, url: string, referenceId?: string }[]) => void

import { CreatePageModal } from "@/components/admin/pages/create-page-modal"
import type { FooterSocialLink } from "@/lib/site-settings"
import { resolvePublicPageHref } from "@/lib/public-page-routes"

interface MenuSourcesPanelProps {
    disabled: boolean
    onAddItems: SourceItemFunc
}

type SocialPlatformKey = "facebook" | "x" | "instagram" | "youtube" | "tiktok" | "linkedin" | "pinterest"

function SocialBrandIcon({ platform, className = "" }: { platform: SocialPlatformKey, className?: string }) {
    const colorByPlatform: Record<SocialPlatformKey, string> = {
        facebook: "text-[#1877F2]",
        x: "text-[#111111]",
        instagram: "text-[#E4405F]",
        youtube: "text-[#FF0000]",
        tiktok: "text-[#00F2EA]",
        linkedin: "text-[#0A66C2]",
        pinterest: "text-[#E60023]",
    }

    if (platform === "instagram") {
        return (
            <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 ${colorByPlatform[platform]} ${className}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
            </svg>
        )
    }
    if (platform === "youtube") {
        return (
            <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 ${colorByPlatform[platform]} ${className}`} fill="currentColor" aria-hidden="true">
                <path d="M23 12s0-3.4-.43-5.03a2.6 2.6 0 0 0-1.84-1.84C19.1 4.7 12 4.7 12 4.7s-7.1 0-8.73.43A2.6 2.6 0 0 0 1.43 6.97C1 8.6 1 12 1 12s0 3.4.43 5.03a2.6 2.6 0 0 0 1.84 1.84c1.63.43 8.73.43 8.73.43s7.1 0 8.73-.43a2.6 2.6 0 0 0 1.84-1.84C23 15.4 23 12 23 12z" />
                <path d="M10 15.5v-7l6 3.5-6 3.5z" fill="#fff" />
            </svg>
        )
    }

    const textByPlatform: Record<SocialPlatformKey, string> = {
        facebook: "f",
        x: "X",
        instagram: "",
        youtube: "",
        tiktok: "♪",
        linkedin: "in",
        pinterest: "P",
    }

    return (
        <span className={`font-bold leading-none ${colorByPlatform[platform]} ${className}`} aria-hidden="true">
            {textByPlatform[platform]}
        </span>
    )
}

// --- Helper Components ---

function PageList({ onAdd, disabled }: { onAdd: SourceItemFunc, disabled: boolean }) {
    const [pages, setPages] = useState<{ id: string, title: string, slug: string, status: string }[]>([])
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [loading, setLoading] = useState(false)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

    const loadPages = async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/admin/pages?limit=100")
            if (res.ok) {
                const json = await res.json()
                setPages(json.data || [])
            }
        } catch (e) {
            console.error(e)
            toast.error("Failed to load pages")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadPages()
    }, [])

    const handlePageCreated = (newPage: any) => {
        // Refresh list and select the new page
        loadPages().then(() => {
            setSelected(new Set([newPage.id]))
        })
    }

    const handleAdd = () => {
        const itemsToAdd = pages
            .filter(p => selected.has(p.id))
            .map(p => ({
                type: "PAGE" as const,
                label: p.title,
                url: resolvePublicPageHref(p.slug),
                referenceId: p.id
            }))

        onAdd(itemsToAdd)
        setSelected(new Set())
        toast.success(`Added ${itemsToAdd.length} pages`)
    }

    const toggle = (id: string, checked: boolean) => {
        const next = new Set(selected)
        if (checked) next.add(id)
        else next.delete(id)
        setSelected(next)
    }

    const isButtonDisabled = disabled || selected.size === 0
    const disabledReason = disabled ? "Please select a menu first" : selected.size === 0 ? "Select at least one page" : ""

    return (
        <div className="flex flex-col h-full">
            <div className="p-3 border-b bg-slate-50/50">
                <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <Input placeholder="Search pages..." className="h-8 pl-8 text-xs bg-white" />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[300px] p-2 space-y-1">
                {loading ? <div className="p-4 text-xs text-slate-400 text-center">Loading pages...</div> :
                    pages.length === 0 ? <div className="p-4 text-xs text-slate-400 text-center">No pages found.</div> :
                        pages.map(page => (
                            <div key={page.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded group">
                                <Checkbox
                                    id={`p-${page.id}`}
                                    checked={selected.has(page.id)}
                                    onCheckedChange={(c) => toggle(page.id, c as boolean)}
                                />
                                <Label htmlFor={`p-${page.id}`} className="flex-1 text-xs cursor-pointer truncate font-normal text-slate-700">
                                    {page.title}
                                    {page.status === 'DRAFT' && <Badge variant="outline" className="ml-2 text-[10px] h-4 py-0 px-1 border-amber-200 text-amber-600">Draft</Badge>}
                                </Label>
                            </div>
                        ))}
            </div>

            <div className="p-3 border-t bg-slate-50 flex justify-between items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setIsCreateModalOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" /> New page
                </Button>
                <div className="flex items-center gap-2">
                    {isButtonDisabled && <span className="text-[10px] text-slate-400 italic">{disabledReason}</span>}
                    <Button size="sm" variant="outline" disabled={isButtonDisabled} onClick={handleAdd}>
                        Add to Menu
                    </Button>
                </div>
            </div>

            <CreatePageModal
                open={isCreateModalOpen}
                onOpenChange={setIsCreateModalOpen}
                onSuccess={handlePageCreated}
            />
        </div>
    )
}

function CategoryList({ onAdd, disabled }: { onAdd: SourceItemFunc, disabled: boolean }) {
    const [categories, setCategories] = useState<any[]>([])
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            try {
                const res = await fetch("/api/admin/categories?tree=true")
                if (res.ok) setCategories(await res.json())
            } catch (e) { console.error(e) }
            finally { setLoading(false) }
        }
        load()
    }, [])

    const toggle = (id: string, checked: boolean) => {
        const next = new Set(selected)
        if (checked) next.add(id)
        else next.delete(id)
        setSelected(next)
    }

    // Helper to flatten search
    const findCat = (list: any[], id: string): any => {
        for (const c of list) {
            if (c.id === id) return c
            if (c.children) {
                const found = findCat(c.children, id)
                if (found) return found
            }
        }
        return null
    }

    const handleAdd = () => {
        const itemsToAdd: any[] = []
        selected.forEach(id => {
            const cat = findCat(categories, id)
            if (cat) {
                itemsToAdd.push({
                    type: "CATEGORY" as const,
                    label: cat.title,
                    url: `/category/${cat.slug}`,
                    referenceId: cat.id
                })
            }
        })
        onAdd(itemsToAdd)
        setSelected(new Set())
        toast.success(`Added ${itemsToAdd.length} categories`)
    }

    const RecursiveItem = ({ item, level = 0 }: { item: any, level?: number }) => (
        <div className="space-y-1">
            <div className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded group" style={{ paddingLeft: `${(level * 12) + 6}px` }}>
                <Checkbox
                    id={`c-${item.id}`}
                    checked={selected.has(item.id)}
                    onCheckedChange={(c) => toggle(item.id, c as boolean)}
                />
                <Label htmlFor={`c-${item.id}`} className="flex-1 text-xs cursor-pointer truncate font-normal text-slate-700 flex items-center">
                    {item.children?.length > 0 && <Folder className="h-3 w-3 mr-1 text-slate-400" />}
                    {item.title}
                </Label>
            </div>
            {item.children?.map((child: any) => <RecursiveItem key={child.id} item={child} level={level + 1} />)}
        </div>
    )

    const isButtonDisabled = disabled || selected.size === 0
    const disabledReason = disabled ? "Please select a menu first" : selected.size === 0 ? "Select at least one category" : ""

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto max-h-[300px] p-2 space-y-1 min-h-[150px]">
                {loading ? <div className="p-4 text-xs text-slate-400 text-center">Loading categories...</div> :
                    categories.length === 0 ? <div className="p-4 text-xs text-slate-400 text-center">No categories found.</div> :
                        categories.map(cat => <RecursiveItem key={cat.id} item={cat} />)
                }
            </div>
            <div className="p-3 border-t bg-slate-50 flex justify-end items-center gap-2">
                {isButtonDisabled && <span className="text-[10px] text-slate-400 italic">{disabledReason}</span>}
                <Button size="sm" variant="outline" disabled={isButtonDisabled} onClick={handleAdd}>
                    Add to Menu
                </Button>
            </div>
        </div>
    )
}

function CustomLinkInput({ onAdd, disabled }: { onAdd: SourceItemFunc, disabled: boolean }) {
    const [url, setUrl] = useState("https://")
    const [label, setLabel] = useState("")

    const handleAdd = () => {
        onAdd([{ type: "CUSTOM", label, url }])
        setLabel("")
        setUrl("https://")
        toast.success("Added custom link")
    }

    const isButtonDisabled = disabled || !label || !url
    const disabledReason = disabled ? "Please select a menu first" : (!label || !url) ? "Enter label and URL" : ""

    return (
        <div className="p-4 space-y-4">
            <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-500">URL</Label>
                <Input value={url} onChange={e => setUrl(e.target.value)} className="h-8 text-xs" placeholder="https://example.com" />
            </div>
            <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-500">Link Text</Label>
                <Input value={label} onChange={e => setLabel(e.target.value)} className="h-8 text-xs" placeholder="Menu Item" />
            </div>
            <div className="pt-2 flex justify-end items-center gap-2">
                {isButtonDisabled && <span className="text-[10px] text-slate-400 italic">{disabledReason}</span>}
                <Button size="sm" variant="outline" disabled={isButtonDisabled} onClick={handleAdd}>
                    Add to Menu
                </Button>
            </div>
        </div>
    )
}

function SocialMediaInput({
    disabled,
}: {
    disabled: boolean
}) {
    const platforms = [
        { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/your-page" },
        { key: "x", label: "X (Twitter)", placeholder: "https://x.com/your-page" },
        { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/your-page" },
        { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@your-page" },
        { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@your-page" },
        { key: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/company/your-page" },
        { key: "pinterest", label: "Pinterest", placeholder: "https://pinterest.com/your-page" },
    ] as const

    const [platformKey, setPlatformKey] = useState<(typeof platforms)[number]["key"]>("facebook")
    const [url, setUrl] = useState("https://")
    const [addedSocialItems, setAddedSocialItems] = useState<Array<FooterSocialLink>>([])
    const [loading, setLoading] = useState(false)

    const detectPlatform = (label: string, rawUrl: string): SocialPlatformKey | null => {
        const lowLabel = label.toLowerCase()
        const lowUrl = rawUrl.toLowerCase()
        if (lowLabel.includes("facebook") || lowUrl.includes("facebook.com")) return "facebook"
        if (lowLabel.includes("instagram") || lowUrl.includes("instagram.com")) return "instagram"
        if (lowLabel === "x" || lowLabel.includes("twitter") || lowUrl.includes("x.com") || lowUrl.includes("twitter.com")) return "x"
        if (lowLabel.includes("youtube") || lowUrl.includes("youtube.com") || lowUrl.includes("youtu.be")) return "youtube"
        if (lowLabel.includes("tiktok") || lowUrl.includes("tiktok.com")) return "tiktok"
        if (lowLabel.includes("linkedin") || lowUrl.includes("linkedin.com")) return "linkedin"
        if (lowLabel.includes("pinterest") || lowUrl.includes("pinterest.com")) return "pinterest"
        return null
    }

    useEffect(() => {
        let mounted = true
        const load = async () => {
            setLoading(true)
            try {
                const res = await fetch("/api/admin/settings", { cache: "no-store" })
                if (!res.ok) throw new Error("Failed to load social media links")
                const json = await res.json()
                const items = Array.isArray(json?.footerSocialLinks) ? json.footerSocialLinks : []
                const safe = items
                    .map((item: { platform?: string; label?: string; url?: string }) => {
                        const iconKey = detectPlatform(item?.label || "", item?.url || "") || (item?.platform as SocialPlatformKey | undefined)
                        if (!iconKey || !item?.label || !item?.url) return null
                        return {
                            platform: iconKey,
                            label: item.label,
                            url: item.url,
                        } as FooterSocialLink
                    })
                    .filter((item: FooterSocialLink | null): item is FooterSocialLink => Boolean(item))
                if (mounted) setAddedSocialItems(safe)
            } catch (e) {
                console.error(e)
                toast.error("Failed to load social media links")
            } finally {
                if (mounted) setLoading(false)
            }
        }
        load()
        return () => {
            mounted = false
        }
    }, [])

    const availablePlatforms = platforms.filter(
        (platform) =>
            !addedSocialItems.some((item) => item.platform === platform.key)
    )
    const selectedPlatform = availablePlatforms.find((item) => item.key === platformKey) || availablePlatforms[0] || null

    useEffect(() => {
        if (!selectedPlatform && availablePlatforms.length > 0) {
            setPlatformKey(availablePlatforms[0].key)
        }
    }, [availablePlatforms, selectedPlatform])

    const persistLinks = async (links: FooterSocialLink[]) => {
        const res = await fetch("/api/admin/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ footerSocialLinks: links }),
        })
        if (!res.ok) {
            throw new Error("save failed")
        }
    }

    const handleQueue = async () => {
        if (!selectedPlatform) {
            toast.error("All social media platforms are already added")
            return
        }
        const cleanUrl = url.trim()
        if (!cleanUrl || cleanUrl === "https://" || cleanUrl === "http://") {
            toast.error("Enter a valid social media link")
            return
        }
        const next = [
            ...addedSocialItems,
            {
                platform: selectedPlatform.key,
                label: selectedPlatform.label,
                url: cleanUrl,
            } as FooterSocialLink,
        ]
        try {
            await persistLinks(next)
            setAddedSocialItems(next)
            setUrl("https://")
            toast.success(`${selectedPlatform.label} added`)
        } catch {
            toast.error("Failed to save social media link")
        }
    }

    const handleRemoveFromMenu = async (platform: FooterSocialLink["platform"]) => {
        const next = addedSocialItems.filter((item) => item.platform !== platform)
        try {
            await persistLinks(next)
            setAddedSocialItems(next)
            toast.success("Social media link removed")
        } catch {
            toast.error("Failed to remove social media link")
        }
    }

    const addDisabled = disabled || loading || !url.trim() || !selectedPlatform

    return (
        <div className="p-4 space-y-4">
            <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-500">Selected Platform</Label>
                <Select value={platformKey} onValueChange={(value) => setPlatformKey(value as (typeof platforms)[number]["key"])}>
                    <SelectTrigger className="h-8 text-xs" disabled={availablePlatforms.length === 0}>
                        {selectedPlatform ? (
                            <div className="inline-flex items-center gap-2">
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100">
                                    <SocialBrandIcon platform={selectedPlatform.key} className="text-[14px]" />
                                </span>
                                <span>{selectedPlatform.label}</span>
                            </div>
                        ) : (
                            <SelectValue placeholder="Select a social platform" />
                        )}
                    </SelectTrigger>
                    <SelectContent>
                        {availablePlatforms.map((platform) => {
                            return (
                            <SelectItem key={platform.key} value={platform.key}>
                                <span className="inline-flex items-center gap-2">
                                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100">
                                        <SocialBrandIcon platform={platform.key} className="text-[14px]" />
                                    </span>
                                    <span>{platform.label}</span>
                                </span>
                            </SelectItem>
                        )})}
                    </SelectContent>
                </Select>
                {selectedPlatform ? (
                    <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
                        <SocialBrandIcon platform={selectedPlatform.key} className="text-[14px]" />
                        <span>{selectedPlatform.label}</span>
                    </div>
                ) : (
                    <div className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-500">
                        All platforms already added.
                    </div>
                )}
            </div>

            <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-500">Profile Link</Label>
                <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="h-8 text-xs"
                    placeholder={selectedPlatform?.placeholder || "https://"}
                />
            </div>

            <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={handleQueue} disabled={addDisabled}>
                    Add
                </Button>
            </div>

            <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold text-slate-600">
                    Added Social Media Links
                </div>
                {addedSocialItems.length === 0 ? (
                    <div className="text-xs text-slate-400">No social media links in menu.</div>
                ) : (
                    <div className="space-y-2.5">
                        {addedSocialItems.map((item) => (
                            <div key={item.platform} className="relative rounded-md border border-slate-200 bg-white px-3 py-2.5 pr-9">
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="absolute right-1 top-1 h-6 w-6 text-red-500 hover:bg-red-50 hover:text-red-600"
                                    onClick={() => handleRemoveFromMenu(item.platform)}
                                >
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                                <div className="flex min-w-0 items-start gap-2.5">
                                    {(() => {
                                        const platform = platforms.find((p) => p.key === item.platform)
                                        if (!platform) return null
                                        return (
                                            <div className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
                                                <SocialBrandIcon platform={platform.key} className="text-[14px]" />
                                            </div>
                                        )
                                    })()}
                                    <div className="min-w-0">
                                        <p className="truncate text-xs font-medium text-slate-700">{item.label}</p>
                                        <p className="truncate text-[11px] text-slate-500">{item.url}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export function MenuSourcesPanel({ disabled, onAddItems }: MenuSourcesPanelProps) {
    return (
        <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="social" className="bg-white border-b-0">
                <AccordionTrigger className="px-4 py-3 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600">
                    <div className="flex items-center gap-2"><Instagram className="h-4 w-4" /> Social Media</div>
                </AccordionTrigger>
                <AccordionContent className="p-0 border-t">
                    <SocialMediaInput disabled={disabled} />
                </AccordionContent>
            </AccordionItem>

            <AccordionItem value="pages" className="bg-white border-b-0">
                <AccordionTrigger className="px-4 py-3 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600">
                    <div className="flex items-center gap-2"><FileText className="h-4 w-4" /> Pages</div>
                </AccordionTrigger>
                <AccordionContent className="p-0 border-t">
                    <PageList onAdd={onAddItems} disabled={disabled} />
                </AccordionContent>
            </AccordionItem>

            <AccordionItem value="categories" className="bg-white border-b-0 border-t">
                <AccordionTrigger className="px-4 py-3 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600">
                    <div className="flex items-center gap-2"><Folder className="h-4 w-4" /> Categories</div>
                </AccordionTrigger>
                <AccordionContent className="p-0 border-t">
                    <CategoryList onAdd={onAddItems} disabled={disabled} />
                </AccordionContent>
            </AccordionItem>

            <AccordionItem value="custom" className="bg-white border-b-0 border-t">
                <AccordionTrigger className="px-4 py-3 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600">
                    <div className="flex items-center gap-2"><LinkIcon className="h-4 w-4" /> Custom Link</div>
                </AccordionTrigger>
                <AccordionContent className="p-0 border-t">
                    <CustomLinkInput onAdd={onAddItems} disabled={disabled} />
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    )
}
