import { prisma } from "@/lib/db"
import { getSingleOrderDetails, saveOrderDetails } from "@/lib/order-details"
import { notifyOrderUpdate } from "@/lib/customer-messaging"
import { grantReviewRightForOrder } from "@/lib/review-access"

export async function nextOrderNumber() {
  const latest = await prisma.order.findFirst({
    orderBy: { createdAt: "desc" },
    select: { orderNumber: true },
  })
  const lastNumber = latest?.orderNumber
    ? Number(String(latest.orderNumber).replace(/\D/g, ""))
    : 0
  const next = Number.isFinite(lastNumber) ? lastNumber + 1 : 1
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

    const isAlreadyPaid = String(currentOrder.status).toUpperCase() === "PAID"
    if (isAlreadyPaid) {
      return
    }

    for (const item of currentOrder.items) {
      if (!item.productId) continue
      const decremented = await tx.product.updateMany({
        where: {
          id: item.productId,
          isStock: true,
          stockCount: { gte: item.quantity },
        },
        data: {
          stockCount: { decrement: item.quantity },
        },
      })
      if (decremented.count === 0) {
        throw new Error(`Insufficient stock for ${item.title}`)
      }

      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: { id: true, stockCount: true, isStock: true },
      })
      if (product && product.stockCount <= 0 && product.isStock) {
        await tx.product.update({
          where: { id: product.id },
          data: { isStock: false },
        })
      }
    }

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
