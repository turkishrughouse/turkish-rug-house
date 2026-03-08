import { prisma } from "@/lib/db"
import { createCustomerMessage } from "@/lib/customer-messaging"

function normalizeEmail(input: string | null | undefined) {
  return String(input || "").trim().toLowerCase()
}

export async function grantReviewRightForOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      userId: true,
      customerEmail: true,
    },
  })

  if (!order || order.status === "CANCELLED") return { granted: false as const, reason: "order_not_eligible" }

  const existingEvent = await prisma.orderEvent.findFirst({
    where: {
      orderId,
      type: "REVIEW_ACCESS",
    },
    select: { id: true },
  })
  if (existingEvent) return { granted: false as const, reason: "already_granted" }

  const fallbackEmail = normalizeEmail(order.customerEmail)
  if (!fallbackEmail) return { granted: false as const, reason: "missing_email" }

  const user = order.userId
    ? await prisma.user.findUnique({ where: { id: order.userId }, select: { id: true, role: true, email: true } })
    : await prisma.user.findFirst({
        where: { email: { equals: fallbackEmail }, role: "CUSTOMER" },
        select: { id: true, role: true, email: true },
      })

  if (!user || user.role !== "CUSTOMER") {
    return { granted: false as const, reason: "no_registered_customer" }
  }

  const email = normalizeEmail(user.email || fallbackEmail)
  if (!email) return { granted: false as const, reason: "missing_user_email" }

  const now = new Date()
  await prisma.reviewAccess.upsert({
    where: { email },
    update: {
      userId: user.id,
      approved: true,
      approvedAt: now,
      approvedBy: "SYSTEM",
      remainingReviews: { increment: 1 },
    },
    create: {
      email,
      userId: user.id,
      approved: true,
      approvedAt: now,
      approvedBy: "SYSTEM",
      remainingReviews: 1,
      notes: "Auto-approved after successful purchase",
    },
  })

  await prisma.orderEvent.create({
    data: {
      orderId,
      type: "REVIEW_ACCESS",
      title: "Review right granted",
      description: "Customer received one review right after purchase.",
      actorType: "SYSTEM",
      isAdmin: false,
    },
  })

  await createCustomerMessage(user.id, {
    kind: "SYSTEM",
    title: "Please share your positive review",
    content: `Thank you for your purchase (${order.orderNumber}). You now have one review right. Please share your positive feedback from My Account > Reviews.`,
    ctaLabel: "Write review",
    ctaUrl: "/account?tab=reviews",
    metadata: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      action: "REVIEW_ACCESS_GRANTED",
    },
    orderId: order.id,
  })

  return { granted: true as const }
}

export async function reconcileReviewAccessForUser(userId: string, emailInput: string) {
  const email = normalizeEmail(emailInput)
  if (!email) return { eligibleOrders: 0, usedReviews: 0, remainingReviews: 0, approved: false }

  const [eligibleOrderCount, usedReviews, existingAccess] = await Promise.all([
    prisma.order.count({
      where: {
        OR: [{ userId }, { customerEmail: { equals: email } }],
        status: { notIn: ["CANCELLED", "REFUNDED"] },
      },
    }),
    prisma.productReview.count({ where: { email } }),
    prisma.reviewAccess.findUnique({ where: { email } }),
  ])

  const expectedRemaining = Math.max(0, eligibleOrderCount - usedReviews)
  const approved = eligibleOrderCount > 0

  const saved = await prisma.reviewAccess.upsert({
    where: { email },
    update: {
      userId,
      approved,
      approvedAt: approved ? (existingAccess?.approvedAt || new Date()) : null,
      approvedBy: approved ? (existingAccess?.approvedBy || "SYSTEM") : null,
      remainingReviews: expectedRemaining,
      notes: approved
        ? "Auto-adjusted by order/review balance"
        : "No eligible (non-cancelled) orders found",
    },
    create: {
      email,
      userId,
      approved,
      approvedAt: approved ? new Date() : null,
      approvedBy: approved ? "SYSTEM" : null,
      remainingReviews: expectedRemaining,
      notes: approved
        ? "Auto-adjusted by order/review balance"
        : "No eligible (non-cancelled) orders found",
    },
  })

  return {
    eligibleOrders: eligibleOrderCount,
    usedReviews,
    remainingReviews: saved.remainingReviews,
    approved: saved.approved,
  }
}
