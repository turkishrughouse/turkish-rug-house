
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

// Helper: Build Tree for Response
function buildTree(items: any[]) {
    const idMap = new Map()
    const roots: any[] = []

    items.forEach(item => {
        item.children = []
        idMap.set(item.id, item)
    })

    items.forEach(item => {
        if (item.parentId && idMap.has(item.parentId)) {
            const parent = idMap.get(item.parentId)
            parent.children.push(item)
        } else {
            roots.push(item)
        }
    })

    const sortRecursive = (nodes: any[]) => {
        nodes.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        nodes.forEach(node => {
            if (node.children.length > 0) sortRecursive(node.children)
        })
    }

    sortRecursive(roots)
    return roots
}

// GET /api/admin/menus/:id
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const menu = await prisma.menu.findUnique({
            where: { id },
            include: {
                items: { orderBy: { sortOrder: 'asc' } }
            }
        })

        if (!menu) return NextResponse.json({ error: "Menu not found" }, { status: 404 })

        return NextResponse.json({
            ...menu,
            items: buildTree(menu.items)
        })
    } catch (error) {
        console.error("GET Menu Error:", error)
        return NextResponse.json({ error: "Failed to fetch menu" }, { status: 500 })
    }
}

// PUT /api/admin/menus/:id
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const body = await req.json()
        const { title, slug, location, items } = body

        console.log(`[PUT Menu] Updating menu ${id}`, { title, location, itemCount: items?.length })

        // 1. Transaction: Update Menu & Rewrite Items
        await prisma.$transaction(async (tx) => {
            // A. Update Metadata & Location Uniqueness
            if (location) {
                // If this menu takes a location, remove it from others
                await tx.menu.updateMany({
                    where: { location, id: { not: id } },
                    data: { location: null }
                })
            }

            await tx.menu.update({
                where: { id },
                data: {
                    title,
                    slug,
                    location: location === "NONE" ? null : location // Handle NONE explicitly
                }
            })

            // B. Sync Items (Full Wipe & Recreate)
            if (items && Array.isArray(items)) {
                // 1. Wipe old items
                await tx.menuItem.deleteMany({ where: { menuId: id } })

                // 2. Map Frontend temp IDs to new DB IDs
                const idMap = new Map<string, string>()

                // 3. Create Items (Pass 1: No Parents)
                for (const item of items) {
                    const created = await tx.menuItem.create({
                        data: {
                            menuId: id,
                            type: item.type,
                            label: item.label,
                            url: item.url,
                            referenceId: item.referenceId,
                            sortOrder: item.index ?? item.sortOrder ?? 0,
                            parentId: null // First pass: no parent to avoid foreign key errors
                        }
                    })
                    idMap.set(item.id, created.id)
                }

                // 4. Link Parents (Pass 2)
                for (const item of items) {
                    if (item.parentId && idMap.has(item.parentId)) {
                        const dbId = idMap.get(item.id)
                        const parentDbId = idMap.get(item.parentId)

                        if (dbId && parentDbId) {
                            await tx.menuItem.update({
                                where: { id: dbId },
                                data: { parentId: parentDbId }
                            })
                        }
                    }
                }
            }
        })

        console.log(`[PUT Menu] Sync complete for ${id}`)
        return NextResponse.json({ success: true })

    } catch (error) {
        console.error("PUT Menu Error:", error)
        return NextResponse.json({ error: "Failed to update menu" }, { status: 500 })
    }
}

// DELETE /api/admin/menus/:id
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        await prisma.menu.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("DELETE Menu Error:", error)
        return NextResponse.json({ error: "Failed to delete menu" }, { status: 500 })
    }
}
