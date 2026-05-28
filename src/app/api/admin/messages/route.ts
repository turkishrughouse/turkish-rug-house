import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { messageListQuerySchema } from "@/lib/validations/message"
import { Prisma } from "@prisma/client"
import { requireAdminApiAuth } from "@/lib/admin-guard"

export const dynamic = "force-dynamic"

function parseMetadata(raw: string | null | undefined): Record<string, unknown> {
    if (!raw) return {}
    try {
        return JSON.parse(raw) as Record<string, unknown>
    } catch {
        return {}
    }
}

function getCustomerConversationKey(message: { id: string; email: string | null; metadata: string | null }) {
    const metadata = parseMetadata(message.metadata)
    const userId = typeof metadata.userId === "string" ? metadata.userId.trim() : ""
    if (userId) return `user:${userId}`
    const email = (message.email || "").trim().toLowerCase()
    if (email) return `email:${email}`
    return `msg:${message.id}`
}

function normalizeEmailSubject(value: string | null | undefined) {
    const raw = (value || "").trim().toLowerCase()
    if (!raw) return "(no-subject)"
    return raw.replace(/^(re|fwd|fw)\s*:\s*/gi, "").trim() || "(no-subject)"
}

/**
 * GET /api/admin/messages
 * List messages with filtering, search, and pagination
 */
export async function GET(req: NextRequest) {
    const auth = await requireAdminApiAuth()
    if (auth instanceof NextResponse) return auth
    try {
        const { searchParams } = new URL(req.url)

        // Parse and validate query parameters
        // Filter out null values to avoid validation issues
        const queryParams: Record<string, string> = {}
        const sourceParam = searchParams.get("source")
        const statusParam = searchParams.get("status")
        const qParam = searchParams.get("q")
        const pageParam = searchParams.get("page")
        const pageSizeParam = searchParams.get("pageSize")
        const fromParam = searchParams.get("from")
        const toParam = searchParams.get("to")
        const countryParam = searchParams.get("country")

        if (sourceParam) queryParams.source = sourceParam
        if (statusParam) queryParams.status = statusParam
        if (qParam) queryParams.q = qParam
        if (pageParam) queryParams.page = pageParam
        if (pageSizeParam) queryParams.pageSize = pageSizeParam
        if (fromParam) queryParams.from = fromParam
        if (toParam) queryParams.to = toParam
        if (countryParam) queryParams.country = countryParam

        const queryResult = messageListQuerySchema.safeParse(queryParams)

        if (!queryResult.success) {
            console.error("[Admin Messages API] Validation error:", queryResult.error.issues)
            return NextResponse.json(
                { error: "Invalid query parameters", details: queryResult.error.issues },
                { status: 400 }
            )
        }

        const { source, status, q, country, page, pageSize, from, to } = queryResult.data

        if (source === "CUSTOMER") {
            const skip = (page - 1) * pageSize
            const where: Prisma.MessageWhereInput = {
                deletedAt: null,
                source: "CUSTOMER",
            }

            if (status && status !== "ALL") {
                where.status = status
            }

            if (q && q.trim()) {
                where.OR = [
                    { name: { contains: q } },
                    { email: { contains: q } },
                    { phone: { contains: q } },
                    { subject: { contains: q } },
                    { content: { contains: q } },
                ]
            }

            if (from || to) {
                const receivedAtFilter: Prisma.DateTimeFilter = {}
                if (from) receivedAtFilter.gte = new Date(from)
                if (to) receivedAtFilter.lte = new Date(to)
                where.receivedAt = receivedAtFilter
            }

            if (country && country !== "ALL") {
                const escapedCountry = JSON.stringify(country).slice(1, -1)
                where.AND = [
                    ...(Array.isArray(where.AND) ? where.AND : []),
                    { metadata: { contains: `"country":"${escapedCountry}"` } },
                ]
            }

            const customerRows = await prisma.message.findMany({
                where,
                orderBy: { receivedAt: "desc" },
                select: {
                    id: true,
                    source: true,
                    status: true,
                    name: true,
                    email: true,
                    phone: true,
                    subject: true,
                    content: true,
                    metadata: true,
                    receivedAt: true,
                },
            })

            type GroupedConversation = {
                id: string
                source: "CUSTOMER"
                status: "NEW" | "OPEN" | "RESOLVED" | "BLOCKED"
                name: string | null
                email: string | null
                phone: string | null
                subject: string | null
                preview: string
                receivedAt: Date
                messageCount: number
                conversationId: string
            }

            const groupedMap = new Map<string, GroupedConversation>()
            for (const row of customerRows) {
                const key = getCustomerConversationKey(row)
                const meta = parseMetadata(row.metadata)
                const userId = typeof meta.userId === "string" ? meta.userId : ""
                const fallbackConversationId = userId ? `customer-${userId}` : row.id
                const conversationId =
                    (typeof meta.conversationId === "string" && meta.conversationId) || fallbackConversationId

                const preview = row.content.substring(0, 100) + (row.content.length > 100 ? "..." : "")
                const existing = groupedMap.get(key)
                if (!existing) {
                    groupedMap.set(key, {
                        id: row.id,
                        source: "CUSTOMER",
                        status: (row.status as GroupedConversation["status"]) || "OPEN",
                        name: row.name,
                        email: row.email,
                        phone: row.phone,
                        subject: row.subject,
                        preview,
                        receivedAt: row.receivedAt,
                        messageCount: 1,
                        conversationId,
                    })
                    continue
                }

                existing.messageCount += 1
                if (row.status === "NEW") {
                    existing.status = "NEW"
                } else if (row.status === "BLOCKED" && existing.status !== "NEW") {
                    existing.status = "BLOCKED"
                } else if (row.status === "OPEN" && existing.status === "RESOLVED") {
                    existing.status = "OPEN"
                }
            }

            const grouped = Array.from(groupedMap.values())
            const total = grouped.length
            const paginated = grouped.slice(skip, skip + pageSize)

            return NextResponse.json({
                data: paginated,
                meta: {
                    total,
                    page,
                    pageSize,
                    totalPages: Math.ceil(total / pageSize),
                },
            })
        }

        if (source === "EMAIL") {
            const skip = (page - 1) * pageSize
            const where: Prisma.MessageWhereInput = {
                deletedAt: null,
                source: "EMAIL",
            }

            if (status && status !== "ALL") {
                where.status = status
            }

            if (q && q.trim()) {
                where.OR = [
                    { name: { contains: q } },
                    { email: { contains: q } },
                    { subject: { contains: q } },
                    { content: { contains: q } },
                ]
            }

            if (from || to) {
                const receivedAtFilter: Prisma.DateTimeFilter = {}
                if (from) receivedAtFilter.gte = new Date(from)
                if (to) receivedAtFilter.lte = new Date(to)
                where.receivedAt = receivedAtFilter
            }

            const rows = await prisma.message.findMany({
                where,
                orderBy: { receivedAt: "desc" },
                select: {
                    id: true,
                    source: true,
                    status: true,
                    name: true,
                    email: true,
                    phone: true,
                    subject: true,
                    content: true,
                    receivedAt: true,
                },
            })

            const grouped = new Map<string, {
                id: string
                source: "EMAIL"
                status: "NEW" | "OPEN" | "RESOLVED" | "BLOCKED"
                name: string | null
                email: string | null
                phone: string | null
                subject: string | null
                preview: string
                receivedAt: Date
                messageCount: number
            }>()

            for (const row of rows) {
                const threadKey = `${(row.email || "").trim().toLowerCase()}::${normalizeEmailSubject(row.subject)}`
                const preview = row.content.substring(0, 100) + (row.content.length > 100 ? "..." : "")
                const existing = grouped.get(threadKey)
                if (!existing) {
                    grouped.set(threadKey, {
                        id: row.id,
                        source: "EMAIL",
                        status: (row.status as "NEW" | "OPEN" | "RESOLVED" | "BLOCKED") || "OPEN",
                        name: row.name,
                        email: row.email,
                        phone: row.phone,
                        subject: row.subject,
                        preview,
                        receivedAt: row.receivedAt,
                        messageCount: 1,
                    })
                    continue
                }

                existing.messageCount += 1
                if (row.status === "NEW") {
                    existing.status = "NEW"
                } else if (row.status === "BLOCKED" && existing.status !== "NEW") {
                    existing.status = "BLOCKED"
                } else if (row.status === "OPEN" && existing.status === "RESOLVED") {
                    existing.status = "OPEN"
                }
            }

            const data = Array.from(grouped.values())
            const total = data.length
            const paged = data.slice(skip, skip + pageSize)

            return NextResponse.json({
                data: paged,
                meta: {
                    total,
                    page,
                    pageSize,
                    totalPages: Math.ceil(total / pageSize),
                },
            })
        }

        if (source === "REVIEW") {
            const skip = (page - 1) * pageSize
            const reviewMessageWhere: Prisma.MessageWhereInput = {
                deletedAt: null,
                source: "REVIEW",
            }

            if (status && status !== "ALL") {
                reviewMessageWhere.status = status
            }

            if (q && q.trim()) {
                reviewMessageWhere.OR = [
                    { name: { contains: q } },
                    { email: { contains: q } },
                    { subject: { contains: q } },
                    { content: { contains: q } },
                ]
            }

            if (from || to) {
                const receivedAtFilter: Prisma.DateTimeFilter = {}
                if (from) receivedAtFilter.gte = new Date(from)
                if (to) receivedAtFilter.lte = new Date(to)
                reviewMessageWhere.receivedAt = receivedAtFilter
            }

            const reviewMessages = await prisma.message.findMany({
                where: reviewMessageWhere,
                orderBy: { receivedAt: "desc" },
                select: {
                    id: true,
                    source: true,
                    status: true,
                    name: true,
                    email: true,
                    phone: true,
                    subject: true,
                    content: true,
                    metadata: true,
                    receivedAt: true,
                    createdAt: true,
                    updatedAt: true,
                },
            })

            const transformedReviewMessages = reviewMessages.map((message) => {
                let parsedMetadata: Record<string, unknown> = {}
                if (message.metadata) {
                    try {
                        parsedMetadata = JSON.parse(message.metadata)
                    } catch {
                        parsedMetadata = {}
                    }
                }

                return {
                    id: message.id,
                    source: message.source,
                    status: message.status,
                    name: message.name,
                    email: message.email,
                    phone: message.phone,
                    subject: message.subject,
                    content: message.content,
                    preview: message.content.substring(0, 100) + (message.content.length > 100 ? "..." : ""),
                    receivedAt: message.receivedAt,
                    createdAt: message.createdAt,
                    updatedAt: message.updatedAt,
                    metadata: parsedMetadata,
                }
            })

            const linkedReviewIds = new Set<string>()
            const deletedReviewIds = new Set<string>()
            transformedReviewMessages.forEach((message) => {
                if (message.id.startsWith("review_")) {
                    linkedReviewIds.add(message.id.replace("review_", ""))
                }

                const metadata = message.metadata
                const productReviewId = metadata?.productReviewId
                if (typeof productReviewId === "string" && productReviewId) {
                    linkedReviewIds.add(productReviewId)
                }
            })

            const deletedReviewMessages = await prisma.message.findMany({
                where: {
                    source: "REVIEW",
                    deletedAt: { not: null },
                },
                select: {
                    id: true,
                    metadata: true,
                },
            })
            deletedReviewMessages.forEach((message) => {
                if (message.id.startsWith("review_")) {
                    deletedReviewIds.add(message.id.replace("review_", ""))
                }
                if (message.metadata) {
                    try {
                        const parsed = JSON.parse(message.metadata) as { productReviewId?: string }
                        if (parsed.productReviewId) {
                            deletedReviewIds.add(parsed.productReviewId)
                        }
                    } catch {
                        // ignore malformed metadata
                    }
                }
            })

            let transformedLegacyReviews: Array<{
                id: string
                source: string
                status: string
                name: string
                email: string | null
                phone: null
                subject: string
                content: string
                preview: string
                receivedAt: Date
                createdAt: Date
                updatedAt: Date
                metadata: {
                    productReviewId: string
                    productId: string
                    productSlug: string
                    productTitle: string
                    rating: number
                }
            }> = []

            // ProductReview records are legacy and only represent unread entries.
            if (!status || status === "ALL" || status === "NEW") {
                const productReview = (
                    prisma as unknown as {
                        productReview?: {
                            findMany: (args: Prisma.ProductReviewFindManyArgs) => Promise<Array<{
                                id: string
                                productId: string
                                name: string
                                email: string | null
                                rating: number
                                comment: string
                                createdAt: Date
                                updatedAt: Date
                                product: { id: string; slug: string; title: string }
                            }>>
                        }
                    }
                ).productReview

                if (productReview && typeof productReview.findMany === "function") {
                    const reviewWhere: Prisma.ProductReviewWhereInput = {}
                    if (q && q.trim()) {
                        reviewWhere.OR = [
                            { name: { contains: q } },
                            { email: { contains: q } },
                            { comment: { contains: q } },
                            { product: { title: { contains: q } } },
                        ]
                    }
                    if (from || to) {
                        const createdAtFilter: Prisma.DateTimeFilter = {}
                        if (from) createdAtFilter.gte = new Date(from)
                        if (to) createdAtFilter.lte = new Date(to)
                        reviewWhere.createdAt = createdAtFilter
                    }

                    const legacyReviews = await productReview.findMany({
                        where: reviewWhere,
                        orderBy: { createdAt: "desc" },
                        include: {
                            product: {
                                select: { id: true, slug: true, title: true },
                            },
                        },
                    })

                    transformedLegacyReviews = legacyReviews
                        .filter((review) => !linkedReviewIds.has(review.id) && !deletedReviewIds.has(review.id))
                        .map((review) => ({
                            id: `review_${review.id}`,
                            source: "REVIEW",
                            status: "NEW",
                            name: review.name,
                            email: review.email,
                            phone: null,
                            subject: `Review for ${review.product.title}`,
                            content: review.comment,
                            preview: review.comment.substring(0, 100) + (review.comment.length > 100 ? "..." : ""),
                            receivedAt: review.createdAt,
                            createdAt: review.createdAt,
                            updatedAt: review.updatedAt,
                            metadata: {
                                productReviewId: review.id,
                                productId: review.productId,
                                productSlug: review.product.slug,
                                productTitle: review.product.title,
                                rating: review.rating,
                            },
                        }))
                }
            }

            const combinedReviews = [...transformedReviewMessages, ...transformedLegacyReviews].sort((a, b) =>
                new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
            )
            const total = combinedReviews.length
            const paginatedReviews = combinedReviews.slice(skip, skip + pageSize)

            return NextResponse.json({
                data: paginatedReviews,
                meta: {
                    total,
                    page,
                    pageSize,
                    totalPages: Math.ceil(total / pageSize),
                },
            })
        }

        // Build where clause
        const where: Prisma.MessageWhereInput = {
            deletedAt: null, // Exclude soft-deleted messages
        }

        // Filter by source
        if (source && source !== "ALL") {
            where.source = source
        }

        // Filter by status
        if (status && status !== "ALL") {
            where.status = status
        }

        // Search across multiple fields
        if (q && q.trim()) {
            where.OR = [
                { name: { contains: q } },
                { email: { contains: q } },
                { phone: { contains: q } },
                { subject: { contains: q } },
                { content: { contains: q } },
            ]
        }

        // Date range filter
        if (from || to) {
            const receivedAtFilter: Prisma.DateTimeFilter = {}
            if (from) {
                receivedAtFilter.gte = new Date(from)
            }
            if (to) {
                receivedAtFilter.lte = new Date(to)
            }
            where.receivedAt = receivedAtFilter
        }

        if (country && country !== "ALL" && (!source || source === "ALL")) {
            const escapedCountry = JSON.stringify(country).slice(1, -1)
            where.AND = [
                ...(Array.isArray(where.AND) ? where.AND : []),
                {
                    source: "CUSTOMER",
                    metadata: { contains: `"country":"${escapedCountry}"` },
                },
            ]
        }

        // Calculate pagination
        const skip = (page - 1) * pageSize

        // Fetch messages and total count
        const [messages, total] = await Promise.all([
            prisma.message.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { receivedAt: "desc" },
                select: {
                    id: true,
                    source: true,
                    status: true,
                    name: true,
                    email: true,
                    phone: true,
                    subject: true,
                    content: true,
                    receivedAt: true,
                    createdAt: true,
                    updatedAt: true,
                },
            }),
            prisma.message.count({ where }),
        ])

        // Transform messages for list view (truncate content for preview)
        const transformedMessages = messages.map((msg) => ({
            ...msg,
            preview: msg.content.substring(0, 100) + (msg.content.length > 100 ? "..." : ""),
        }))

        return NextResponse.json({
            data: transformedMessages,
            meta: {
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
            },
        })
    } catch (error) {
        console.error("[Admin Messages API] Error fetching messages:", error)
        return NextResponse.json(
            { error: "Failed to fetch messages" },
            { status: 500 }
        )
    }
}
