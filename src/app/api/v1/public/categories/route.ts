
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
    try {
        const categories = await prisma.category.findMany({
            where: {
                parentId: null
            },
            include: {
                children: {
                    orderBy: {
                        sortOrder: 'asc'
                    },
                    include: {
                        _count: {
                            select: { products: true }
                        }
                    }
                },
                _count: {
                    select: { products: true }
                }
            },
            orderBy: {
                sortOrder: 'asc'
            }
        });

        return NextResponse.json(categories, { status: 200 });
    } catch (error) {
        console.error("Error fetching categories:", error);
        return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
    }
}
