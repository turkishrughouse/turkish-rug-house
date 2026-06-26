import { prisma } from "@/lib/db"
import { getSingleOrderDetails, saveOrderDetails } from "@/lib/order-details"
import { notifyOrderUpdate } from "@/lib/customer-messaging"
import { grantReviewRightForOrder } from "@/lib/review-access"

const IS_POSTGRES = process.env.DATABASE_URL?.startsWith("postgresql") ?? false

export async function nextOrderNumber() {
  if (IS_POSTGRES) {
    const rows = await prisma.$queryRaw<[{ nextval: bigint }]>`
      SELECT nextval('order_number_seq')
    `
    const next = Number(rows[0].nextval)
    return `TRH-${String(next).padStart(3, "0")}`
  }

  // SQLite (dev)
  const rows = await prisma.$queryRaw<[{ value: number }]>`
    INSERT INTO "OrderCounter" ("id", "value") VALUES ('singleton', 1)
    ON CONFLICT("id") DO UPDATE SET value = value + 1
    RETURNING value
  `
  const next = Number(rows[0]?.value ?? 1)
  return `TRH-${String(next).padStart(3, "0")}`
}

export async function finalizePaidOrder(input: {
  orderId: string
  paymentMethod: string
  paymentReference: string
  eventDescription: string
  paymentSessionId?: string | null
  paymentIntentId?: string | null
  webhookEventId?: string | null
}) {
  const existing = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { items: true },
  })

  if (!existing) {
    throw new Error("Order not found")
  }

  let transitionedToPaid = false

  await prisma.$transaction(async (tx) => {
    const currentOrder = await tx.order.findUnique({
      where: { id: input.orderId },
      include: { items: true },
    })

    if (!currentOrder) {
      throw new Error("Order not found")
    }

    const terminalStatuses = ["PAID", "REFUNDED", "CANCELLED", "EXPIRED"]
    if (terminalStatuses.includes(String(currentOrder.status).toUpperCase())) {
      return
    }

    // Stock was already decremented at checkout init — only update status here.
    await tx.order.update({
      where: { id: input.orderId },
      data: { status: "PAID" },
    })

    await tx.orderEvent.create({
      data: {
        orderId: input.orderId,
        type: "PAYMENT",
        title: "Payment received",
        description: input.eventDescription,
        actorType: "SYSTEM",
        isAdmin: false,
      },
    })

    transitionedToPaid = true
  })

  await saveOrderDetails(input.orderId, {
    paymentStatus: "PAID",
    paymentMethod: input.paymentMethod,
    paymentProvider: input.paymentMethod,
    paymentReference: input.paymentReference,
    paymentSessionId: input.paymentSessionId || null,
    paymentIntentId: input.paymentIntentId || null,
    paymentLastEventId: input.webhookEventId || null,
    invoiceIssuedAt: new Date().toISOString(),
  })

  if (transitionedToPaid) {
    await notifyOrderUpdate(
      input.orderId,
      "Order received",
      `Your payment for ${existing.orderNumber} was completed.`,
      "/account",
      "CREATE"
    )
    await grantReviewRightForOrder(input.orderId)
  }

  return existing.orderNumber
}

export async function markOrderPaymentFailed(input: {
  orderId: string
  paymentMethod: string
  paymentReference?: string | null
  paymentSessionId?: string | null
  paymentIntentId?: string | null
  webhookEventId?: string | null
  eventDescription: string
}) {
  const existing = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
    },
  })

  if (!existing) {
    throw new Error("Order not found")
  }

  const normalizedStatus = String(existing.status || "PENDING").toUpperCase()
  if (normalizedStatus !== "PAID" && normalizedStatus !== "REFUNDED" && normalizedStatus !== "CANCELLED") {
    if (normalizedStatus !== "FAILED") {
      await prisma.order.update({
        where: { id: input.orderId },
        data: { status: "FAILED" },
      })
    }
    await prisma.orderEvent.create({
      data: {
        orderId: input.orderId,
        type: "PAYMENT",
        title: "Payment failed",
        description: input.eventDescription,
        actorType: "SYSTEM",
        isAdmin: false,
      },
    })
  }

  await saveOrderDetails(input.orderId, {
    paymentStatus: "FAILED",
    paymentMethod: input.paymentMethod,
    paymentProvider: input.paymentMethod,
    paymentReference: input.paymentReference || null,
    paymentSessionId: input.paymentSessionId || null,
    paymentIntentId: input.paymentIntentId || null,
    paymentLastEventId: input.webhookEventId || null,
  })

  return existing.orderNumber
}

export async function markOrderRefunded(input: {
  orderId: string
  paymentMethod: string
  paymentReference?: string | null
  paymentSessionId?: string | null
  paymentIntentId?: string | null
  webhookEventId?: string | null
  eventDescription: string
  refundedAmount?: number
  isFullRefund?: boolean
}) {
  const existing = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: {
      id: true,
      status: true,
      total: true,
    },
  })

  if (!existing) {
    throw new Error("Order not found")
  }

  const normalizedStatus = String(existing.status || "").toUpperCase()
  const nextRefundedAmount = Math.max(0, Number(input.refundedAmount || 0))
  const isFullRefund = Boolean(input.isFullRefund)

  if (isFullRefund && normalizedStatus !== "REFUNDED") {
    await prisma.order.update({
      where: { id: input.orderId },
      data: { status: "REFUNDED" },
    })
  }

  const title = isFullRefund ? "Payment refunded" : "Payment partially refunded"
  if (normalizedStatus !== "REFUNDED" || !isFullRefund) {
    await prisma.orderEvent.create({
      data: {
        orderId: input.orderId,
        type: "PAYMENT",
        title,
        description: input.eventDescription,
        actorType: "SYSTEM",
        isAdmin: false,
      },
    })
  }

  const existingDetails = await getSingleOrderDetails(input.orderId)
  await saveOrderDetails(input.orderId, {
    paymentStatus: isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED",
    paymentMethod: input.paymentMethod,
    paymentProvider: input.paymentMethod,
    paymentReference: input.paymentReference || existingDetails.paymentReference,
    paymentSessionId: input.paymentSessionId || existingDetails.paymentSessionId,
    paymentIntentId: input.paymentIntentId || existingDetails.paymentIntentId,
    paymentLastEventId: input.webhookEventId || null,
    refundedAmount: nextRefundedAmount || existingDetails.refundedAmount || Number(existing.total),
  })
}
