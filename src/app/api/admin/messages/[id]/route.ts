import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { messageUpdateSchema } from "@/lib/validations/message"
import { Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"

function parseMetadata(raw: string | null | undefined): Record<string, unknown> {
    if (!raw) return {}
    try {
        return JSON.parse(raw) as Record<string, unknown>
    } catch {
        return {}
    }
}

function normalizeEmailSubject(value: string | null | undefined) {
    const raw = (value || "").trim().toLowerCase()
    if (!raw) return "(no-subject)"
    return raw.replace(/^(re|fwd|fw)\s*:\s*/gi, "").trim() || "(no-subject)"
}

/**
 * GET /api/admin/messages/:id
 * Fetch a single message by ID
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        void req
        const { id } = await params

        if (id.startsWith("review_")) {
            const existingReviewMessage = await prisma.message.findUnique({
                where: { id },
            })
            if (existingReviewMessage && !existingReviewMessage.deletedAt) {
                return NextResponse.json({
                    ...existingReviewMessage,
                    metadata: existingReviewMessage.metadata ? JSON.parse(existingReviewMessage.metadata) : {},
                    attachments: existingReviewMessage.attachments ? JSON.parse(existingReviewMessage.attachments) : [],
                })
            }

            const reviewId = id.replace("review_", "")
            const review = await prisma.productReview.findUnique({
                where: { id: reviewId },
                include: {
                    product: {
                        select: { id: true, slug: true, title: true },
                    },
                },
            })

            if (!review) {
                return NextResponse.json({ error: "Review not found" }, { status: 404 })
            }

            return NextResponse.json({
                id,
                source: "REVIEW",
                status: "NEW",
                name: review.name,
                email: review.email,
                phone: null,
                subject: `Review for ${review.product.title}`,
                content: review.comment,
                metadata: {
                    productReviewId: review.id,
                    productId: review.productId,
                    productSlug: review.product.slug,
                    productTitle: review.product.title,
                    rating: review.rating,
                },
                attachments: [],
                notes: null,
                receivedAt: review.createdAt,
                createdAt: review.createdAt,
                updatedAt: review.updatedAt,
                deletedAt: null,
            })
        }

        const message = await prisma.message.findUnique({
            where: { id },
        })

        if (!message) {
            return NextResponse.json({ error: "Message not found" }, { status: 404 })
        }

        // Don't return soft-deleted messages
        if (message.deletedAt) {
            return NextResponse.json({ error: "Message not found" }, { status: 404 })
        }

        // Parse JSON fields
        const messageWithParsedData = {
            ...message,
            metadata: message.metadata ? JSON.parse(message.metadata) : {},
            attachments: message.attachments ? JSON.parse(message.attachments) : [],
        }

        return NextResponse.json(messageWithParsedData)
    } catch (error) {
        console.error("[Admin Messages API] Error fetching message:", error)
        return NextResponse.json(
            { error: "Failed to fetch message" },
            { status: 500 }
        )
    }
}

/**
 * PATCH /api/admin/messages/:id
 * Update message status and/or notes
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await req.json()

        // Validate request body
        const validationResult = messageUpdateSchema.safeParse(body)
        if (!validationResult.success) {
            return NextResponse.json(
                { error: "Invalid request body", details: validationResult.error.issues },
                { status: 400 }
            )
        }

        const { status, notes } = validationResult.data

        if (id.startsWith("review_")) {
            const reviewId = id.replace("review_", "")
            const review = await prisma.productReview.findUnique({
                where: { id: reviewId },
                include: {
                    product: {
                        select: { id: true, slug: true, title: true },
                    },
                },
            })

            if (!review) {
                return NextResponse.json({ error: "Review not found" }, { status: 404 })
            }

            const reviewMessage = await prisma.message.upsert({
                where: { id },
                create: {
                    id,
                    source: "REVIEW",
                    status: status || "OPEN",
                    name: review.name,
                    email: review.email,
                    subject: `Review for ${review.product.title}`,
                    content: review.comment,
                    notes: notes || null,
                    metadata: JSON.stringify({
                        productReviewId: review.id,
                        productId: review.productId,
                        productSlug: review.product.slug,
                        productTitle: review.product.title,
                        rating: review.rating,
                    }),
                    receivedAt: review.createdAt,
                    createdAt: review.createdAt,
                },
                update: {
                    status: status ?? undefined,
                    notes: notes ?? undefined,
                    deletedAt: null,
                },
            })

            return NextResponse.json({
                ...reviewMessage,
                metadata: reviewMessage.metadata ? JSON.parse(reviewMessage.metadata) : {},
                attachments: reviewMessage.attachments ? JSON.parse(reviewMessage.attachments) : [],
            })
        }

        // Check if message exists
        const existingMessage = await prisma.message.findUnique({
            where: { id },
        })

        if (!existingMessage || existingMessage.deletedAt) {
            return NextResponse.json({ error: "Message not found" }, { status: 404 })
        }

        // Update message
        const updateData: Prisma.MessageUpdateInput = {}
        if (status !== undefined) {
            updateData.status = status
        }
        if (notes !== undefined) {
            updateData.notes = notes
        }

        const meta = parseMetadata(existingMessage.metadata)
        const userId = typeof meta.userId === "string" ? meta.userId : ""

        let updatedMessage
        if (existingMessage.source === "CUSTOMER" && userId) {
            await prisma.message.updateMany({
                where: {
                    source: "CUSTOMER",
                    deletedAt: null,
                    metadata: { contains: `"userId":"${userId}"` },
                },
                data: updateData,
            })
            updatedMessage = await prisma.message.findUnique({ where: { id } })
        } else if (existingMessage.source === "EMAIL" && existingMessage.email) {
            const subjectKey = normalizeEmailSubject(existingMessage.subject)
            const candidates = await prisma.message.findMany({
                where: {
                    source: "EMAIL",
                    deletedAt: null,
                    email: existingMessage.email.toLowerCase(),
                },
                select: { id: true, subject: true },
            })
            const ids = candidates
                .filter((item) => normalizeEmailSubject(item.subject) === subjectKey)
                .map((item) => item.id)
            if (ids.length > 0) {
                await prisma.message.updateMany({
                    where: { id: { in: ids }, deletedAt: null },
                    data: updateData,
                })
            }
            updatedMessage = await prisma.message.findUnique({ where: { id } })
        } else {
            updatedMessage = await prisma.message.update({
                where: { id },
                data: updateData,
            })
        }

        return NextResponse.json(updatedMessage)
    } catch (error) {
        console.error("[Admin Messages API] Error updating message:", error)
        return NextResponse.json(
            { error: "Failed to update message" },
            { status: 500 }
        )
    }
}

/**
 * DELETE /api/admin/messages/:id
 * Soft delete a message
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        void req
        const { id } = await params
        if (id.startsWith("review_")) {
            const reviewId = id.replace("review_", "")
            const review = await prisma.productReview.findUnique({
                where: { id: reviewId },
                include: {
                    product: {
                        select: { id: true, slug: true, title: true },
                    },
                },
            })

            if (!review) {
                return NextResponse.json({ error: "Review not found" }, { status: 404 })
            }

            await prisma.message.upsert({
                where: { id },
                create: {
                    id,
                    source: "REVIEW",
                    status: "OPEN",
                    name: review.name,
                    email: review.email,
                    subject: `Review for ${review.product.title}`,
                    content: review.comment,
                    metadata: JSON.stringify({
                        productReviewId: review.id,
                        productId: review.productId,
                        productSlug: review.product.slug,
                        productTitle: review.product.title,
                        rating: review.rating,
                    }),
                    receivedAt: review.createdAt,
                    createdAt: review.createdAt,
                    deletedAt: new Date(),
                },
                update: {
                    deletedAt: new Date(),
                },
            })

            await prisma.productReview.delete({
                where: { id: reviewId },
            }).catch(() => undefined)

            return NextResponse.json({ success: true, message: "Message deleted" })
        }

        // Check if message exists
        const existingMessage = await prisma.message.findUnique({
            where: { id },
        })

        if (!existingMessage || existingMessage.deletedAt) {
            return NextResponse.json({ error: "Message not found" }, { status: 404 })
        }

        // Soft delete by setting deletedAt timestamp
        const meta = parseMetadata(existingMessage.metadata)
        const userId = typeof meta.userId === "string" ? meta.userId : ""
        const now = new Date()

        let deletedMessage
        if (existingMessage.source === "CUSTOMER" && userId) {
            await prisma.message.updateMany({
                where: {
                    source: "CUSTOMER",
                    deletedAt: null,
                    metadata: { contains: `"userId":"${userId}"` },
                },
                data: { deletedAt: now },
            })
            deletedMessage = await prisma.message.findUnique({ where: { id } })
        } else if (existingMessage.source === "EMAIL" && existingMessage.email) {
            const subjectKey = normalizeEmailSubject(existingMessage.subject)
            const candidates = await prisma.message.findMany({
                where: {
                    source: "EMAIL",
                    deletedAt: null,
                    email: existingMessage.email.toLowerCase(),
                },
                select: { id: true, subject: true },
            })
            const ids = candidates
                .filter((item) => normalizeEmailSubject(item.subject) === subjectKey)
                .map((item) => item.id)
            if (ids.length > 0) {
                await prisma.message.updateMany({
                    where: { id: { in: ids }, deletedAt: null },
                    data: { deletedAt: now },
                })
            }
            deletedMessage = await prisma.message.findUnique({ where: { id } })
        } else {
            deletedMessage = await prisma.message.update({
                where: { id },
                data: { deletedAt: now },
            })
        }

        if (deletedMessage?.source === "REVIEW" && deletedMessage.metadata) {
            try {
                const parsed = JSON.parse(deletedMessage.metadata) as { productReviewId?: string }
                if (parsed.productReviewId) {
                    await prisma.productReview.delete({
                        where: { id: parsed.productReviewId },
                    }).catch(() => undefined)
                }
            } catch {
                // ignore malformed metadata
            }
        }

        return NextResponse.json({ success: true, message: "Message deleted" })
    } catch (error) {
        console.error("[Admin Messages API] Error deleting message:", error)
        return NextResponse.json(
            { error: "Failed to delete message" },
            { status: 500 }
        )
    }
}
