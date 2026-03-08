"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

const createPageSchema = z.object({
    title: z.string().min(1, "Title is required"),
    slug: z.string().min(1, "Slug is required"),
    status: z.enum(["DRAFT", "PUBLISHED"]),
})

type CreatePageFormValues = z.infer<typeof createPageSchema>

interface CreatePageModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: (page: any) => void
}

export function CreatePageModal({ open, onOpenChange, onSuccess }: CreatePageModalProps) {
    const [loading, setLoading] = useState(false)

    const form = useForm<CreatePageFormValues>({
        resolver: zodResolver(createPageSchema),
        defaultValues: {
            title: "",
            slug: "",
            status: "DRAFT",
        },
    })

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const title = e.target.value
        form.setValue("title", title)

        // Auto-generate slug from title if slug is empty or matches previous auto-generated slug
        const currentSlug = form.getValues("slug")
        const slugified = title
            .toLowerCase()
            .replace(/ /g, "-")
            .replace(/[^\w-]+/g, "")

        if (!currentSlug || currentSlug === form.getValues("title").toLowerCase().replace(/ /g, "-").replace(/[^\w-]+/g, "")) {
            form.setValue("slug", slugified)
        } else if (currentSlug && form.formState.touchedFields.slug === undefined) {
            // If user hasn't manually touched slug, keep updating it
            form.setValue("slug", slugified)
        }
    }

    const onSubmit = async (data: CreatePageFormValues) => {
        setLoading(true)
        try {
            const res = await fetch("/api/admin/pages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })

            const json = await res.json()

            if (!res.ok) {
                if (res.status === 400 && json.error?.includes("Slug")) {
                    form.setError("slug", { message: json.error })
                    return
                }
                toast.error(json.error || "Failed to create page")
                return
            }

            toast.success("Page created successfully")
            onSuccess(json)
            onOpenChange(false)
            form.reset()
        } catch (error) {
            console.error(error)
            toast.error("Something went wrong")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create new page</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Title</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="Page title"
                                            {...field}
                                            onChange={(e) => {
                                                field.onChange(e)
                                                // Simple slugify for improved UX
                                                const slug = e.target.value.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '')
                                                form.setValue('slug', slug)
                                            }}
                                        />
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
                                        <Input placeholder="page-slug" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Status</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select status" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="DRAFT">Draft</SelectItem>
                                            <SelectItem value="PUBLISHED">Active</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? "Creating..." : "Create"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
