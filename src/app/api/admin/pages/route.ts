
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { revalidatePath } from "next/cache"

export const dynamic = 'force-dynamic'

// GET /api/admin/pages
// Query Params: page, limit, status, search
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const page = parseInt(searchParams.get("page") || "1")
        const limit = parseInt(searchParams.get("limit") || "10")
        const status = searchParams.get("status") // PUBLISHED, DRAFT, TRASH, or 'ALL'
        const search = searchParams.get("search") || ""

        const skip = (page - 1) * limit

        const where: Prisma.PageWhereInput = {}

        // Status Filter
        if (status && status !== 'ALL') {
            where.status = status
        }

        // Search Filter
        if (search) {
            where.OR = [
                { title: { contains: search } }, // Case insensitive usually in SQLite? No, need explicit mode often? depending on Prisma version/DB. SQLite default is case-insensitive for ASCII.
                { slug: { contains: search } }
            ]
        }

        const [pages, total] = await Promise.all([
            prisma.page.findMany({
                where,
                skip,
                take: limit,
                orderBy: { updatedAt: 'desc' }
            }),
            prisma.page.count({ where })
        ])

        return NextResponse.json({
            data: pages,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        })

    } catch (error) {
        console.error("Error fetching pages:", error)
        return NextResponse.json({ error: "Failed to fetch pages" }, { status: 500 })
    }
}

const pageCreateSchema = z.object({
    title: z.string().min(1, "Title is required"),
    slug: z.string().optional(),
    content: z.string().optional(),
    featuredImage: z.string().optional().nullable(),
    status: z.enum(["DRAFT", "PUBLISHED", "TRASH"]).default("DRAFT"),
    excerpt: z.string().optional(),
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
})

function normalizeOptionalText(value: string | null | undefined) {
    const trimmed = (value ?? "").trim()
    return trimmed.length > 0 ? trimmed : null
}

function revalidatePagePaths(slug: string) {
    const safeSlug = String(slug || "").trim()
    if (!safeSlug) return
    revalidatePath(`/${safeSlug}`)
    revalidatePath(`/info/${safeSlug}`)
}

// POST /api/admin/pages
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()

        const result = pageCreateSchema.safeParse(body)
        if (!result.success) {
            return NextResponse.json(
                { error: "Invalid data", details: result.error.flatten().fieldErrors },
                { status: 400 }
            )
        }

        const data = result.data

        // Generate Slug if missing
        let slug = data.slug
        if (!slug || slug.trim() === "") {
            slug = data.title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '')
        }
        slug = slug.trim()

        // Check uniqueness
        const existingPage = await prisma.page.findUnique({ where: { slug } })
        if (existingPage) {
            return NextResponse.json(
                { error: "Slug already exists. Please choose another." },
                { status: 400 }
            )
        }

        const uniqueSlug = slug

        const newPage = await prisma.page.create({
            data: {
                title: data.title.trim(),
                slug: uniqueSlug,
                content: data.content ?? null,
                featuredImage: normalizeOptionalText(data.featuredImage),
                status: data.status,
                excerpt: normalizeOptionalText(data.excerpt),
                metaTitle: normalizeOptionalText(data.metaTitle),
                metaDescription: normalizeOptionalText(data.metaDescription),
            }
        })

        revalidatePagePaths(newPage.slug)
        return NextResponse.json(newPage, { status: 201 })

    } catch (error) {
        console.error("Error creating page:", error)
        return NextResponse.json({ error: "Failed to create page" }, { status: 500 })
    }
}
