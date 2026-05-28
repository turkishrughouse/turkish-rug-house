"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
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
import { Loader2, ArrowLeft, ExternalLink, ImagePlus, Trash2, Pencil } from "lucide-react"
import { slugify } from "@/lib/utils"
import { MediaPickerDialog } from "@/components/admin/media/media-picker-dialog"
import type { BlogListItem } from "@/lib/blog-shared"
import { slugifyBlogTitle } from "@/lib/blog"

const BLOG_STATUSES = [
    { value: "DRAFT", label: "Draft" },
    { value: "PUBLISHED", label: "Published" },
] as const

const STATUS_VALUES = BLOG_STATUSES.map((s) => s.value) as [string, ...string[]]

const blogSchema = z.object({
    title: z.string().min(1, "Title is required"),
    slug: z.string().min(1, "Slug is required"),
    excerpt: z.string().optional(),
    content: z.string().optional(),
    featuredImage: z.string().optional(),
    status: z.enum(STATUS_VALUES),
    publishedAt: z.string().optional(),
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
})

type BlogFormValues = z.infer<typeof blogSchema>

interface BlogFormProps {
    initialData?: BlogListItem
}

export function BlogForm({ initialData }: BlogFormProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [siteOrigin, setSiteOrigin] = useState("")
    const [isEditingSlug, setIsEditingSlug] = useState(false)
    const [mediaPickerOpen, setMediaPickerOpen] = useState(false)

    const cardSurface = "bg-white border border-[#dce3ed] shadow-[0_8px_24px_rgba(15,23,42,0.05)]"
    const inputSurface = "bg-white border-[#dce3ed] text-slate-900 placeholder:text-slate-400"

    const normalizedStatus = initialData?.status ?? "DRAFT"

    const defaultValues: BlogFormValues = {
        title: initialData?.title || "",
        slug: initialData?.slug || "",
        excerpt: initialData?.excerpt || "",
        content: initialData?.content || "",
        featuredImage: initialData?.featuredImage || "",
        status: STATUS_VALUES.includes(normalizedStatus) ? normalizedStatus : "DRAFT",
        publishedAt: initialData?.publishedAt
            ? new Date(initialData.publishedAt).toISOString().slice(0, 16)
            : "",
        metaTitle: initialData?.metaTitle || "",
        metaDescription: initialData?.metaDescription || "",
    }

    const form = useForm<BlogFormValues>({
        resolver: zodResolver(blogSchema),
        defaultValues,
    })

    useEffect(() => {
        setSiteOrigin(window.location.origin)
    }, [])

    useEffect(() => {
        if (initialData) return
        const subscription = form.watch((value, { name }) => {
            if (name === "title" && value.title && !isEditingSlug) {
                form.setValue("slug", slugifyBlogTitle(value.title), { shouldValidate: true })
            }
        })
        return () => subscription.unsubscribe()
    }, [form, initialData, isEditingSlug])

    const titleValue = form.watch("title") || ""
    const slugValue = form.watch("slug") || ""
    const featuredImageValue = form.watch("featuredImage") || ""
    const metaTitleValue = form.watch("metaTitle") || ""
    const metaDescriptionValue = form.watch("metaDescription") || ""
    const excerptValue = form.watch("excerpt") || ""

    const googlePreviewTitle = (metaTitleValue || titleValue || "Untitled post").trim().slice(0, 60)
    const googlePreviewDescription = (metaDescriptionValue || excerptValue || "Blog post description").trim().slice(0, 160)
    const googlePreviewUrl = `${siteOrigin || "https://turkishrughouse.com"}/blog/${slugValue || "post-slug"}`

    const onSubmit = async (data: BlogFormValues) => {
        setLoading(true)
        try {
            const url = initialData ? `/api/admin/blog/${initialData.id}` : `/api/admin/blog`
            const method = initialData ? "PATCH" : "POST"

            const body: Record<string, unknown> = {
                title: data.title,
                slug: data.slug,
                excerpt: data.excerpt || null,
                content: data.content || null,
                featuredImage: data.featuredImage || null,
                status: data.status,
                publishedAt: data.status === "PUBLISHED" && data.publishedAt
                    ? new Date(data.publishedAt).toISOString()
                    : null,
                metaTitle: data.metaTitle || null,
                metaDescription: data.metaDescription || null,
            }

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            })

            const responseData = await res.json()

            if (!res.ok) {
                if (res.status === 409 || responseData.error === "Slug already exists") {
                    form.setError("slug", { message: "This URL is already taken" })
                    toast.error("URL conflict: Please choose a unique slug")
                    return
                }
                toast.error(responseData.error || "Failed to save post")
                return
            }

            toast.success(initialData ? "Post updated" : "Post created")
            router.push("/dashboard/blog")
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
                            {initialData ? "Edit Post" : "New Post"}
                        </h2>
                        <p className="text-sm text-slate-600">
                            {initialData ? `Editing: ${initialData.title}` : "Create a new blog post"}
                        </p>
                    </div>
                </div>
                {initialData?.status === "PUBLISHED" && (
                    <Button
                        variant="default"
                        type="button"
                        onClick={() => window.open(`/blog/${initialData.slug}`, "_blank", "noopener,noreferrer")}
                    >
                        <ExternalLink className="h-4 w-4 mr-2" /> View Post
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
                                    <span className="text-slate-800">{siteOrigin ? `${siteOrigin}/blog/${slugValue}` : `/blog/${slugValue}`}</span>
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
                                    name="excerpt"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Excerpt</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    className="min-h-[80px] bg-white border-[#dce3ed] text-slate-900 placeholder:text-slate-400"
                                                    placeholder="Short summary shown in listing pages..."
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="content"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Content</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    className="min-h-[320px] bg-white border-[#dce3ed] text-slate-900 placeholder:text-slate-400"
                                                    placeholder="Write post content..."
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
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
                                                    {BLOG_STATUSES.map((s) => (
                                                        <SelectItem key={s.value} value={s.value}>
                                                            {s.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormDescription className="text-xs text-slate-600">
                                                Published posts are visible on the storefront.
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="publishedAt"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Publish Date</FormLabel>
                                            <FormControl>
                                                <Input type="datetime-local" className={inputSurface} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <Button type="submit" disabled={loading} className="w-full">
                                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {initialData ? "Update Post" : "Save Post"}
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
                                                onClick={() => setMediaPickerOpen(true)}
                                            >
                                                <ImagePlus className="h-4 w-4 mr-2" /> Change
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="w-full min-w-0"
                                                onClick={() => form.setValue("featuredImage", "", { shouldDirty: true })}
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
                                        onClick={() => setMediaPickerOpen(true)}
                                    >
                                        <ImagePlus className="h-4 w-4 mr-2" /> Add Image
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
                                                <Textarea
                                                    className="h-24 bg-white border-[#dce3ed] text-slate-900 placeholder:text-slate-400"
                                                    placeholder="Optional"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
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
                multiple={false}
                onSelect={(urls) => {
                    if (urls[0]) {
                        form.setValue("featuredImage", urls[0], { shouldDirty: true })
                        toast.success("Featured image selected")
                    }
                }}
                title="Select featured image"
            />
        </div>
    )
}
