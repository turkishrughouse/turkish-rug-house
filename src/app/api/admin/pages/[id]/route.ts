
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { revalidatePath } from "next/cache"

const pageUpdateSchema = z.object({
    title: z.string().min(1, "Title is required").optional(),
    slug: z.string().min(1, "Slug is required").optional(),
    content: z.string().optional().nullable(),
    featuredImage: z.string().optional().nullable(),
    status: z.enum(["DRAFT", "PUBLISHED", "TRASH"]).optional(),
    excerpt: z.string().optional().nullable(),
    metaTitle: z.string().optional().nullable(),
    metaDescription: z.string().optional().nullable(),
})

function normalizeOptionalText(value: string | null | undefined) {
    const trimmed = (value ?? "").trim()
    return trimmed.length > 0 ? trimmed : null
}

function revalidatePagePaths(slug: string | null | undefined) {
    const safeSlug = String(slug || "").trim()
    if (!safeSlug) return
    revalidatePath(`/${safeSlug}`)
    revalidatePath(`/info/${safeSlug}`)
}

// GET /api/admin/pages/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const page = await prisma.page.findUnique({
            where: { id }
        })

        if (!page) {
            return NextResponse.json({ error: "Page not found" }, { status: 404 })
        }

        return NextResponse.json(page)
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch page" }, { status: 500 })
    }
}

// PATCH /api/admin/pages/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const body = await req.json()

        // Validation
        const result = pageUpdateSchema.safeParse(body)
        if (!result.success) {
            return NextResponse.json(
                { error: "Invalid data", details: result.error.flatten().fieldErrors },
                { status: 400 }
            )
        }

        const data = result.data
        const before = await prisma.page.findUnique({
            where: { id },
            select: { slug: true },
        })

        // If slug is changing, check uniqueness
        if (data.slug) {
            const existing = await prisma.page.findUnique({
                where: { slug: data.slug }
            })
            if (existing && existing.id !== id) {
                return NextResponse.json({
                    error: "Slug already exists",
                    code: "SLUG_CONFLICT",
                    message: "A page with this slug already exists."
                }, { status: 409 })
            }
        }

        const updatedPage = await prisma.page.update({
            where: { id },
            data: {
                title: data.title === undefined ? undefined : data.title.trim(),
                slug: data.slug === undefined ? undefined : data.slug.trim(),
                content: data.content === undefined ? undefined : (data.content ?? null),
                featuredImage: data.featuredImage === undefined ? undefined : normalizeOptionalText(data.featuredImage),
                status: data.status,
                excerpt: data.excerpt === undefined ? undefined : normalizeOptionalText(data.excerpt),
                metaTitle: data.metaTitle === undefined ? undefined : normalizeOptionalText(data.metaTitle),
                metaDescription: data.metaDescription === undefined ? undefined : normalizeOptionalText(data.metaDescription),
            }
        })

        revalidatePagePaths(before?.slug)
        revalidatePagePaths(updatedPage.slug)
        return NextResponse.json(updatedPage)
    } catch (error) {
        console.error("Error updating page:", error)
        return NextResponse.json({ error: "Failed to update page", details: error instanceof Error ? error.message : String(error) }, { status: 500 })
    }
}

// DELETE /api/admin/pages/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const before = await prisma.page.findUnique({
            where: { id },
            select: { slug: true },
        })
        // Hard Delete
        await prisma.page.delete({
            where: { id }
        })

        revalidatePagePaths(before?.slug)
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Error deleting page:", error)
        return NextResponse.json({ error: "Failed to delete page" }, { status: 500 })
    }
}
