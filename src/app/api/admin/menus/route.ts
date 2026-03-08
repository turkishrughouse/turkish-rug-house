
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { z } from "zod"

const menuSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    location: z.enum([
        "PRIMARY_HEADER",
        "TOP_BAR",
        "INFORMATION_FOOTER",
        "HEADER_INFORMATION",
        "HOME_TOP_CATEGORIES",
        "CATEGORY_ATTRIBUTE_SHORTCUTS",
    ]).optional().nullable()
})

const slugify = (text: string) => {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '')
}

// GET /api/admin/menus
export async function GET() {
    try {
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
        console.error("GET /api/admin/menus error:", error)
        return NextResponse.json({ error: "Failed to fetch menus" }, { status: 500 })
    }
}

// POST /api/admin/menus
export async function POST(req: Request) {
    try {
        const body = await req.json()
        const result = menuSchema.safeParse(body)

        if (!result.success) {
            return NextResponse.json(
                { error: "Invalid data", details: result.error.flatten().fieldErrors },
                { status: 400 }
            )
        }

        const { name, location } = result.data
        const slug = slugify(name)

        // DB Transaction for Atomic Location Swap
        const menu = await prisma.$transaction(async (tx) => {
            // If setting a location (e.g. Primary), clear it from others first
            if (location) {
                await tx.menu.updateMany({
                    where: { location },
                    data: { location: null }
                })
            }

            return await tx.menu.create({
                data: {
                    title: name,
                    slug,
                    location: location || null
                }
            })
        })

        return NextResponse.json({ ...menu, items: [] }, { status: 201 })

    } catch (error: unknown) {
        console.error("POST /api/admin/menus error:", error)
        if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            (error as { code?: string }).code === "P2002"
        ) {
            return NextResponse.json({ error: "Menu with this name already exists" }, { status: 409 })
        }
        return NextResponse.json({ error: "Failed to create menu" }, { status: 500 })
    }
}
