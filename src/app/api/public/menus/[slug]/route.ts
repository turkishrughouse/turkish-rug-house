
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { buildCategoryPathMap } from "@/lib/category-paths"

export const dynamic = 'force-dynamic'

interface Params {
    params: Promise<{ slug: string }>
}

export async function GET(req: Request, { params }: Params) {
    try {
        const { slug } = await params

        // Find menu by Location or Slug
        const menus = await prisma.menu.findMany({
            where: {
                OR: [
                    { location: slug }, // e.g. "PRIMARY_HEADER"
                    { slug: slug }      // e.g. "information-menu"
                ]
            },
            orderBy: {
                updatedAt: "desc",
            },
            include: {
                items: {
                    orderBy: { sortOrder: 'asc' }
                }
            }
        })

        const menu = menus.find((candidate) => candidate.items.length > 0) || menus[0]

        if (!menu) {
            // Return null/empty instead of 404 to avoid triggering frontend errors
            return NextResponse.json(null)
        }

        // Enrich items with real URLs
        const catIds = menu.items.filter(i => i.type === 'CATEGORY' && i.referenceId).map(i => i.referenceId!)
        const pageIds = menu.items.filter(i => i.type === 'PAGE' && i.referenceId).map(i => i.referenceId!)

        const [categories, pages] = await Promise.all([
            catIds.length ? prisma.category.findMany({ where: { id: { in: catIds } }, select: { id: true, slug: true, title: true, parentId: true } }) : [],
            pageIds.length ? prisma.page.findMany({ where: { id: { in: pageIds } }, select: { id: true, slug: true, status: true } }) : []
        ])

        const { pathById } = buildCategoryPathMap(categories)
        // Only map published pages? Or all and let frontend decide?
        // Better to check published status here.
        const pageMap = new Map(pages.filter(p => p.status === 'PUBLISHED').map(p => [p.id, p.slug]))

        const enrichedItems = menu.items.map(item => {
            let url = item.url || "#"
            let isMissing = false

            if (item.type === 'CATEGORY') {
                if (item.referenceId && pathById.has(item.referenceId)) {
                    url = pathById.get(item.referenceId) || "#"
                } else {
                    isMissing = true
                    url = "#"
                }
            } else if (item.type === 'PAGE') {
                if (item.referenceId && pageMap.has(item.referenceId)) {
                    url = `/${pageMap.get(item.referenceId)}` // Root URL for Pages
                } else {
                    if (item.referenceId) isMissing = true // Only mark missing if it had a ref
                }
            }

            return {
                id: item.id,
                parentId: item.parentId,
                label: item.label,
                url,
                type: item.type,
                children: [] as any[],
                _missing: isMissing
            }
        })

        // Build Tree
        const nodeMap = new Map<string, any>()
        enrichedItems.forEach(i => nodeMap.set(i.id, i))
        const roots: any[] = []

        enrichedItems.forEach(i => {
            if (i.parentId && nodeMap.has(i.parentId)) {
                nodeMap.get(i.parentId).children.push(i)
            } else {
                roots.push(i)
            }
        })

        return NextResponse.json({
            id: menu.id,
            name: menu.title,
            location: menu.location,
            items: roots
        })
    } catch (error) {
        console.error("GET /api/public/menus/[slug] error:", error)
        return NextResponse.json({ error: "Failed to fetch menu" }, { status: 500 })
    }
}
