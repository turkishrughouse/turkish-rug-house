
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;

        // We use prisma directly here or need an action that supports slug
        // Existing action is getProduct(id). Let's do direct DB for efficiency/speed here.
        const product = await prisma.product.findUnique({
            where: { slug: slug },
            include: {
                categories: true,
                colors: true,
                sizes: true,
                styles: true,
                types: true,
            }
        });

        if (!product) {
            return NextResponse.json({ error: "Product not found" }, { status: 404 });
        }

        // Parse types for mobile
        const serialized = {
            ...product,
            price: product.price.toNumber(),
            compareAtPrice: product.compareAtPrice ? product.compareAtPrice.toNumber() : null,
        };

        return NextResponse.json(serialized);

    } catch (error) {
        console.error("API Product Detail Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch product" },
            { status: 500 }
        );
    }
}
