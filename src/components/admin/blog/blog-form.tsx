"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, ExternalLink, ImagePlus, Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Form,
  FormControl,
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
import { slugify } from "@/lib/utils"
import { MediaPickerDialog } from "@/components/admin/media/media-picker-dialog"
import type { BlogListItem } from "@/lib/blog"

const blogSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required"),
  excerpt: z.string().optional(),
  content: z.string().optional(),
  featuredImage: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  publishedAt: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
})

type BlogFormValues = z.infer<typeof blogSchema>

function formatDatetimeLocal(value: Date | null | undefined) {
  if (!value) return ""
  const date = new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

export function BlogForm({ initialData }: { initialData?: BlogListItem }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [isEditingSlug, setIsEditingSlug] = useState(false)
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false)

  const form = useForm<BlogFormValues>({
    resolver: zodResolver(blogSchema),
    defaultValues: {
      title: initialData?.title || "",
      slug: initialData?.slug || "",
      excerpt: initialData?.excerpt || "",
      content: initialData?.content || "",
      featuredImage: initialData?.featuredImage || "",
      status: initialData?.status || "DRAFT",
      publishedAt: formatDatetimeLocal(initialData?.publishedAt),
      metaTitle: initialData?.metaTitle || "",
      metaDescription: initialData?.metaDescription || "",
    },
  })

  useEffect(() => {
    if (initialData) return
    const subscription = form.watch((value, { name }) => {
      if (name === "title" && value.title && !isEditingSlug) {
        form.setValue("slug", slugify(value.title), { shouldValidate: true })
      }
    })
    return () => subscription.unsubscribe()
  }, [form, initialData, isEditingSlug])

  const titleValue = form.watch("title") || ""
  const slugValue = form.watch("slug") || ""
  const excerptValue = form.watch("excerpt") || ""
  const featuredImageValue = form.watch("featuredImage") || ""
  const statusValue = form.watch("status")

  const publicUrl = useMemo(() => {
    if (!slugValue || statusValue !== "PUBLISHED") return null
    return `/blog/${slugValue}`
  }, [slugValue, statusValue])

  async function onSubmit(values: BlogFormValues) {
    setLoading(true)
    try {
      const payload = {
        ...values,
        featuredImage: values.featuredImage || null,
        excerpt: values.excerpt || null,
        content: values.content || null,
        metaTitle: values.metaTitle || null,
        metaDescription: values.metaDescription || null,
        publishedAt: values.publishedAt ? new Date(values.publishedAt).toISOString() : null,
      }

      const url = initialData ? `/api/admin/blog/${initialData.id}` : "/api/admin/blog"
      const method = initialData ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = (await res.json().catch(() => null)) as { error?: string; id?: string } | null
      if (!res.ok) throw new Error(json?.error || "Failed to save article")

      toast.success(initialData ? "Article updated" : "Article created")
      router.push(initialData ? "/dashboard/blog" : `/dashboard/blog/${json?.id || ""}`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save article")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {initialData ? "Edit Blog Post" : "New Blog Post"}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Create editorial stories for the journal and homepage article section.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/blog">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Blog
            </Link>
          </Button>
          {publicUrl ? (
            <Button variant="outline" asChild>
              <Link href={publicUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                View Article
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <Form {...form}>
        <form className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-6">
            <Card className="border-[#dce3ed] shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
              <CardHeader>
                <CardTitle>Article Content</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input {...field} className="border-[#dce3ed]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Slug</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          onFocus={() => setIsEditingSlug(true)}
                          className="border-[#dce3ed]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="excerpt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Excerpt / Intro</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={4} className="border-[#dce3ed]" />
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
                          {...field}
                          rows={18}
                          className="min-h-[420px] border-[#dce3ed] font-mono text-sm"
                        />
                      </FormControl>
                      <p className="text-xs text-slate-500">
                        HTML is supported. Keep content editorial and readable on the storefront.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card className="border-[#dce3ed] shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
              <CardHeader>
                <CardTitle>SEO</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <FormField
                  control={form.control}
                  name="metaTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SEO Title</FormLabel>
                      <FormControl>
                        <Input {...field} className="border-[#dce3ed]" />
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
                      <FormLabel>SEO Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={4} className="border-[#dce3ed]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-[#dce3ed] shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
              <CardHeader>
                <CardTitle>Publishing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="border-[#dce3ed]">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="DRAFT">Draft</SelectItem>
                          <SelectItem value="PUBLISHED">Published</SelectItem>
                        </SelectContent>
                      </Select>
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
                        <Input {...field} type="datetime-local" className="border-[#dce3ed]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card className="border-[#dce3ed] shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
              <CardHeader>
                <CardTitle>Cover Image</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="featuredImage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Image URL</FormLabel>
                      <FormControl>
                        <Input {...field} className="border-[#dce3ed]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => setMediaPickerOpen(true)}>
                    <ImagePlus className="mr-2 h-4 w-4" />
                    Select from Media
                  </Button>
                  {featuredImageValue ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => form.setValue("featuredImage", "", { shouldDirty: true })}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove
                    </Button>
                  ) : null}
                </div>

                <div className="overflow-hidden rounded-2xl border border-[#dce3ed] bg-slate-50">
                  {featuredImageValue ? (
                    <Image
                      src={featuredImageValue}
                      alt={titleValue || "Blog cover"}
                      width={800}
                      height={560}
                      className="h-auto w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center bg-[radial-gradient(circle_at_top,#ebf1e8,transparent_60%),linear-gradient(135deg,#f8fafc,#eef2f7)] px-6 text-center text-sm text-slate-500">
                      Select a cover image to give the journal card and article hero a premium editorial feel.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#dce3ed] shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
              <CardHeader>
                <CardTitle>Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#0f766e]">
                  {statusValue === "PUBLISHED" ? "Published Article" : "Draft Preview"}
                </p>
                <h3 className="font-serif text-[1.9rem] leading-tight text-slate-900">
                  {titleValue || "Your blog title will appear here"}
                </h3>
                <p className="text-sm leading-6 text-slate-600">
                  {excerptValue || "Add a concise editorial intro to support homepage cards and the blog listing."}
                </p>
              </CardContent>
            </Card>

            <Button type="submit" disabled={loading} className="w-full bg-[#0f766e] text-white hover:bg-[#0b5c56]">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : initialData ? "Save Changes" : "Create Article"}
            </Button>
          </div>
        </form>
      </Form>

      <MediaPickerDialog
        open={mediaPickerOpen}
        onOpenChange={setMediaPickerOpen}
        title="Select Blog Cover Image"
        onSelect={(urls) => {
          if (!urls[0]) return
          form.setValue("featuredImage", urls[0], { shouldDirty: true, shouldValidate: true })
          setMediaPickerOpen(false)
        }}
      />
    </div>
  )
}
