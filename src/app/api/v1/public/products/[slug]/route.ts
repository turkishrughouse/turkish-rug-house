
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getProductVisibleAttributes } from "@/lib/product-attributes";

export const dynamic = 'force-dynamic';

type CustomAttribute = {
    name: string
    values: string[]
    visible: boolean
}

function parseCustomAttributes(raw: string | null | undefined): CustomAttribute[] {
    if (!raw) return []
    try {
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        return parsed
            .map((item) => {
                if (!item || typeof item !== "object") return null
                const name = typeof item.name === "string" ? item.name.trim() : ""
                const values = Array.isArray(item.values)
                    ? item.values.filter((value: unknown): value is string => typeof value === "string").map((value: string) => value.trim()).filter(Boolean)
                    : []
                if (!name || values.length === 0) return null
                return {
                    name,
                    values,
                    visible: item.visible !== false,
                } as CustomAttribute
            })
            .filter((item): item is CustomAttribute => Boolean(item))
    } catch {
        return []
    }
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;

        // We use prisma directly here or need an action that supports slug
        // Existing action is getProduct(id). Let's do direct DB for efficiency/speed here.
        const product = await prisma.product.findFirst({
            where: { slug: slug, isPublished: true },
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

        const attributeRows = await prisma.$queryRaw<Array<{ sku: string | null; shortDescription: string | null; customAttributes: string | null }>>`
            SELECT "sku", "shortDescription", "customAttributes"
            FROM "Product"
            WHERE "id" = ${product.id}
            LIMIT 1
        `;
        const attributeRecord = attributeRows[0];

        const dynamicAttributes = await getProductVisibleAttributes(product.id).catch(() => [])

        return NextResponse.json({
            ...serialized,
            sku: attributeRecord?.sku ?? null,
            shortDescription: attributeRecord?.shortDescription ?? null,
            customAttributes: dynamicAttributes.length > 0 ? dynamicAttributes : parseCustomAttributes(attributeRecord?.customAttributes),
        });

    } catch (error) {
        console.error("API Product Detail Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch product" },
            { status: 500 }
        );
    }
}
