import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { messageEvents } from "@/lib/message-events"
import { Prisma } from "@prisma/client"
import { randomUUID } from "crypto"
import { isSenderBlocked } from "@/lib/message-blocklist"
import { getSessionUser } from "@/lib/auth-server"

const PURCHASE_REQUIRED_MESSAGE = "You should buy a product to write a review"

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "??"
  const first = parts[0]?.[0] || "?"
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] || "?") : (parts[0]?.[1] || "?")
  return `${first}${last}`.toUpperCase()
}

function average(items: { rating: number }[]) {
  if (!items.length) return 0
  const total = items.reduce((sum, item) => sum + item.rating, 0)
  return Number((total / items.length).toFixed(1))
}

type ProductReviewDelegate = {
  findMany?: (args: Prisma.ProductReviewFindManyArgs) => Promise<Array<{
    id?: string
    productId?: string
    name?: string
    rating: number
    comment?: string
    photoUrl?: string | null
    createdAt?: Date
  }>>
  create?: (args: Prisma.ProductReviewCreateArgs) => Promise<{ id: string }>
  delete?: (args: Prisma.ProductReviewDeleteArgs) => Promise<{ id: string }>
}

type MessageDelegate = {
  create?: (args: Prisma.MessageCreateArgs) => Promise<{
    id: string
    source: string
    status: string
    name: string | null
    email: string | null
    phone: string | null
    subject: string | null
    content: string
    receivedAt: Date
  }>
}

function getProductReviewDelegate(): ProductReviewDelegate {
  return (prisma as unknown as { productReview?: ProductReviewDelegate }).productReview || {}
}

function getMessageDelegate(): MessageDelegate {
  return (prisma as unknown as { message?: MessageDelegate }).message || {}
}

function normalizeDate(value: Date | string | null | undefined) {
  if (!value) return new Date()
  return value instanceof Date ? value : new Date(value)
}

async function findReviewRatingsByProductIds(productIds: string[]) {
  const productReview = getProductReviewDelegate()

  if (typeof productReview.findMany === "function") {
    const rows = await productReview.findMany({
      where: { productId: { in: productIds }, email: null },
      select: { productId: true, rating: true },
    })

    return rows.map((row) => ({
      productId: String(row.productId || ""),
      rating: Number(row.rating || 0),
    }))
  }

  const rows = await prisma.$queryRaw<Array<{ productId: string; rating: number }>>(
    Prisma.sql`SELECT "productId", "rating" FROM "ProductReview" WHERE "productId" IN (${Prisma.join(productIds)}) AND "email" IS NULL`
  )

  return rows.map((row) => ({
    productId: String(row.productId || ""),
    rating: Number(row.rating || 0),
  }))
}

async function findReviewsByProductId(productId: string) {
  const productReview = getProductReviewDelegate()

  if (typeof productReview.findMany === "function") {
    const rows = await productReview.findMany({
      where: { productId, email: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        rating: true,
        comment: true,
        photoUrl: true,
        createdAt: true,
      },
    })

    return rows.map((row) => ({
      id: String(row.id || ""),
      name: String(row.name || ""),
      rating: Number(row.rating || 0),
      comment: String(row.comment || ""),
      photoUrl: typeof row.photoUrl === "string" ? row.photoUrl : null,
      createdAt: normalizeDate(row.createdAt),
    }))
  }

  const rows = await prisma.$queryRaw<Array<{
    id: string
    name: string
    rating: number
    comment: string
    photoUrl: string | null
    createdAt: Date | string
  }>>(
    Prisma.sql`
      SELECT "id", "name", "rating", "comment", "photoUrl", "createdAt"
      FROM "ProductReview"
      WHERE "productId" = ${productId}
        AND "email" IS NULL
      ORDER BY "createdAt" DESC
    `
  )

  return rows.map((row) => ({
    id: String(row.id || ""),
    name: String(row.name || ""),
    rating: Number(row.rating || 0),
    comment: String(row.comment || ""),
    photoUrl: row.photoUrl ? String(row.photoUrl) : null,
    createdAt: normalizeDate(row.createdAt),
  }))
}

async function createProductReview(data: {
  id: string
  productId: string
  name: string
  email: string | null
  rating: number
  comment: string
  photoUrl: string | null
}) {
  const productReview = getProductReviewDelegate()

  if (typeof productReview.create === "function") {
    const created = await productReview.create({
      data,
      select: { id: true },
    })
    return { id: created.id }
  }

  const now = new Date()
  await prisma.$executeRaw`
    INSERT INTO "ProductReview" ("id", "productId", "name", "email", "rating", "comment", "photoUrl", "createdAt", "updatedAt")
    VALUES (${data.id}, ${data.productId}, ${data.name}, ${data.email}, ${data.rating}, ${data.comment}, ${data.photoUrl}, ${now}, ${now})
  `

  return { id: data.id }
}

function normalizeEmail(input: string) {
  return String(input || "").trim().toLowerCase()
}

async function canSubmitReview(email: string) {
  const purchaseRows = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*) as count
    FROM "Order"
    WHERE lower("customerEmail") = ${email}
      AND "status" != 'CANCELLED'
  `
  const purchaseCount = Number(purchaseRows?.[0]?.count || 0)
  if (purchaseCount < 1) {
    return { ok: false as const, message: PURCHASE_REQUIRED_MESSAGE }
  }

  const access = await prisma.reviewAccess.findUnique({ where: { email } })
  if (!access || !access.approved || access.remainingReviews < 1) {
    return {
      ok: false as const,
      message: access?.approved ? "Your review right is finished. Please contact support." : "Your review access is pending admin approval.",
    }
  }

  return { ok: true as const, accessId: access.id }
}

async function deleteProductReview(reviewId: string) {
  const productReview = getProductReviewDelegate()

  if (typeof productReview.delete === "function") {
    await productReview.delete({ where: { id: reviewId } })
    return
  }

  await prisma.$executeRaw`DELETE FROM "ProductReview" WHERE "id" = ${reviewId}`
}

async function createReviewMessage(data: {
  name: string
  email: string | null
  comment: string
  rating: number
  productTitle: string
  productSlug: string
  productId: string
  productReviewId: string
}) {
  const messageData = {
    source: "REVIEW",
    status: "NEW",
    name: data.name,
    email: data.email,
    subject: `New review for ${data.productTitle}`,
    content: data.comment,
    metadata: JSON.stringify({
      productReviewId: data.productReviewId,
      productId: data.productId,
      productSlug: data.productSlug,
      productTitle: data.productTitle,
      rating: data.rating,
      initials: initialsFromName(data.name),
    }),
  } satisfies Prisma.MessageCreateInput

  const message = getMessageDelegate()
  if (typeof message.create === "function") {
    return message.create({ data: messageData })
  }

  const id = randomUUID().replace(/-/g, "")
  const now = new Date()
  await prisma.$executeRaw`
    INSERT INTO "Message" ("id", "source", "status", "name", "email", "subject", "content", "metadata", "receivedAt", "createdAt", "updatedAt")
    VALUES (${id}, ${"REVIEW"}, ${"NEW"}, ${data.name}, ${data.email}, ${`New review for ${data.productTitle}`}, ${data.comment}, ${messageData.metadata}, ${now}, ${now}, ${now})
  `

  return {
    id,
    source: "REVIEW",
    status: "NEW",
    name: data.name,
    email: data.email,
    phone: null,
    subject: `New review for ${data.productTitle}`,
    content: data.comment,
    receivedAt: now,
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const productId = searchParams.get("productId")
    const productIdsParam = searchParams.get("productIds")

    if (productIdsParam) {
      const productIds = productIdsParam.split(",").map((v) => v.trim()).filter(Boolean)
      if (productIds.length === 0) return NextResponse.json({ summaries: {} })

      const rows = await findReviewRatingsByProductIds(productIds)

      const grouped = new Map<string, number[]>()
      for (const id of productIds) grouped.set(id, [])
      rows.forEach((row) => {
        const list = grouped.get(row.productId) || []
        list.push(row.rating)
        grouped.set(row.productId, list)
      })

      const summaries: Record<string, { average: number; count: number }> = {}
      for (const [id, ratings] of grouped.entries()) {
        const count = ratings.length
        summaries[id] = {
          average: count ? Number((ratings.reduce((a, b) => a + b, 0) / count).toFixed(1)) : 0,
          count,
        }
      }

      return NextResponse.json({ summaries })
    }

    if (!productId) {
      return NextResponse.json({ error: "productId or productIds is required" }, { status: 400 })
    }

    const reviews = await findReviewsByProductId(productId)

    return NextResponse.json({
      summary: {
        average: average(reviews),
        count: reviews.length,
      },
      reviews: reviews.map((review) => ({
        id: review.id,
        initials: initialsFromName(review.name),
        rating: review.rating,
        comment: review.comment,
        photoUrl: review.photoUrl,
        createdAt: review.createdAt,
      })),
    })
  } catch (error) {
    console.error("GET /api/public/reviews error:", error)
    return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser("customer")
    if (!sessionUser || sessionUser.role !== "CUSTOMER") {
      return NextResponse.json({ error: "Please sign in from your customer account to write a review." }, { status: 401 })
    }
    const body = await req.json()
    const productId = String(body.productId || "")
    const name = String(body.name || "").trim()
    const email = normalizeEmail(sessionUser.email)
    const comment = String(body.comment || "").trim()
    const photoUrlRaw = String(body.photoUrl || "").trim()
    const photoUrl = photoUrlRaw.length > 0 ? photoUrlRaw : null
    const ratingRaw = Number(body.rating || 0)
    const rating = Math.min(5, Math.max(1, Math.round(ratingRaw)))

    if (!productId || !name || !comment) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }
    if (comment.length < 3) {
      return NextResponse.json({ error: "Comment is too short" }, { status: 400 })
    }
    if (name.length < 2) {
      return NextResponse.json({ error: "Name is too short" }, { status: 400 })
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 })
    }
    if (email && await isSenderBlocked(email, null)) {
      return NextResponse.json({ success: true, blocked: true }, { status: 202 })
    }

    const productExists = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, title: true, slug: true },
    })
    if (!productExists) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    const eligibility = await canSubmitReview(email)
    if (!eligibility.ok) {
      return NextResponse.json({ error: eligibility.message }, { status: 403 })
    }

    const reviewId = randomUUID().replace(/-/g, "")
    const createdReview = await createProductReview({
      id: reviewId,
      productId,
      name,
      email,
      rating,
      comment,
      photoUrl,
    })

    try {
      await prisma.reviewAccess.update({
        where: { id: eligibility.accessId },
        data: { remainingReviews: { decrement: 1 } },
      })

      const createdMessage = await createReviewMessage({
        name,
        email,
        comment,
        rating,
        productTitle: productExists.title,
        productSlug: productExists.slug,
        productId,
        productReviewId: createdReview.id,
      })

      messageEvents.broadcastNewMessage(createdMessage)

      return NextResponse.json(
        { success: true, id: createdReview.id, messageCreated: true },
        { status: 201 }
      )
    } catch (messageError) {
      console.error("POST /api/public/reviews message-create error:", messageError)
      try {
        await deleteProductReview(createdReview.id)
        await prisma.reviewAccess.update({
          where: { id: eligibility.accessId },
          data: { remainingReviews: { increment: 1 } },
        })
      } catch (rollbackError) {
        console.error("POST /api/public/reviews rollback error:", rollbackError)
      }
      return NextResponse.json(
        { error: "Could not submit review right now. Please try again." },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("POST /api/public/reviews error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add review" },
      { status: 500 }
    )
  }
}
