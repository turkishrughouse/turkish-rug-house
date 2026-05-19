
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { notifyNewCategory } from "@/lib/customer-messaging"
import { ensureCategoryMediaFolders } from "@/lib/media-folders"
import { buildCategoryPathMap } from "@/lib/category-paths"

const categorySchema = z.object({
    title: z.string().min(1, "Title is required"),
    slug: z.string().min(1, "Slug is required"),
    parentId: z.string().optional().nullable(),
    description: z.string().optional(),
})

type FlatCategoryRow = {
    id: string
    slug: string
    title: string
    sortOrder: number
    description: string | null
    image: string | null
    parentId: string | null
    _count: { products: number }
}

type CategoryTreeNode = FlatCategoryRow & { children: CategoryTreeNode[] }

function buildCategoryTree(rows: FlatCategoryRow[]) {
    const { pathById } = buildCategoryPathMap(rows)
    const byParent = new Map<string | null, FlatCategoryRow[]>()

    rows.forEach((row) => {
        const bucket = byParent.get(row.parentId) || []
        bucket.push(row)
        byParent.set(row.parentId, bucket)
    })

    const sortRows = (items: FlatCategoryRow[]) => items.sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
        return a.title.localeCompare(b.title)
    })

    const walk = (parentId: string | null): CategoryTreeNode[] => {
        const directChildren = sortRows([...(byParent.get(parentId) || [])])
        return directChildren.map((row) => ({
            ...row,
            path: pathById.get(row.id) || `/${row.slug}`,
            children: walk(row.id),
        }))
    }

    return walk(null)
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const tree = searchParams.get("tree")

        if (tree === "true") {
            const categories = await prisma.category.findMany({
                where: { isVisible: true },
                select: {
                    id: true,
                    slug: true,
                    title: true,
                    sortOrder: true,
                    description: true,
                    image: true,
                    parentId: true,
                    _count: {
                        select: { products: true },
                    },
                },
                orderBy: [
                    { sortOrder: "asc" },
                    { title: "asc" },
                ],
            })
            return NextResponse.json(buildCategoryTree(categories))
        }

        const categories = await prisma.category.findMany({
            where: { isVisible: true },
            include: {
                parent: true,
                _count: {
                    select: { products: true }
                }
            },
            orderBy: [
                { title: "asc" }
            ]
        })

        return NextResponse.json(categories)

    } catch (error: unknown) {
        console.error("GET Categories CRITICAL FAILURE:", JSON.stringify(error, null, 2))
        return NextResponse.json(
            { error: "Failed to fetch categories", details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        )
    }
}

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

        let uniqueSlug = slug
        let counter = 2

        while (true) {
            const existing = await prisma.category.findUnique({
                where: { slug: uniqueSlug }
            })

            if (!existing) {
                break
            }

            uniqueSlug = `${slug}-${counter}`
            counter++
        }

        slug = uniqueSlug

        const category = await prisma.category.create({
            data: {
                title,
                slug,
                description,
                parentId: parentId || null
            }
        })
        await notifyNewCategory({
            id: category.id,
            title: category.title,
            slug: category.slug,
        })
        await ensureCategoryMediaFolders()

        return NextResponse.json(category, { status: 201 })

    } catch (error) {
        console.error("POST Category Error:", error)
        return NextResponse.json(
            { error: "Failed to create category" },
            { status: 500 }
        )
    }
}
