
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { requireAdminApiAuth } from "@/lib/admin-guard"

const reorderSchema = z.object({
    updates: z.array(z.object({
        id: z.string(),
        parentId: z.string().nullable(),
        sortOrder: z.number().int()
    }))
})

export async function PATCH(request: Request) {
    const auth = await requireAdminApiAuth()
    if (auth instanceof NextResponse) return auth
    try {
        const body = await request.json()
        const result = reorderSchema.safeParse(body)

        if (!result.success) {
            return NextResponse.json({ error: "Invalid data", details: result.error.flatten().fieldErrors }, { status: 400 })
        }

        const { updates } = result.data

        const updatedRows = await prisma.$transaction(
            updates.map((update) =>
                prisma.category.update({
                    where: { id: update.id },
                    data: {
                        parentId: update.parentId,
                        sortOrder: update.sortOrder
                    }
                })
            )
        )

        const mismatch = updates.find((update) => {
            const persisted = updatedRows.find((row) => row.id === update.id)
            return !persisted || persisted.parentId !== update.parentId || persisted.sortOrder !== update.sortOrder
        })

        if (mismatch) {
            return NextResponse.json({ error: "Hierarchy change could not be persisted" }, { status: 409 })
        }

        const categories = await prisma.category.findMany({
            include: {
                parent: {
                    select: { id: true, title: true }
                },
                _count: {
                    select: { products: true }
                }
            },
            orderBy: [
                { sortOrder: "asc" },
                { title: "asc" },
            ]
        })

        return NextResponse.json({ success: true, categories })

    } catch (error) {
        console.error("Reorder Error:", error)
        return NextResponse.json({ error: "Failed to reorder" }, { status: 500 })
    }
}
