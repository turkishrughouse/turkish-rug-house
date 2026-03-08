import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { messageBulkActionSchema } from "@/lib/validations/message"
import { addBlockedSenders, removeBlockedSenders } from "@/lib/message-blocklist"

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

type ReviewInfo = {
  id: string
  productId: string
  productTitle: string
  productSlug: string
  name: string
  email: string | null
  comment: string
  rating: number
  createdAt: Date
}

async function getReviewInfo(messageId: string): Promise<ReviewInfo | null> {
  if (!messageId.startsWith("review_")) return null
  const reviewId = messageId.replace("review_", "")
  const review = await prisma.productReview.findUnique({
    where: { id: reviewId },
    include: {
      product: {
        select: { id: true, title: true, slug: true },
      },
    },
  })
  if (!review) return null
  return {
    id: review.id,
    productId: review.productId,
    productTitle: review.product.title,
    productSlug: review.product.slug,
    name: review.name,
    email: review.email,
    comment: review.comment,
    rating: review.rating,
    createdAt: review.createdAt,
  }
}

async function upsertReviewMessage(messageId: string, review: ReviewInfo, data: { status?: string; deletedAt?: Date | null }) {
  return prisma.message.upsert({
    where: { id: messageId },
    create: {
      id: messageId,
      source: "REVIEW",
      status: data.status || "OPEN",
      name: review.name,
      email: review.email,
      subject: `Review for ${review.productTitle}`,
      content: review.comment,
      metadata: JSON.stringify({
        productReviewId: review.id,
        productId: review.productId,
        productSlug: review.productSlug,
        productTitle: review.productTitle,
        rating: review.rating,
      }),
      receivedAt: review.createdAt,
      createdAt: review.createdAt,
      deletedAt: data.deletedAt,
    },
    update: {
      status: data.status ?? undefined,
      deletedAt: data.deletedAt ?? undefined,
    },
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = messageBulkActionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 400 })
    }

    const { ids, action } = parsed.data
    const now = new Date()
    let processed = 0
    let failed = 0

    const normalIds = ids.filter((id) => !id.startsWith("review_"))
    const reviewIds = ids.filter((id) => id.startsWith("review_"))

    const emailsToBlock = new Set<string>()
    const phonesToBlock = new Set<string>()
    const emailsToUnblock = new Set<string>()
    const phonesToUnblock = new Set<string>()

    if (action === "block" || action === "unblock") {
      const normalMessages = normalIds.length
        ? await prisma.message.findMany({
            where: { id: { in: normalIds }, deletedAt: null },
            select: { email: true, phone: true },
          })
        : []
      normalMessages.forEach((item) => {
        if (action === "block") {
          if (item.email) emailsToBlock.add(item.email)
          if (item.phone) phonesToBlock.add(item.phone)
        } else {
          if (item.email) emailsToUnblock.add(item.email)
          if (item.phone) phonesToUnblock.add(item.phone)
        }
      })
    }

    if (normalIds.length > 0) {
      const targetRows = await prisma.message.findMany({
        where: { id: { in: normalIds }, deletedAt: null },
        select: { id: true, source: true, metadata: true },
      })

      const customerUserIds = new Set<string>()
      const effectiveNormalIds = new Set<string>()
      targetRows.forEach((row) => {
        if (row.source === "CUSTOMER") {
          const metadata = parseMetadata(row.metadata)
          const userId = typeof metadata.userId === "string" ? metadata.userId : ""
          if (userId) customerUserIds.add(userId)
          else effectiveNormalIds.add(row.id)
          return
        }
        effectiveNormalIds.add(row.id)
      })

      const emailThreadAnchors = targetRows.filter((row) => row.source === "EMAIL").map((row) => row.id)
      for (const anchorId of emailThreadAnchors) {
        const anchor = await prisma.message.findUnique({
          where: { id: anchorId },
          select: { id: true, source: true, email: true, subject: true, deletedAt: true },
        })
        if (!anchor || anchor.deletedAt || anchor.source !== "EMAIL" || !anchor.email) continue
        const subjectKey = normalizeEmailSubject(anchor.subject)
        const threadRows = await prisma.message.findMany({
          where: {
            source: "EMAIL",
            deletedAt: null,
            email: anchor.email.toLowerCase(),
          },
          select: { id: true, email: true, phone: true, subject: true },
        })
        threadRows
          .filter((row) => normalizeEmailSubject(row.subject) === subjectKey)
          .forEach((row) => {
            effectiveNormalIds.add(row.id)
            if (action === "block") {
              if (row.email) emailsToBlock.add(row.email)
              if (row.phone) phonesToBlock.add(row.phone)
            } else if (action === "unblock") {
              if (row.email) emailsToUnblock.add(row.email)
              if (row.phone) phonesToUnblock.add(row.phone)
            }
          })
      }

      if (customerUserIds.size > 0) {
        const customerRows = await prisma.message.findMany({
          where: {
            source: "CUSTOMER",
            deletedAt: null,
            OR: Array.from(customerUserIds).map((userId) => ({
              metadata: { contains: `"userId":"${userId}"` },
            })),
          },
          select: { id: true, email: true, phone: true },
        })
        customerRows.forEach((row) => {
          effectiveNormalIds.add(row.id)
          if (action === "block") {
            if (row.email) emailsToBlock.add(row.email)
            if (row.phone) phonesToBlock.add(row.phone)
          } else if (action === "unblock") {
            if (row.email) emailsToUnblock.add(row.email)
            if (row.phone) phonesToUnblock.add(row.phone)
          }
        })
      }

      const effectiveIds = Array.from(effectiveNormalIds)
      if (effectiveIds.length === 0) {
        // no-op
      } else if (action === "mark_read") {
        const result = await prisma.message.updateMany({
          where: { id: { in: effectiveIds }, deletedAt: null },
          data: { status: "RESOLVED" },
        })
        processed += result.count
      } else if (action === "delete") {
        const result = await prisma.message.updateMany({
          where: { id: { in: effectiveIds }, deletedAt: null },
          data: { deletedAt: now },
        })
        processed += result.count
      } else if (action === "block") {
        const result = await prisma.message.updateMany({
          where: { id: { in: effectiveIds }, deletedAt: null },
          data: { status: "BLOCKED" },
        })
        processed += result.count
      } else if (action === "unblock") {
        const result = await prisma.message.updateMany({
          where: { id: { in: effectiveIds }, deletedAt: null },
          data: { status: "OPEN" },
        })
        processed += result.count
      }
    }

    for (const reviewMessageId of reviewIds) {
      const review = await getReviewInfo(reviewMessageId)
      if (!review) {
        failed += 1
        continue
      }

      if (action === "block" && review.email) {
        emailsToBlock.add(review.email)
      }
      if (action === "unblock" && review.email) {
        emailsToUnblock.add(review.email)
      }

      if (action === "mark_read") {
        await upsertReviewMessage(reviewMessageId, review, { status: "RESOLVED", deletedAt: null })
      } else if (action === "delete") {
        await deleteProductReview(review.id)
        await upsertReviewMessage(reviewMessageId, review, { deletedAt: now })
      } else if (action === "block") {
        await upsertReviewMessage(reviewMessageId, review, { status: "BLOCKED", deletedAt: null })
      } else if (action === "unblock") {
        await upsertReviewMessage(reviewMessageId, review, { status: "OPEN", deletedAt: null })
      }

      processed += 1
    }

    if (action === "block" && (emailsToBlock.size > 0 || phonesToBlock.size > 0)) {
      await addBlockedSenders({
        emails: Array.from(emailsToBlock),
        phones: Array.from(phonesToBlock),
      })
    }
    if (action === "unblock" && (emailsToUnblock.size > 0 || phonesToUnblock.size > 0)) {
      await removeBlockedSenders({
        emails: Array.from(emailsToUnblock),
        phones: Array.from(phonesToUnblock),
      })
    }

    return NextResponse.json({
      success: true,
      processed,
      failed,
      action,
      blockedSenders:
        action === "block"
          ? { emails: emailsToBlock.size, phones: phonesToBlock.size }
          : action === "unblock"
            ? { emails: emailsToUnblock.size, phones: phonesToUnblock.size }
            : undefined,
    })
  } catch (error) {
    console.error("[Admin Messages Bulk API] Error:", error)
    return NextResponse.json({ error: "Failed to process bulk action" }, { status: 500 })
  }
}

async function deleteProductReview(reviewId: string) {
  await prisma.productReview.delete({
    where: { id: reviewId },
  }).catch(() => undefined)
}
