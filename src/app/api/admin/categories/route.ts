
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { notifyNewCategory } from "@/lib/customer-messaging"
import { ensureCategoryMediaFolders } from "@/lib/media-folders"
import { parseProductImages } from "@/lib/product-images"

const categorySchema = z.object({
    title: z.string().min(1, "Title is required"),
    slug: z.string().min(1, "Slug is required")
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug format (lowercase, numbers, hyphens)"),
    parentId: z.string().optional().nullable(),
    description: z.string().optional(),
    image: z.string().optional(),
})

function parseFirstImage(images: string | null | undefined) {
    return parseProductImages(images)[0] || null
}

// GET /api/admin/categories
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const tree = searchParams.get("tree")

        // 1. Tree View (for Nested Lists)
        if (tree === "true") {
            const categories = await prisma.category.findMany({
                where: {
                    parentId: null, // Get top level
                },
                include: {
                    children: {
                        include: {
                            _count: {
                                select: { products: true }
                            },
                            // Support 3 levels deep if needed, but for now 2 levels is standard
                            children: {
                                include: {
                                    _count: { select: { products: true } }
                                }
                            }
                        },
                        orderBy: { sortOrder: 'asc' }
                    },
                    _count: {
                        select: { products: true }
                    }
                },
                orderBy: { sortOrder: 'asc' } // Sort by custom order, fallback to title?
            })
            return NextResponse.json(categories)
        }

        // 2. Flat List (Standard)
        const [categories, featuredProducts] = await Promise.all([
            prisma.category.findMany({
                include: {
                    parent: {
                        select: { id: true, title: true }
                    },
                    _count: {
                        select: { products: true }
                    }
                },
                orderBy: { title: 'asc' }
            }),
            prisma.product.findMany({
                where: { isFeatured: true },
                orderBy: { updatedAt: "desc" },
                select: {
                    id: true,
                    title: true,
                    images: true,
                    categories: {
                        select: { id: true }
                    }
                }
            })
        ])

        const previewMap = new Map<string, Array<{ id: string, title: string, image: string | null }>>()
        const featuredCountMap = new Map<string, number>()
        featuredProducts.forEach((product) => {
            const image = parseFirstImage(product.images)
            product.categories.forEach((category) => {
                featuredCountMap.set(category.id, (featuredCountMap.get(category.id) || 0) + 1)
                const list = previewMap.get(category.id) || []
                if (list.length < 3) {
                    list.push({
                        id: product.id,
                        title: product.title,
                        image,
                    })
                }
                previewMap.set(category.id, list)
            })
        })

        return NextResponse.json(
            categories.map((category) => ({
                ...category,
                featuredPreview: previewMap.get(category.id) || [],
                featuredCount: featuredCountMap.get(category.id) || 0,
            }))
        )

    } catch (error: unknown) {
        console.error("GET /api/admin/categories ERROR:", error)
        return NextResponse.json(
            { error: "Failed to fetch categories", details: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        )
    }
}

// POST /api/admin/categories
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const result = categorySchema.safeParse(body)

        if (!result.success) {
            return NextResponse.json(
                { error: "Invalid data", details: result.error.flatten().fieldErrors },
                { status: 400 }
            )
        }

        const { title, parentId, description } = result.data
        let { slug } = result.data

        // --- Slug Collision Handling ---
        let uniqueSlug = slug
        let counter = 2

        while (true) {
            const existing = await prisma.category.findUnique({
                where: { slug: uniqueSlug }
            })

            if (!existing) break

            uniqueSlug = `${slug}-${counter}`
            counter++
        }
        slug = uniqueSlug
        // -------------------------------

        const category = await prisma.category.create({
            data: {
                title,
                slug,
                description,
                parentId: parentId || null,
                image: result.data.image || null
            }
        })
        await notifyNewCategory({
            id: category.id,
            title: category.title,
            slug: category.slug,
        })
        await ensureCategoryMediaFolders()

        console.log(`[ADMIN] Category Created: ${category.title} (${category.slug})`)
        return NextResponse.json(category, { status: 201 })

    } catch (error: unknown) {
        console.error("POST /api/admin/categories ERROR:", error)
        // Handle P2002 if somehow slug slipped through (race condition)
        if (typeof error === "object" && error && "code" in error && (error as { code?: string }).code === 'P2002') {
            return NextResponse.json({ error: "Category already exists" }, { status: 409 })
        }
        return NextResponse.json(
            { error: "Failed to create category" },
            { status: 500 }
        )
    }
}
