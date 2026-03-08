"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
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
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Plus, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Category } from "@prisma/client"

const formSchema = z.object({
    title: z.string().min(2, "Title must be at least 2 characters"),
    parentId: z.string().optional()
})

interface CategoryCreateModalProps {
    existingCategories: Category[]
    onCategoryCreated?: (category: Category) => void
}

export function CategoryCreateModal({ existingCategories, onCategoryCreated }: CategoryCreateModalProps) {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: "",
            parentId: "none" // "none" as sentinel for null
        },
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true)
        try {
            const parentId = values.parentId === "none" ? null : values.parentId
            const slug = values.title
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "")

            const response = await fetch("/api/admin/categories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: values.title,
                    slug,
                    parentId,
                }),
            })
            const result = await response.json().catch(() => null as Category | { error?: string } | null)

            if (response.ok && result && "id" in result) {
                toast.success("Category created successfully")
                setOpen(false)
                form.reset()
                if (onCategoryCreated) {
                    onCategoryCreated(result)
                }
            } else {
                toast.error((result && "error" in result && result.error) || "Failed to create category")
            }
        } catch {
            toast.error("An error occurred")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-teal-600 hover:text-teal-700 hover:bg-teal-50 -ml-2">
                    <Plus className="h-3 w-3 mr-1" /> New Category
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create New Category</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. Vintage Rugs" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="parentId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Parent Category</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a parent (Optional)" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="none">None (Top Level)</SelectItem>
                                            {existingCategories
                                                // Simple filter to avoid selecting itself if we were in edit mode (not applicable here yet)
                                                .map((cat) => (
                                                    <SelectItem key={cat.id} value={cat.id}>
                                                        {cat.title}
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end pt-2">
                            <Button type="submit" disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Category
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
