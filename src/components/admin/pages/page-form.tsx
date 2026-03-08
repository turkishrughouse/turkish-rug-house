"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Page } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import {
    Loader2,
    ArrowLeft,
    ExternalLink,
    ImagePlus,
    Trash2,
    Pencil,
} from "lucide-react"
import { slugify } from "@/lib/utils"
import { composePageContent, parsePageLayout } from "@/lib/page-layout"
import { buildYouTubeEmbedUrl } from "@/lib/youtube"
import { MediaPickerDialog } from "@/components/admin/media/media-picker-dialog"

export const PAGE_STATUSES = [
    { value: "DRAFT", label: "Draft" },
    { value: "PUBLISHED", label: "Published" },
] as const

const STATUS_VALUES = PAGE_STATUSES.map((s) => s.value) as [string, ...string[]]

const pageSchema = z.object({
    title: z.string().min(1, "Title is required"),
    slug: z.string().min(1, "Slug is required"),
    content: z.string().optional(),
    featuredImage: z.string().optional(),
    excerpt: z.string().optional(),
    status: z.enum(STATUS_VALUES),
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
})

type PageFormValues = z.infer<typeof pageSchema>

type SectionLayoutOrder = "description-image" | "image-description"
type SectionStatus = "active" | "inactive"
type SectionBlockType = "content" | "title" | "description" | "image"
type EditableImageItem = {
    url: string
    title: string
}
type EditableSection = {
    id: string
    type: SectionBlockType
    layout: SectionLayoutOrder
    status: SectionStatus
    title: string
    mediaType: "image" | "video"
    description: string
    image: string
    images: string[]
    imageItems: EditableImageItem[]
    videoUrl: string
}

type MediaPickerTarget =
    | { type: "featured" }
    | { type: "section"; sectionId: string }

interface PageFormProps {
    initialData?: Page
}

export function PageForm({ initialData }: PageFormProps) {
    const router = useRouter()
    const parsedLayout = parsePageLayout(initialData?.content || "")
    const [loading, setLoading] = useState(false)
    const [siteOrigin, setSiteOrigin] = useState("")
    const [isEditingSlug, setIsEditingSlug] = useState(false)
    const [sections, setSections] = useState<EditableSection[]>([])
    const [youtubeUrl, setYoutubeUrl] = useState(parsedLayout.layout?.youtubeUrl || "")
    const [mediaPickerOpen, setMediaPickerOpen] = useState(false)
    const [mediaPickerTarget, setMediaPickerTarget] = useState<MediaPickerTarget | null>(null)

    const cardSurface = "bg-white border border-[#dce3ed] shadow-[0_8px_24px_rgba(15,23,42,0.05)]"
    const inputSurface = "bg-white border-[#dce3ed] text-slate-900 placeholder:text-slate-400"

    const normalizedStatus = initialData?.status
        ? (initialData.status.toUpperCase() as typeof STATUS_VALUES[number])
        : "DRAFT"

    const defaultValues: PageFormValues = {
        title: initialData?.title || "",
        slug: initialData?.slug || "",
        content: parsedLayout.content || "",
        featuredImage: initialData?.featuredImage || "",
        excerpt: initialData?.excerpt || "",
        status: STATUS_VALUES.includes(normalizedStatus) ? normalizedStatus : "DRAFT",
        metaTitle: initialData?.metaTitle || "",
        metaDescription: initialData?.metaDescription || "",
    }

    const form = useForm<PageFormValues>({
        resolver: zodResolver(pageSchema),
        defaultValues,
    })

    useEffect(() => {
        const parsedSections = parsedLayout.layout?.sections
        if (parsedSections && parsedSections.length > 0) {
            setSections(
                parsedSections.map((item, index) => ({
                    id: item.id || `section-${Date.now()}-${index}`,
                    type:
                        item.type === "title"
                            ? "title"
                            : item.type === "description"
                                ? "description"
                                : item.type === "image"
                                    ? "image"
                                    : "content",
                    layout: item.layout,
                    status: item.enabled ? "active" : "inactive",
                    title: item.title || "",
                    mediaType: item.mediaType === "video" ? "video" : "image",
                    description: item.description || "",
                    image: item.image || "",
                    imageItems: Array.isArray(item.imageItems) && item.imageItems.length > 0
                        ? item.imageItems
                            .filter((img): img is EditableImageItem => Boolean(img && typeof img.url === "string" && img.url.trim().length > 0))
                            .map((img) => ({ url: img.url, title: typeof img.title === "string" ? img.title : "" }))
                        : Array.isArray(item.images) && item.images.length > 0
                            ? item.images
                                .filter((img): img is string => typeof img === "string" && img.trim().length > 0)
                                .map((url, imageIndex) => ({ url, title: imageIndex === 0 && item.type === "image" ? item.title || "" : "" }))
                            : item.image
                                ? [{ url: item.image, title: item.type === "image" ? item.title || "" : "" }]
                                : [],
                    images: Array.isArray(item.imageItems) && item.imageItems.length > 0
                        ? item.imageItems
                            .filter((img): img is EditableImageItem => Boolean(img && typeof img.url === "string" && img.url.trim().length > 0))
                            .map((img) => img.url)
                        : Array.isArray(item.images)
                            ? item.images.filter((img): img is string => typeof img === "string" && img.trim().length > 0)
                            : item.image
                                ? [item.image]
                                : [],
                    videoUrl: item.videoUrl || "",
                }))
            )
        }
        setYoutubeUrl(parsedLayout.layout?.youtubeUrl || "")
    }, [initialData?.id]) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (initialData) return
        const subscription = form.watch((value, { name }) => {
            if (name === "title" && value.title && !isEditingSlug) {
                form.setValue("slug", slugify(value.title), { shouldValidate: true })
            }
        })
        return () => subscription.unsubscribe()
    }, [form, initialData, isEditingSlug])

    useEffect(() => {
        setSiteOrigin(window.location.origin)
    }, [])

    const titleValue = form.watch("title") || ""
    const slugValue = form.watch("slug") || ""
    const featuredImageValue = form.watch("featuredImage") || ""
    const metaTitleValue = form.watch("metaTitle") || ""
    const metaDescriptionValue = form.watch("metaDescription") || ""
    const excerptValue = form.watch("excerpt") || ""
    const youtubeEmbedPreview = buildYouTubeEmbedUrl(youtubeUrl)
    const googlePreviewTitle = (metaTitleValue || titleValue || "Untitled page").trim().slice(0, 60)
    const googlePreviewDescription = (metaDescriptionValue || excerptValue || "Page description preview").trim().slice(0, 160)
    const googlePreviewUrl = `${siteOrigin || "https://turkishrughouse.com"}/info/${slugValue || "page-slug"}`

    const updateSection = (id: string, patch: Partial<EditableSection>) => {
        setSections((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
    }

    const createSection = (
        type: SectionBlockType = "content",
        layout: SectionLayoutOrder = "description-image"
    ) => {
        setSections((prev) => [
            ...prev,
            {
                id: `section-${Date.now()}-${prev.length}`,
                type,
                layout,
                status: "active",
                title: "",
                mediaType: "image",
                description: "",
                image: "",
                images: [],
                imageItems: [],
                videoUrl: "",
            },
        ])
    }

    const updateSectionImageItem = (sectionId: string, imageIndex: number, patch: Partial<EditableImageItem>) => {
        setSections((prev) =>
            prev.map((item) => {
                if (item.id !== sectionId) return item
                const nextImageItems = item.imageItems.map((imageItem, idx) =>
                    idx === imageIndex ? { ...imageItem, ...patch } : imageItem
                )
                const nextImages = nextImageItems.map((entry) => entry.url).filter(Boolean)
                return {
                    ...item,
                    imageItems: nextImageItems,
                    images: nextImages,
                    image: nextImages[0] || "",
                }
            })
        )
    }

    const removeSectionImageAt = (sectionId: string, imageIndex: number) => {
        setSections((prev) =>
            prev.map((item) => {
                if (item.id !== sectionId) return item
                const nextImageItems = item.imageItems.filter((_, idx) => idx !== imageIndex)
                const nextImages = nextImageItems.map((entry) => entry.url).filter(Boolean)
                return {
                    ...item,
                    imageItems: nextImageItems,
                    images: nextImages,
                    image: nextImages[0] || "",
                }
            })
        )
    }

    const removeSection = (id: string) => {
        setSections((prev) => prev.filter((item) => item.id !== id))
    }

    const moveSectionToPosition = (id: string, targetPosition: number) => {
        setSections((prev) => {
            if (prev.length <= 1) return prev
            const currentIndex = prev.findIndex((item) => item.id === id)
            if (currentIndex === -1) return prev

            const nextIndex = Math.max(0, Math.min(prev.length - 1, targetPosition - 1))
            if (nextIndex === currentIndex) return prev

            const next = [...prev]
            const [moved] = next.splice(currentIndex, 1)
            next.splice(nextIndex, 0, moved)
            return next
        })
    }

    const appendSectionImages = (sectionId: string, urls: string[]) => {
        if (urls.length === 0) return
        setSections((prev) =>
            prev.map((item) => {
                if (item.id !== sectionId) return item
                const currentImageItems = item.imageItems.length > 0
                    ? item.imageItems
                    : (item.images.length > 0
                        ? item.images.map((url) => ({ url, title: "" }))
                        : (item.image ? [{ url: item.image, title: "" }] : []))
                const nextImageItems = [
                    ...currentImageItems,
                    ...urls.map((url) => ({ url, title: "" })),
                ]
                const nextImages = nextImageItems.map((entry) => entry.url).filter(Boolean)
                return {
                    ...item,
                    imageItems: nextImageItems,
                    images: nextImages,
                    image: nextImages[0] || "",
                }
            })
        )
    }

    const openMediaPicker = (target: MediaPickerTarget) => {
        setMediaPickerTarget(target)
        setMediaPickerOpen(true)
    }

    const handleMediaSelect = (urls: string[]) => {
        if (!mediaPickerTarget || urls.length === 0) return
        if (mediaPickerTarget.type === "featured") {
            form.setValue("featuredImage", urls[0], { shouldDirty: true, shouldValidate: true })
            toast.success("Featured image selected from media")
            return
        }
        appendSectionImages(mediaPickerTarget.sectionId, urls)
        toast.success(
            urls.length > 1
                ? `${urls.length} section images selected from media`
                : "Section image selected from media"
        )
    }

    const onSubmit = async (data: PageFormValues) => {
        setLoading(true)
        try {
            const url = initialData ? `/api/admin/pages/${initialData.id}` : `/api/admin/pages`
            const method = initialData ? "PATCH" : "POST"

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...data,
                    content: composePageContent(data.content || "", {
                        sections: sections.map((item) => ({
                            id: item.id,
                            enabled: item.status === "active",
                            type: item.type,
                            layout: item.layout,
                            title: item.title.trim(),
                            mediaType: item.mediaType,
                            description: item.description.trim(),
                            image: (item.imageItems[0]?.url || item.image || "").trim(),
                            images: item.imageItems.map((img) => img.url.trim()).filter(Boolean),
                            imageItems: item.imageItems.map((img) => ({
                                url: img.url.trim(),
                                title: img.title.trim(),
                            })).filter((img) => img.url.length > 0),
                            videoUrl: item.videoUrl.trim(),
                        })),
                        youtubeUrl: youtubeUrl.trim(),
                    }),
                }),
            })

            const responseData = await res.json()

            if (!res.ok) {
                if (res.status === 409 || responseData.error === "Slug already exists") {
                    form.setError("slug", { message: "This URL is already taken" })
                    toast.error("URL conflict: Please choose a unique slug")
                    return
                }

                toast.error(responseData.error || "Failed to save page")
                return
            }

            toast.success(initialData ? "Page updated" : "Page created")
            router.push("/dashboard/pages")
            router.refresh()
        } catch {
            toast.error("An unexpected error occurred")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                            {initialData ? "Edit Page" : "Add New Page"}
                        </h2>
                        <p className="text-sm text-slate-600">
                            {initialData ? `Editing: ${initialData.title}` : "Create a new content page"}
                        </p>
                    </div>
                </div>
                {initialData && initialData.status === "PUBLISHED" && (
                    <Button
                        variant="default"
                        className="text-primary-foreground hover:text-primary-foreground [&>svg]:text-primary-foreground"
                        type="button"
                        onClick={() => {
                            if (typeof window !== "undefined") {
                                window.open(`/info/${initialData.slug}`, "_blank", "noopener,noreferrer")
                            }
                        }}
                    >
                        <ExternalLink className="h-4 w-4 mr-2" /> View Page
                    </Button>
                )}
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <Card className={cardSurface}>
                            <CardContent className="p-6 space-y-4">
                                <FormField
                                    control={form.control}
                                    name="title"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Input
                                                    placeholder="Add title"
                                                    className="h-14 text-3xl font-semibold border-[#dce3ed] bg-white"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="rounded-md border border-[#dce3ed] bg-slate-50 px-3 py-2 text-sm flex flex-wrap items-center gap-2">
                                    <span className="text-slate-600 font-medium">Permalink:</span>
                                    <span className="text-slate-800">{siteOrigin ? `${siteOrigin}/info/${slugValue}` : `/info/${slugValue}`}</span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsEditingSlug((prev) => !prev)}
                                    >
                                        <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                                    </Button>
                                </div>

                                {isEditingSlug && (
                                    <FormField
                                        control={form.control}
                                        name="slug"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Slug</FormLabel>
                                                <FormControl>
                                                    <Input className={inputSurface} {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}

                                <FormField
                                    control={form.control}
                                    name="content"
                                    render={({ field }) => (
                                        <FormItem className="hidden">
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>

                        <Card className={cardSurface}>
                            <CardHeader className="pb-3 space-y-3">
                                <CardTitle className="text-slate-900">Page Sections Layout</CardTitle>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button type="button" variant="outline" onClick={() => createSection("content")}>
                                        Section
                                    </Button>
                                    <Button type="button" variant="outline" onClick={() => createSection("image")}>
                                        Add Image
                                    </Button>
                                    <Button type="button" variant="outline" onClick={() => createSection("title")}>
                                        Title
                                    </Button>
                                    <Button type="button" variant="outline" onClick={() => createSection("description")}>
                                        Description
                                    </Button>
                                </div>
                                <p className="text-xs text-slate-600">
                                    Add multiple blocks. Choose layout order and status for each block.
                                </p>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {sections.map((section, index) => (
                                    <div key={section.id} className="relative rounded-lg border border-[#dce3ed] bg-slate-50/60 p-4 pt-12 space-y-4">
                                        <div className="absolute left-3 top-3 inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-900 px-2 text-xs font-semibold text-white">
                                            {index + 1}
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-sm font-semibold text-slate-900">Section {index + 1}</p>
                                            <div className="flex items-center gap-2">
                                                <Select
                                                    value={section.status}
                                                    onValueChange={(value: SectionStatus) => updateSection(section.id, { status: value })}
                                                >
                                                    <SelectTrigger className={`${inputSurface} w-[140px] h-9`}>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="active">Active</SelectItem>
                                                        <SelectItem value="inactive">Inactive</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => removeSection(section.id)}
                                                    title="Remove section"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <FormLabel>Order</FormLabel>
                                            <Input
                                                type="number"
                                                min={1}
                                                max={sections.length}
                                                defaultValue={index + 1}
                                                className={inputSurface}
                                                onBlur={(e) => {
                                                    const nextValue = Number(e.target.value)
                                                    if (!Number.isFinite(nextValue)) {
                                                        e.target.value = String(index + 1)
                                                        return
                                                    }
                                                    moveSectionToPosition(section.id, Math.trunc(nextValue))
                                                }}
                                            />
                                        </div>

                                        {section.type === "title" ? (
                                            <div className="space-y-2">
                                                <FormLabel>Title</FormLabel>
                                                <Input
                                                    className={inputSurface}
                                                    placeholder="Write section title..."
                                                    value={section.title}
                                                    onChange={(e) => updateSection(section.id, { title: e.target.value })}
                                                />
                                            </div>
                                        ) : null}

                                        {section.type === "description" ? (
                                            <div className="space-y-2">
                                                <FormLabel>Description</FormLabel>
                                                <Textarea
                                                    className="min-h-[120px] bg-white border-[#dce3ed] text-slate-900 placeholder:text-slate-400"
                                                    placeholder="Write description..."
                                                    value={section.description}
                                                    onChange={(e) => updateSection(section.id, { description: e.target.value })}
                                                />
                                            </div>
                                        ) : null}

                                        {section.type === "image" ? (
                                            <>
                                                <div className="space-y-2">
                                                    <FormLabel>Section Images</FormLabel>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            className="w-full min-w-0"
                                                            onClick={() => openMediaPicker({ type: "section", sectionId: section.id })}
                                                        >
                                                            <ImagePlus className="h-4 w-4 mr-2" />
                                                            Add
                                                        </Button>
                                                        {section.imageItems.length > 0 && (
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                className="w-full min-w-0"
                                                                onClick={() => updateSection(section.id, { image: "", images: [], imageItems: [] })}
                                                            >
                                                                Remove
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                                {section.imageItems.length > 0 ? (
                                                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                                                        {section.imageItems.map((img, imgIndex) => (
                                                            <div key={`${img.url}-${imgIndex}`} className="relative overflow-hidden rounded-md border border-[#dce3ed] bg-white p-2">
                                                                <img src={img.url} alt={`Section ${index + 1}`} className="h-24 w-full rounded object-cover" />
                                                                <Input
                                                                    className="mt-2 h-8 text-xs"
                                                                    placeholder="Title (optional)"
                                                                    value={img.title}
                                                                    onChange={(e) => updateSectionImageItem(section.id, imgIndex, { title: e.target.value })}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeSectionImageAt(section.id, imgIndex)}
                                                                    className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
                                                                    aria-label="Remove section image"
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : null}
                                            </>
                                        ) : null}

                                        {section.type === "content" ? (
                                            <>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <FormLabel>Layout</FormLabel>
                                                        <Select
                                                            value={section.layout}
                                                            onValueChange={(value: SectionLayoutOrder) => updateSection(section.id, { layout: value })}
                                                        >
                                                            <SelectTrigger className={inputSurface}>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="description-image">Description | Image</SelectItem>
                                                                <SelectItem value="image-description">Image | Description</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <FormLabel>Media Type</FormLabel>
                                                        <Select
                                                            value={section.mediaType}
                                                            onValueChange={(value: "image" | "video") => updateSection(section.id, { mediaType: value })}
                                                        >
                                                            <SelectTrigger className={inputSurface}>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="image">Image</SelectItem>
                                                                <SelectItem value="video">Video Description</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>

                                                {section.mediaType === "image" ? (
                                                    <>
                                                        <div className="space-y-2">
                                                            <FormLabel>Section Images</FormLabel>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    className="w-full min-w-0"
                                                                    onClick={() => openMediaPicker({ type: "section", sectionId: section.id })}
                                                                >
                                                                    <ImagePlus className="h-4 w-4 mr-2" />
                                                                    Add
                                                                </Button>
                                                                {section.imageItems.length > 0 && (
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        className="w-full min-w-0"
                                                                        onClick={() => updateSection(section.id, { image: "", images: [], imageItems: [] })}
                                                                    >
                                                                        Remove
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {section.imageItems.length > 0 && (
                                                            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                                                                {section.imageItems.map((img, imgIndex) => (
                                                                    <div key={`${img.url}-${imgIndex}`} className="relative overflow-hidden rounded-md border border-[#dce3ed] bg-white p-2">
                                                                        <img src={img.url} alt={`Section ${index + 1}`} className="h-24 w-full rounded object-cover" />
                                                                        <Input
                                                                            className="mt-2 h-8 text-xs"
                                                                            placeholder="Title (optional)"
                                                                            value={img.title}
                                                                            onChange={(e) => updateSectionImageItem(section.id, imgIndex, { title: e.target.value })}
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => removeSectionImageAt(section.id, imgIndex)}
                                                                            className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
                                                                            aria-label="Remove section image"
                                                                        >
                                                                            <Trash2 className="h-3 w-3" />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <div className="space-y-2">
                                                        <FormLabel>Video Link (YouTube)</FormLabel>
                                                        <Input
                                                            className={inputSurface}
                                                            placeholder="https://www.youtube.com/watch?v=..."
                                                            value={section.videoUrl}
                                                            onChange={(e) => updateSection(section.id, { videoUrl: e.target.value })}
                                                        />
                                                        <div className="overflow-hidden rounded-md border border-[#dce3ed] bg-slate-50">
                                                            {buildYouTubeEmbedUrl(section.videoUrl) ? (
                                                                <div className="aspect-video w-full">
                                                                    <iframe
                                                                        src={buildYouTubeEmbedUrl(section.videoUrl) || ""}
                                                                        title={`Section ${index + 1} video preview`}
                                                                        className="h-full w-full"
                                                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                                                        allowFullScreen
                                                                        loading="lazy"
                                                                        referrerPolicy="strict-origin-when-cross-origin"
                                                                        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <div className="flex h-[160px] items-center justify-center px-4 text-center text-sm text-slate-500">
                                                                    Paste a valid YouTube link to show video instead of image.
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="space-y-2">
                                                    <FormLabel>Description</FormLabel>
                                                    <Textarea
                                                        className="min-h-[120px] bg-white border-[#dce3ed] text-slate-900 placeholder:text-slate-400"
                                                        placeholder="Write section description..."
                                                        value={section.description}
                                                        onChange={(e) => updateSection(section.id, { description: e.target.value })}
                                                    />
                                                </div>
                                            </>
                                        ) : null}
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                    </div>

                    <div className="space-y-6">
                        <Card className={cardSurface}>
                            <CardHeader>
                                <CardTitle className="text-slate-900">Publish</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="status"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Status</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className={inputSurface}>
                                                        <SelectValue placeholder="Select status" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {PAGE_STATUSES.map((status) => (
                                                        <SelectItem key={status.value} value={status.value}>
                                                            {status.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormDescription className="text-xs text-slate-600">
                                                Published pages are visible on the frontend.
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <Button type="submit" disabled={loading} className="w-full">
                                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {initialData ? "Update Page" : "Save Page"}
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className={cardSurface}>
                            <CardHeader>
                                <CardTitle className="text-slate-900">Featured Image</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {featuredImageValue ? (
                                    <div className="space-y-3">
                                        <div className="rounded-md overflow-hidden border border-[#dce3ed] bg-slate-50">
                                            <img src={featuredImageValue} alt={titleValue || "Featured"} className="w-full h-44 object-cover" />
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="w-full min-w-0"
                                                onClick={() => openMediaPicker({ type: "featured" })}
                                            >
                                                <ImagePlus className="h-4 w-4 mr-2" />
                                                Add
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="w-full min-w-0"
                                                onClick={() => form.setValue("featuredImage", "", { shouldDirty: true, shouldValidate: true })}
                                            >
                                                <Trash2 className="h-4 w-4 mr-2" /> Remove
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full min-w-0"
                                        onClick={() => openMediaPicker({ type: "featured" })}
                                    >
                                        <ImagePlus className="h-4 w-4 mr-2" />
                                        Add
                                    </Button>
                                )}

                                <FormField
                                    control={form.control}
                                    name="featuredImage"
                                    render={({ field }) => (
                                        <FormItem className="hidden">
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>

                        <Card className={cardSurface}>
                            <CardHeader>
                                <CardTitle className="text-slate-900">SEO</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="metaTitle"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Meta Title</FormLabel>
                                            <FormControl>
                                                <Input className={inputSurface} placeholder="Optional" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="metaDescription"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Meta Description</FormLabel>
                                            <FormControl>
                                                <Textarea className="h-24 bg-white border-[#dce3ed] text-slate-900 placeholder:text-slate-400" placeholder="Optional" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>

                        <Card className={cardSurface}>
                            <CardHeader>
                                <CardTitle className="text-slate-900">YouTube Video</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="space-y-1.5">
                                    <FormLabel>YouTube Link</FormLabel>
                                    <Input
                                        className={inputSurface}
                                        placeholder="https://www.youtube.com/watch?v=..."
                                        value={youtubeUrl}
                                        onChange={(event) => setYoutubeUrl(event.target.value)}
                                    />
                                </div>
                                <div className="overflow-hidden rounded-md border border-[#dce3ed] bg-slate-50">
                                    {youtubeEmbedPreview ? (
                                        <div className="aspect-video w-full">
                                            <iframe
                                                src={youtubeEmbedPreview}
                                                title="YouTube preview"
                                                className="h-full w-full"
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                                allowFullScreen
                                                loading="lazy"
                                                referrerPolicy="strict-origin-when-cross-origin"
                                                sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex h-[180px] items-center justify-center px-4 text-center text-sm text-slate-500">
                                            Paste a valid YouTube link to preview video here.
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500">
                                    Frontend displays this video under the page image area and plays automatically (muted).
                                </p>
                            </CardContent>
                        </Card>

                        <Card className={cardSurface}>
                            <CardHeader>
                                <CardTitle className="text-slate-900">Google Search Preview</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div className="rounded-md border border-[#dce3ed] bg-white p-4">
                                    <p className="truncate text-[20px] leading-6 text-[#1a0dab]">{googlePreviewTitle}</p>
                                    <p className="mt-1 truncate text-sm text-[#006621]">{googlePreviewUrl}</p>
                                    <p className="mt-1 text-sm leading-5 text-[#4d5156]">{googlePreviewDescription}</p>
                                </div>
                                <p className="text-xs text-slate-500">
                                    Meta Title ve Meta Description alanları bu görünümü belirler.
                                </p>
                            </CardContent>
                        </Card>

                        {initialData && (
                            <div className="text-xs text-slate-500 px-1">
                                <p>Created: {new Date(initialData.createdAt).toLocaleDateString()}</p>
                                <p>Last Updated: {new Date(initialData.updatedAt).toLocaleDateString()}</p>
                            </div>
                        )}
                    </div>
                </form>
            </Form>
            <MediaPickerDialog
                open={mediaPickerOpen}
                onOpenChange={setMediaPickerOpen}
                multiple={mediaPickerTarget?.type === "section"}
                onSelect={handleMediaSelect}
                title={mediaPickerTarget?.type === "featured" ? "Select featured image" : "Select section images"}
            />
        </div>
    )
}
