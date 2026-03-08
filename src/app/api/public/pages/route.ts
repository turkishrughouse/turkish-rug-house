import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const dynamic = 'force-dynamic'

// GET /api/public/pages
export async function GET(req: NextRequest) {
    try {
        const pages = await prisma.page.findMany({
            where: {
                status: "PUBLISHED"
            },
            select: {
                id: true,
                title: true,
                slug: true
            },
            orderBy: {
                title: 'asc' // or updatedAt desc
            }
        })

        return NextResponse.json(pages)
    } catch (error) {
        console.error("Error fetching public pages:", error)
        return NextResponse.json({ error: "Failed to fetch pages" }, { status: 500 })
    }
}
