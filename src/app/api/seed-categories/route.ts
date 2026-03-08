
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

// Hardcoded data from mega-menu.ts
const CATEGORIES = {
    byType: ["Kilim", "Tulu", "Oushak", "Hereke", "Bunyan", "Kars", "Isparta", "Milas"],
    byStyle: ["Vintage", "Bohemian", "Traditional", "Modern", "Geometric", "Tribal", "Floral", "Minimalist"],
    bySize: ["Small (2x3 - 3x5)", "Medium (4x6 - 6x9)", "Large (8x10 - 9x12)", "Oversize (10x14+)", "Runner", "Round", "Square"],
    byColor: ["Beige", "Blue", "Red", "Green", "Orange", "Multi", "Black & White", "Pink"],
    byAge: ["Antique (>100 yrs)", "Vintage (20-99 yrs)", "New", "Distressed"]
}

function slugify(text: string) {
    return text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '')
}

export async function GET() {
    try {
        // 1. Create Roots
        const roots = [
            { title: "Type", key: "byType" },
            { title: "Style", key: "byStyle" },
            { title: "Size", key: "bySize" },
            { title: "Color", key: "byColor" },
            { title: "Age", key: "byAge" },
        ]

        let createdCount = 0

        for (const root of roots) {
            // Check if root exists
            const rootSlug = slugify(root.title)
            let rootCat = await prisma.category.findUnique({ where: { slug: rootSlug } })

            if (!rootCat) {
                rootCat = await prisma.category.create({
                    data: {
                        title: root.title,
                        slug: rootSlug,
                        description: `Browse rugs by ${root.title.toLowerCase()}`
                    }
                })
                createdCount++
            }

            // Create Children
            // @ts-ignore
            const childrenTitles = CATEGORIES[root.key]
            if (childrenTitles) {
                for (const childTitle of childrenTitles) {
                    const childSlug = slugify(childTitle)
                    const exists = await prisma.category.findUnique({ where: { slug: childSlug } })

                    if (!exists) {
                        await prisma.category.create({
                            data: {
                                title: childTitle,
                                slug: childSlug,
                                parentId: rootCat.id
                            }
                        })
                        createdCount++
                    }
                }
            }
        }

        return NextResponse.json({ success: true, message: `Created/Verified categories. New items: ${createdCount}` })

    } catch (error) {
        console.error("Seed Error:", error)
        return NextResponse.json({ error: "Failed to seed" }, { status: 500 })
    }
}
