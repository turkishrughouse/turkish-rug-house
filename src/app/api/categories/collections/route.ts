import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { buildCategoryPathMap } from "@/lib/category-paths"

type CategoryRow = {
    id: string
    title: string
    slug: string
    sortOrder: number
    image: string | null
    parentId: string | null
}

function normalizeToken(value: string | null | undefined) {
    return (value || "")
        .trim()
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]+/g, "")
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const requestedCategoryId = searchParams.get("categoryId")
        const requestedSlug = searchParams.get("slug") || "collections"

        const categories = await prisma.category.findMany({
            select: {
                id: true,
                title: true,
                slug: true,
                sortOrder: true,
                image: true,
                parentId: true,
            },
            orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
        })

        const rows = categories as CategoryRow[]
        const parentCategory =
            rows.find((row) => requestedCategoryId && row.id === requestedCategoryId) ||
            rows.find((row) => normalizeToken(row.slug) === normalizeToken(requestedSlug))

        if (!parentCategory) {
            return NextResponse.json({ children: [] })
        }

        const { pathById } = buildCategoryPathMap(rows)
        const children = rows
            .filter((row) => row.parentId === parentCategory.id)
            .sort((a, b) => {
                if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
                return a.title.localeCompare(b.title)
            })
            .slice(0, 15)
            .map((row) => ({
                id: row.id,
                title: row.title,
                slug: row.slug,
                path: pathById.get(row.id) || `/${row.slug}`,
                image: row.image,
            }))

        return NextResponse.json({
            parent: {
                id: parentCategory.id,
                title: parentCategory.title,
                slug: parentCategory.slug,
            },
            children,
        })
    } catch (error) {
        console.error("GET Collections Categories Error:", error)
        return NextResponse.json({ error: "Failed to fetch collection categories" }, { status: 500 })
    }
}
