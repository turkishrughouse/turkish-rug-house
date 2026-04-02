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

function buildTreeOrder(rows: CategoryRow[]) {
    const byParent = new Map<string | null, CategoryRow[]>()

    for (const row of rows) {
        const bucket = byParent.get(row.parentId) || []
        bucket.push(row)
        byParent.set(row.parentId, bucket)
    }

    const sortNodes = (items: CategoryRow[]) =>
        [...items].sort((a, b) => {
            if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
            return a.title.localeCompare(b.title)
        })

    const ordered: CategoryRow[] = []

    const walk = (parentId: string | null) => {
        for (const row of sortNodes(byParent.get(parentId) || [])) {
            ordered.push(row)
            walk(row.id)
        }
    }

    walk(null)
    return ordered
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
        const resolvedSource = canonicalCollectionsParent ? "category_parent" : "category_tree_virtual_root"
        const sourceRows = canonicalCollectionsParent
            ? rows
                .filter((row) => row.parentId === canonicalCollectionsParent.id)
                .sort((a, b) => {
                    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
                    return a.title.localeCompare(b.title)
                })
            : buildTreeOrder(rows)
        const children = sourceRows
            .slice(0, 15)
            .map((row) => ({
                id: row.id,
                title: row.title,
                slug: row.slug,
                path: pathById.get(row.id) || `/${row.slug}`,
                image: row.image,
            }))

        console.info(`[Collections Mega Menu] source=${resolvedSource}`, {
            parent: canonicalCollectionsParent
                ? {
                    id: canonicalCollectionsParent.id,
                    slug: canonicalCollectionsParent.slug,
                    title: canonicalCollectionsParent.title,
                }
                : {
                    id: null,
                    slug: null,
                    title: "Virtual Collections Root",
                },
            totalDirectChildren: sourceRows.length,
            first15Children: children.map((child) => ({ id: child.id, title: child.title })),
            children: children.map((child) => ({ id: child.id, title: child.title })),
        })

        return NextResponse.json({
            source: resolvedSource,
            parentFound: Boolean(canonicalCollectionsParent),
            childCount: sourceRows.length,
            parent: canonicalCollectionsParent
                ? {
                    id: canonicalCollectionsParent.id,
                    title: canonicalCollectionsParent.title,
                    slug: canonicalCollectionsParent.slug,
                }
                : null,
            children,
        })
    } catch (error) {
        console.error("GET Collections Categories Error:", error)
        return NextResponse.json({ error: "Failed to fetch collection categories" }, { status: 500 })
    }
}
