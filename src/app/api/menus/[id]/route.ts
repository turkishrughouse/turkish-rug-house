import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await req.json()
        const { title, slug, location, items } = body

        // 1. Update Menu Details
        const menu = await prisma.menu.update({
            where: { id },
            data: {
                title,
                slug,
                location
            }
        })

        // 2. Sync Items (if provided)
        if (items && Array.isArray(items)) {
            // Strategy: Transaction
            // 1. Get current item IDs
            // 2. Delete items not in the new list
            // 3. Upsert items (create new or update existing)

            await prisma.$transaction(async (tx) => {
                const incomingIds = items.filter((i: any) => i.id && !i.id.startsWith("temp-")).map((i: any) => i.id)

                // Delete removed items
                await tx.menuItem.deleteMany({
                    where: {
                        menuId: id,
                        id: { notIn: incomingIds }
                    }
                })

                // Upsert all
                for (const item of items) {
                    // Map "temp-xxx" ids to undefined so Prisma creates them
                    const isNew = !item.id || item.id.startsWith("temp-")
                    const itemId = isNew ? undefined : item.id

                    const payload = {
                        menuId: id,
                        type: item.type,
                        label: item.label,
                        url: item.url,
                        referenceId: item.referenceId,
                        parentId: item.parentId,
                        sortOrder: item.sortOrder
                    }

                    if (isNew) {
                        await tx.menuItem.create({ data: payload })
                    } else {
                        await tx.menuItem.update({
                            where: { id: itemId },
                            data: payload
                        })
                    }
                }
            })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error(error)
        return NextResponse.json({ error: "Failed to update menu" }, { status: 500 })
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        await prisma.menu.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete menu" }, { status: 500 })
    }
}
