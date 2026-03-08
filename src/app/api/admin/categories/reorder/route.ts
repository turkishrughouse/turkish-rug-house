
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { z } from "zod"

const reorderSchema = z.object({
    updates: z.array(z.object({
        id: z.string(),
        parentId: z.string().nullable(),
        sortOrder: z.number().int()
    }))
})

export async function PATCH(request: Request) {
    try {
        const body = await request.json()
        const result = reorderSchema.safeParse(body)

        if (!result.success) {
            return NextResponse.json({ error: "Invalid data", details: result.error.flatten().fieldErrors }, { status: 400 })
        }

        const { updates } = result.data

        // Transactional update
        await prisma.$transaction(
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

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error("Reorder Error:", error)
        return NextResponse.json({ error: "Failed to reorder" }, { status: 500 })
    }
}
