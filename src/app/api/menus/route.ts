import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { z } from "zod"

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const slug = searchParams.get("slug")
        const location = searchParams.get("location")

        if (slug || location) {
            // Build query
            const whereClause = slug ? { slug } : { location }

            // Fetch single menu by slug OR location with items
            const menu = await prisma.menu.findFirst({
                where: whereClause,
                include: {
                    items: {
                        orderBy: { sortOrder: "asc" }
                    }
                }
            })

            if (!menu) return NextResponse.json({ error: "Menu not found" }, { status: 404 })

            // Enrich items with referenced details (Title, Slug/URL)
            // 1. Collect IDs
            const catIds = menu.items.filter(i => i.type === "CATEGORY" && i.referenceId).map(i => i.referenceId!)
            const pageIds = menu.items.filter(i => i.type === "PAGE" && i.referenceId).map(i => i.referenceId!)

            // 2. Fetch Data
            const [categories, pages] = await Promise.all([
                catIds.length > 0 ? prisma.category.findMany({ where: { id: { in: catIds } } }) : [],
                pageIds.length > 0 ? prisma.page.findMany({ where: { id: { in: pageIds } } }) : []
            ])

            // 3. Map Data
            const enrichedItems = menu.items.map(item => {
                const baseItem = {
                    id: item.id,
                    parentId: item.parentId,
                    type: item.type,
                    label: item.label,
                    url: item.url,
                    referenceId: item.referenceId,
                    depth: 0, // Calculated by consumer usually, but we can't easily compute depth flat list here without building tree.
                    // The Admin UI computes depth from parentId. Frontend will too.
                }

                if (item.type === "CATEGORY") {
                    const cat = categories.find(c => c.id === item.referenceId)
                    if (cat) {
                        return {
                            ...baseItem,
                            url: `/category/${cat.slug}`,
                            originalLabel: cat.title
                        }
                    } else {
                        return { ...baseItem, _missing: true } // Item deleted?
                    }
                }
                if (item.type === "PAGE") {
                    const page = pages.find(p => p.id === item.referenceId)
                    if (page) {
                        return {
                            ...baseItem,
                            url: `/pages/${page.slug}`,
                            originalLabel: page.title
                        }
                    } else {
                        return { ...baseItem, _missing: true }
                    }
                }
                return baseItem
            })

            return NextResponse.json({ ...menu, items: enrichedItems })
        }

        // List all menus
        const menus = await prisma.menu.findMany({
            orderBy: { title: "asc" },
            include: {
                _count: {
                    select: { items: true }
                }
            }
        })
        return NextResponse.json(menus)
    } catch (error) {
        console.error("GET /api/menus error:", error)
        return NextResponse.json({ error: "Failed to fetch menus" }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { title, slug, location } = body

        if (!title || !slug) {
            return NextResponse.json({ error: "Title and Slug are required" }, { status: 400 })
        }

        // If location is set, ensure no other menu has it
        if (location) {
            await prisma.menu.updateMany({
                where: { location },
                data: { location: null }
            })
        }

        const menu = await prisma.menu.create({
            data: {
                title,
                slug,
                location
            }
        })

        return NextResponse.json(menu)
    } catch (error: any) {
        console.error("POST /api/menus error:", error)
        // Check for unique constraint violation
        if (error.code === 'P2002') {
            return NextResponse.json({ error: "A menu with this slug already exists" }, { status: 409 })
        }
        return NextResponse.json({ error: error.message || "Failed to create menu" }, { status: 500 })
    }
}
