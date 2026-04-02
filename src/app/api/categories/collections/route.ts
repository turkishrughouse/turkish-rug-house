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

export async function GET(request: Request) {
    try {
        const searchParams = new URL(request.url).searchParams
        const requestedCategoryId = searchParams.get("categoryId")?.trim() || null

        const collectionsParent = requestedCategoryId
            ? await prisma.category.findUnique({
                where: { id: requestedCategoryId },
                select: {
                    id: true,
                    title: true,
                    slug: true,
                },
            })
            : await prisma.category.findUnique({
                where: { slug: "collections" },
                select: {
                    id: true,
                    title: true,
                    slug: true,
                },
            })
        const canonicalCollectionsParent =
            collectionsParent ||
            await prisma.category.findUnique({
                where: { slug: "collections" },
                select: {
                    id: true,
                    title: true,
                    slug: true,
                },
            })

        if (!canonicalCollectionsParent) {
            return NextResponse.json({
                parentFound: false,
                childCount: 0,
                children: [],
            })
        }

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
        const { pathById } = buildCategoryPathMap(rows)
        const children = rows
            .filter((row) => row.parentId === canonicalCollectionsParent.id)
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
            parentFound: true,
            childCount: children.length,
            parent: {
                id: canonicalCollectionsParent.id,
                title: canonicalCollectionsParent.title,
                slug: canonicalCollectionsParent.slug,
            },
            children,
        })
    } catch (error) {
        console.error("GET Collections Categories Error:", error)
        return NextResponse.json({ error: "Failed to fetch collection categories" }, { status: 500 })
    }
}
