
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { z } from "zod"

const categoryUpdateSchema = z.object({
    title: z.string().min(1, "Title is required").optional(),
    slug: z.string().min(1, "Slug is required").optional(),
    parentId: z.string().optional().nullable(),
    description: z.string().optional(),
})

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> } // Params is a Promise in Next 15+
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

        // Prevent circular reference (parent cannot be self or descendant) - simpler check: self
        if (data.parentId && data.parentId === id) {
            return NextResponse.json(
                { error: "Category cannot be its own parent" },
                { status: 400 }
            )
        }

        // If slug is changing, check uniqueness with auto-suffix
        if (data.slug) {
            let uniqueSlug = data.slug
            let counter = 2

            while (true) {
                const existing = await prisma.category.findUnique({
                    where: { slug: uniqueSlug }
                })

                // If not exists OR exists but is self, we are good
                if (!existing || existing.id === id) {
                    break
                }

                uniqueSlug = `${data.slug}-${counter}`
                counter++
            }
            data.slug = uniqueSlug
        }

        const category = await prisma.category.update({
            where: { id },
            data: {
                title: data.title,
                slug: data.slug,
                description: data.description,
                parentId: data.parentId === "" ? null : data.parentId
            }
        })

        return NextResponse.json(category)

    } catch (error) {
        console.error("PUT Category Error:", error)
        return NextResponse.json(
            { error: "Failed to update category" },
            { status: 500 }
        )
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        // Check if exists
        const category = await prisma.category.findUnique({
            where: { id },
            include: { children: true }
        })

        if (!category) {
            return NextResponse.json(
                { error: "Category not found" },
                { status: 404 }
            )
        }

        // WordPress Style: If parent is deleted, children move to top level (parentId = null)
        if (category.children.length > 0) {
            await prisma.category.updateMany({
                where: { parentId: id },
                data: { parentId: null }
            })
        }

        await prisma.category.delete({
            where: { id }
        })

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error("DELETE Category Error:", error)
        return NextResponse.json(
            { error: "Failed to delete category" },
            { status: 500 }
        )
    }
}
