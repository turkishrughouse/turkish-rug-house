import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { requireAdminApiAuth } from "@/lib/admin-guard"

const bulkStatusSchema = z.object({
    ids: z.array(z.string()).min(1),
    status: z.enum(["DRAFT", "PUBLISHED"]),
})

const bulkDeleteSchema = z.object({
    ids: z.array(z.string()).min(1),
})

// PATCH /api/admin/pages/bulk
// body: { ids: string[], status: "DRAFT" | "PUBLISHED" }
export async function PATCH(request: Request) {
    const auth = await requireAdminApiAuth()
    if (auth instanceof NextResponse) return auth
    try {
        const body = await request.json()
        const parsed = bulkStatusSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid data", details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            )
        }

        const { ids, status } = parsed.data

        await prisma.page.updateMany({
            where: { id: { in: ids } },
            data: { status },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Bulk page status error:", error)
        return NextResponse.json({ error: "Failed to update pages" }, { status: 500 })
    }
}

// DELETE /api/admin/pages/bulk
// body: { ids: string[] }
export async function DELETE(request: Request) {
    const auth = await requireAdminApiAuth()
    if (auth instanceof NextResponse) return auth
    try {
        const body = await request.json()
        const parsed = bulkDeleteSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid data", details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            )
        }

        await prisma.page.deleteMany({
            where: { id: { in: parsed.data.ids } },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Bulk page delete error:", error)
        return NextResponse.json({ error: "Failed to delete pages" }, { status: 500 })
    }
}

