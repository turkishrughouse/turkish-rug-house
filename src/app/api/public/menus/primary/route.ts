
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const dynamic = 'force-dynamic' // Ensure validation

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

// GET /api/public/menus/primary
export async function GET() {
    try {
        const menu = await prisma.menu.findFirst({
            where: { location: "PRIMARY_HEADER" },
            include: {
                items: { orderBy: { sortOrder: 'asc' } }
            }
        })

        if (!menu) {
            // Null response is valid if no menu is assigned
            return NextResponse.json(null)
        }

        return NextResponse.json({
            ...menu,
            items: buildTree(menu.items)
        })

    } catch (error) {
        console.error("GET Public Primary Menu Error:", error)
        return NextResponse.json(
            { error: "Failed to fetch menu" },
            { status: 500 }
        )
    }
}
