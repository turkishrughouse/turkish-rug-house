
import { NextResponse } from "next/server";
import { getCategories } from "@/lib/actions/category-actions";
import { getProducts } from "@/lib/actions/product-actions";

export const revalidate = 300;

export async function GET() {
    try {
        const [categories, { products: featuredProducts }] = await Promise.all([
            getCategories(),
            getProducts(1, 8, "", "published", "latest", undefined, { featuredOnly: true })
        ]);

        return NextResponse.json({
            categories,
            featuredProducts
        }, {
            headers: {
                "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
            },
        });
    } catch (error) {
        console.error("API Home Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch home data" },
            { status: 500 }
        );
    }
}
