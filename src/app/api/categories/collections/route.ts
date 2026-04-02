import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { buildCategoryPathMap } from "@/lib/category-paths"

const COLLECTION_BRANCH_SLUGS = [
    "shop-by-type",
    "shop-by-region",
    "area-rugs",
    "patchwork-recycled",
] as const

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
        void request

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
        const collectionsParents = COLLECTION_BRANCH_SLUGS
            .map((slug) => rows.find((row) => row.slug === slug) || null)
            .filter((row): row is CategoryRow => Boolean(row))

        const groupedChildren = collectionsParents.flatMap((parent) =>
            rows
                .filter((row) => row.parentId === parent.id)
                .sort((a, b) => {
                    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
                    return a.title.localeCompare(b.title)
                })
        )

        const resolvedSource = "virtual_collections_branches"
        const children = groupedChildren
            .slice(0, 15)
            .map((row) => ({
                id: row.id,
                title: row.title,
                slug: row.slug,
                path: pathById.get(row.id) || `/${row.slug}`,
                image: row.image,
            }))

        console.info(`[Collections Mega Menu] source=${resolvedSource}`, {
            parents: collectionsParents.map((parent) => ({
                id: parent.id,
                slug: parent.slug,
                title: parent.title,
            })),
            totalDirectChildren: groupedChildren.length,
            first15Children: children.map((child) => ({ id: child.id, title: child.title })),
        })

        return NextResponse.json({
            source: resolvedSource,
            parentFound: collectionsParents.length > 0,
            childCount: groupedChildren.length,
            parent: null,
            parents: collectionsParents.map((parent) => ({
                id: parent.id,
                title: parent.title,
                slug: parent.slug,
            })),
            children,
        })
    } catch (error) {
        console.error("GET Collections Categories Error:", error)
        return NextResponse.json({ error: "Failed to fetch collection categories" }, { status: 500 })
    }
}
