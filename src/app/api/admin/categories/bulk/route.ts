
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { z } from "zod"

// --- Schemas ---
const bulkDeleteSchema = z.object({
    ids: z.array(z.string()).min(1),
    strategy: z.enum(['reassign', 'orphan', 'delete']).default('reassign')
})

const bulkPatchSchema = z.object({
    ids: z.array(z.string()).min(1),
    action: z.enum(['setParent', 'removeParent']),
    targetParentId: z.string().optional()
})

export async function DELETE(request: Request) {
    try {
        const body = await request.json()
        const result = bulkDeleteSchema.safeParse(body)

        if (!result.success) {
            return NextResponse.json({ error: "Invalid data", details: result.error.flatten().fieldErrors }, { status: 400 })
        }

        const { ids, strategy } = result.data

        await prisma.$transaction(async (tx) => {
            // Get all targets to know their parents (for reassign strategy)
            const targets = await tx.category.findMany({
                where: { id: { in: ids } },
                include: { children: true }
            })

            for (const category of targets) {
                const childrenIds = category.children.map(c => c.id)

                if (childrenIds.length > 0) {
                    if (strategy === 'delete') {
                        await tx.category.deleteMany({
                            where: { parentId: category.id }
                        })
                    }
                    else if (strategy === 'orphan') {
                        // Make top level
                        await tx.category.updateMany({
                            where: { parentId: category.id },
                            data: { parentId: null }
                        })
                    }
                    else if (strategy === 'reassign') {
                        // Move to grandparent
                        await tx.category.updateMany({
                            where: { parentId: category.id },
                            data: { parentId: category.parentId }
                        })
                    }
                }
            }

            // Finally delete the targets
            await tx.category.deleteMany({
                where: { id: { in: ids } }
            })
        })

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error("Bulk Delete Error:", error)
        return NextResponse.json({ error: "Failed to perform bulk delete" }, { status: 500 })
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json()
        const result = bulkPatchSchema.safeParse(body)

        if (!result.success) {
            return NextResponse.json({ error: "Invalid data", details: result.error.flatten().fieldErrors }, { status: 400 })
        }

        const { ids, action, targetParentId } = result.data

        if (action === 'removeParent') {
            await prisma.category.updateMany({
                where: { id: { in: ids } },
                data: { parentId: null }
            })
        }
        else if (action === 'setParent') {
            if (!targetParentId) {
                return NextResponse.json({ error: "Target parent ID is required" }, { status: 400 })
            }

            if (ids.includes(targetParentId)) {
                return NextResponse.json({ error: "Cannot set a category as its own parent" }, { status: 400 })
            }

            await prisma.category.updateMany({
                where: { id: { in: ids } },
                data: { parentId: targetParentId }
            })
        }

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error("Bulk Patch Error:", error)
        return NextResponse.json({ error: "Failed to update categories" }, { status: 500 })
    }
}
