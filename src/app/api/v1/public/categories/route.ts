
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildCategoryPathMap } from "@/lib/category-paths";

type PublicCategoryNode = {
    id: string
    slug: string
    title: string
    image: string | null
    sortOrder: number
    parentId: string | null
    _count: { products: number }
    path: string
    children: PublicCategoryNode[]
}

export async function GET() {
    try {
        const categories = await prisma.category.findMany({
            where: { isVisible: true },
            select: {
                id: true,
                slug: true,
                title: true,
                image: true,
                sortOrder: true,
                parentId: true,
                _count: {
                    select: { products: true }
                }
            },
            orderBy: {
                sortOrder: 'asc'
            }
        });

        const { pathById } = buildCategoryPathMap(categories)
        const byParent = new Map<string | null, typeof categories>()

        categories.forEach((category) => {
            const bucket = byParent.get(category.parentId) || []
            bucket.push(category)
            byParent.set(category.parentId, bucket)
        })

        const walk = (parentId: string | null): PublicCategoryNode[] =>
            (byParent.get(parentId) || []).map((category) => ({
                ...category,
                path: pathById.get(category.id) || `/${category.slug}`,
                children: walk(category.id),
            }))

        return NextResponse.json(walk(null), { status: 200 });
    } catch (error) {
        console.error("Error fetching categories:", error);
        return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
    }
}
