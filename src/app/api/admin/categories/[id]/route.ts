
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { z } from "zod"

const categoryUpdateSchema = z.object({
    title: z.string().min(1, "Title is required").optional(),
    slug: z.string().min(1, "Slug is required")
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug format").optional(),
    parentId: z.string().optional().nullable(),
    description: z.string().optional(),
    image: z.string().optional(),
})

// GET /api/admin/categories/[id]
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const category = await prisma.category.findUnique({
            where: { id },
            include: { parent: true }
        })

        if (!category) {
            return NextResponse.json({ error: "Category not found" }, { status: 404 })
        }

        return NextResponse.json(category)
    } catch (error) {
        console.error(`GET /api/admin/categories/${await params.then(p => p.id)} ERROR:`, error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

// PATCH /api/admin/categories/[id]
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()
        const result = categoryUpdateSchema.safeParse(body)

        if (!result.success) {
            return NextResponse.json(
                { error: "Invalid data", details: result.error.flatten().fieldErrors },
                { status: 400 }
            )
        }

        const data = result.data

        // 1. Prevent Self-Parenting
        if (data.parentId && data.parentId === id) {
            return NextResponse.json(
                { error: "Category cannot be its own parent" },
                { status: 400 }
            )
        }

        // 2. Slug Uniqueness Check (Exclude Self)
        if (data.slug) {
            let uniqueSlug = data.slug
            let counter = 2

            while (true) {
                const existing = await prisma.category.findUnique({
                    where: { slug: uniqueSlug }
                })

                // If no collision OR collision is self -> Safe
                if (!existing || existing.id === id) {
                    break
                }

                uniqueSlug = `${data.slug}-${counter}`
                counter++
            }
            data.slug = uniqueSlug
        }

        // 3. Update
        const category = await prisma.category.update({
            where: { id },
            data: {
                title: data.title,
                slug: data.slug,
                description: data.description,
                parentId: data.parentId === "" ? null : data.parentId,
                image: data.image
            }
        })

        console.log(`[ADMIN] Category Updated: ${category.id}`)
        return NextResponse.json(category)

    } catch (error) {
        console.error("PATCH /api/admin/categories/[id] ERROR:", error)
        return NextResponse.json(
            { error: "Failed to update category", details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        )
    }
}

// DELETE /api/admin/categories/[id]
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        // 1. Check existence
        const category = await prisma.category.findUnique({
            where: { id },
            include: { children: true }
        })

        if (!category) {
            return NextResponse.json({ error: "Category not found" }, { status: 404 })
        }

        // 2. Handle Children (Move to Root)
        if (category.children.length > 0) {
            await prisma.category.updateMany({
                where: { parentId: id },
                data: { parentId: null }
            })
        }

        // 3. Delete
        await prisma.category.delete({
            where: { id }
        })

        console.log(`[ADMIN] Category Deleted: ${id}`)
        return NextResponse.json({ success: true })

    } catch (error) {
        console.error("DELETE /api/admin/categories/[id] ERROR:", error)
        return NextResponse.json(
            { error: "Failed to delete category" },
            { status: 500 }
        )
    }
}
