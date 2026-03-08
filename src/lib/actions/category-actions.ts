"use server"

import { prisma as db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { ensureCategoryMediaFolders } from "@/lib/media-folders"

export async function getCategories() {
    const categories = await db.category.findMany({
        include: {
            parent: true,
            children: true
        },
        orderBy: { title: 'asc' }
    })
    return categories
}

export async function createCategory(data: { title: string, parentId?: string | null }) {
    if (!data.title) {
        return { success: false, error: "Title is required" }
    }

    // Auto-generate slug
    let slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

    // Ensure uniqueness
    const existing = await db.category.findFirst({ where: { slug } })
    if (existing) {
        slug = `${slug}-${Date.now()}`
    }

    try {
        const category = await db.category.create({
            data: {
                title: data.title,
                slug,
                parentId: data.parentId || null
            }
        })
        await ensureCategoryMediaFolders()
        revalidatePath("/dashboard/products")
        revalidatePath("/dashboard/products/new")
        // Also revalidate wherever the list appears
        return { success: true, category }
    } catch (error) {
        console.error("Create Category Error:", error)
        return { success: false, error: "Failed to create category" }
    }
}
