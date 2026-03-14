
import { NextResponse } from "next/server";
import { getProducts } from "@/lib/actions/product-actions";

export const revalidate = 300;

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const page = Number(searchParams.get("page")) || 1;
        const limit = Number(searchParams.get("limit")) || 20;
        const query = searchParams.get("q") || "";
        const sortParam = searchParams.get("sort");
        const sort: "latest" | "oldest" | "price-asc" | "price-desc" =
            sortParam === "oldest" || sortParam === "price-asc" || sortParam === "price-desc"
                ? sortParam
                : "latest";
        const categorySlug = searchParams.get("category") || undefined;
        const typeSlug = searchParams.get("type") || undefined;
        const styleSlug = searchParams.get("style") || undefined;
        const colorSlug = searchParams.get("color") || undefined;
        const sizeSlug = searchParams.get("size") || undefined;
        const ageSlug = searchParams.get("age") || undefined;

        // Parse filters if passed as JSON string or individual params
        // For simplicity, we'll mapping basic params to filters
        const filters = {
            priceMin: searchParams.get("minPrice") ? Number(searchParams.get("minPrice")) : undefined,
            priceMax: searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined,
            types: typeSlug ? [typeSlug] : undefined,
            styles: styleSlug ? [styleSlug] : undefined,
            colors: colorSlug ? [colorSlug] : undefined,
            sizes: sizeSlug ? [sizeSlug] : undefined,
            ages: ageSlug ? [ageSlug] : undefined,
        };

        const result = await getProducts(page, limit, query, "published", sort, categorySlug, filters);

        return NextResponse.json(result, {
            headers: {
                "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
            },
        });
    } catch (error) {
        console.error("API Products Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch products" },
            { status: 500 }
        );
    }
}
