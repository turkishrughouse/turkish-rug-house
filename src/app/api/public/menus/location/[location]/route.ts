
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ location: string }> }
) {
    try {
        const { location } = await params

        if (!location) {
            return NextResponse.json({ error: "Location is required" }, { status: 400 })
        }

        const menus = await prisma.menu.findMany({
            where: {
                location: location
            },
            orderBy: {
                updatedAt: "desc",
            },
            include: {
                items: {
                    orderBy: {
                        sortOrder: 'asc'
                    }
                }
            }
        })

        const menu = menus.find((candidate) => candidate.items.length > 0) || menus[0]

        if (!menu) {
            return NextResponse.json(null, { status: 404 })
        }

        // Build tree
        const itemMap = new Map<string, any>()
        const rootItems: any[] = []

        menu.items.forEach((item) => {
            itemMap.set(item.id, { ...item, children: [] })
        })

        menu.items.forEach((item) => {
            if (item.parentId) {
                const parent = itemMap.get(item.parentId)
                if (parent) {
                    parent.children.push(itemMap.get(item.id))
                }
            } else {
                rootItems.push(itemMap.get(item.id))
            }
        })

        const sortRecursive = (nodes: any[]) => {
            nodes.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
            nodes.forEach((node) => {
                if (Array.isArray(node.children) && node.children.length > 0) {
                    sortRecursive(node.children)
                }
            })
        }

        sortRecursive(rootItems)

        return NextResponse.json({ ...menu, items: rootItems })

    } catch (error) {
        console.error("Error fetching menu by location:", error)
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        )
    }
}
