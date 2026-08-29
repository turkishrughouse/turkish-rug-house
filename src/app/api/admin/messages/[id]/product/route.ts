import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdminApiAuth } from "@/lib/admin-guard"
import {
    getProductQuestionSlugCandidates,
    isProductQuestionMessage,
} from "@/lib/product-question-message"
import {
    buildProductImageAlt,
    getCardProductImageCandidates,
    getPrimaryProductImageCandidates,
    parseProductImageRecords,
} from "@/lib/product-images"

export const dynamic = "force-dynamic"

function parseMetadata(raw: string | null | undefined): Record<string, unknown> {
    if (!raw) return {}
    try {
        const parsed = JSON.parse(raw)
        return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {}
    } catch {
        return {}
    }
}

/**
 * GET /api/admin/messages/:id/product
 *
 * Resolves the product a storefront "Ask Question" message came from so the
 * message detail screen can show it visually instead of raw URLs. Read-only, and
 * `{ product: null }` is a normal answer: the row may predate the current slug,
 * the product may have been deleted, or the message may not be a question at all.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdminApiAuth()
    if (auth instanceof NextResponse) return auth

    try {
        void req
        const { id } = await params

        const message = await prisma.message.findUnique({
            where: { id },
            select: { id: true, source: true, subject: true, content: true, metadata: true, deletedAt: true },
        })

        if (!message || message.deletedAt) {
            return NextResponse.json({ error: "Message not found" }, { status: 404 })
        }

        if (!isProductQuestionMessage(message)) {
            return NextResponse.json({ product: null })
        }

        const metadata = parseMetadata(message.metadata)
        const pageUrl = typeof metadata.pageUrl === "string" ? metadata.pageUrl : ""
        const slugs = getProductQuestionSlugCandidates(message.content, pageUrl)
        if (slugs.length === 0) {
            return NextResponse.json({ product: null })
        }

        const product = await prisma.product.findFirst({
            where: { slug: { in: slugs }, deletedAt: null },
            select: { id: true, slug: true, title: true, sku: true, isPublished: true, images: true },
        })

        if (!product) {
            return NextResponse.json({ product: null })
        }

        const imageRecords = parseProductImageRecords(product.images)

        return NextResponse.json({
            product: {
                id: product.id,
                slug: product.slug,
                title: product.title,
                sku: product.sku,
                isPublished: product.isPublished,
                // thumb-first for the small card image, large-first for the popup.
                thumbnailCandidates: getCardProductImageCandidates(product.images),
                previewCandidates: getPrimaryProductImageCandidates(product.images),
                imageAlt: buildProductImageAlt({
                    title: product.title,
                    fallbackAlt: imageRecords[0]?.alt,
                }),
            },
        })
    } catch (error) {
        console.error("[Admin Messages API] Error resolving question product:", error)
        return NextResponse.json({ error: "Failed to resolve product" }, { status: 500 })
    }
}
