import { prisma } from "@/lib/db"

type OrderThreadType = "customer" | "system" | "tracking"

type OrderOwnership = {
  id: string
  orderNumber: string
  customerEmail: string
  customerName: string | null
  status: string
  shipmentStatus: string
  userId: string | null
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export function isOrderMessagingOpen(order: { status?: string | null; shipmentStatus?: string | null }) {
  const status = String(order.status || "").trim().toUpperCase()
  const shipmentStatus = String(order.shipmentStatus || "").trim().toUpperCase()
  return status !== "DELIVERED" && shipmentStatus !== "DELIVERED"
}

export async function ensureOrderMessagingState(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      shipmentStatus: true,
    },
  })
  if (!order) return null

  return prisma.orderMessagingState.upsert({
    where: { orderId },
    create: {
      orderId,
      messagingOpen: isOrderMessagingOpen(order),
    },
    update: {
      messagingOpen: isOrderMessagingOpen(order),
    },
  })
}

export async function syncOrderMessagingState(orderId: string) {
  return ensureOrderMessagingState(orderId)
}

async function getOrderOwnership(orderId: string): Promise<OrderOwnership | null> {
  return prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      customerEmail: true,
      customerName: true,
      status: true,
      shipmentStatus: true,
      userId: true,
    },
  })
}

export async function customerOwnsOrder(orderId: string, userId: string, email: string) {
  const order = await getOrderOwnership(orderId)
  if (!order) return null
  const matchesUser = order.userId === userId
  const matchesEmail = normalizeEmail(order.customerEmail) === normalizeEmail(email)
  return matchesUser || matchesEmail ? order : null
}

export async function createOrderMessage(input: {
  orderId: string
  userId?: string | null
  message: string
  type: OrderThreadType
  enforceOpen?: boolean
}) {
  const order = await getOrderOwnership(input.orderId)
  if (!order) {
    throw new Error("Order not found")
  }

  const state = await ensureOrderMessagingState(input.orderId)
  if (input.enforceOpen !== false && !state?.messagingOpen && input.type === "customer") {
    throw new Error("Messaging for this order is closed.")
  }

  return prisma.orderMessage.create({
    data: {
      orderId: input.orderId,
      userId: input.userId || null,
      message: input.message.trim(),
      type: input.type,
    },
  })
}

async function findOrderUser(order: OrderOwnership) {
  if (order.userId) {
    const user = await prisma.user.findUnique({
      where: { id: order.userId },
      select: { id: true, email: true, name: true },
    })
    if (user) return user
  }

  return prisma.user.findUnique({
    where: { email: normalizeEmail(order.customerEmail) },
    select: { id: true, email: true, name: true },
  })
}

export async function mirrorOrderCustomerMessageToAdminInbox(input: {
  orderId: string
  content: string
  userId: string
}) {
  const order = await getOrderOwnership(input.orderId)
  if (!order) return null
  const user = await findOrderUser(order)

  return prisma.message.create({
    data: {
      source: "CUSTOMER",
      status: "NEW",
      name: order.customerName || user?.name || order.customerEmail,
      email: order.customerEmail,
      subject: `Order ${order.orderNumber} message`,
      content: input.content.trim(),
      metadata: JSON.stringify({
        orderId: order.id,
        orderNumber: order.orderNumber,
        userId: input.userId,
        sender: "CUSTOMER",
        messageKind: "ORDER_THREAD",
      }),
    },
  })
}

export async function createOrderSystemMessage(orderId: string, message: string, type: Exclude<OrderThreadType, "customer"> = "system") {
  return createOrderMessage({
    orderId,
    message,
    type,
    enforceOpen: false,
  })
}

export async function listOrderThreadsForCustomer(userId: string, email: string) {
  const orders = await prisma.order.findMany({
    where: {
      OR: [{ userId }, { customerEmail: normalizeEmail(email) }],
    },
    orderBy: { createdAt: "desc" },
    include: {
      messagingState: true,
      items: {
        select: {
          id: true,
          title: true,
          productId: true,
        },
      },
      orderMessages: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
    take: 100,
  })

  return Promise.all(
    orders.map(async (order) => {
      const state = order.messagingState || (await ensureOrderMessagingState(order.id))
      const trackingMessages = order.orderMessages.filter((item) => item.type === "tracking")
      const latestMessage = order.orderMessages[0] || null

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        shipmentStatus: order.shipmentStatus,
        messagingOpen: Boolean(state?.messagingOpen),
        trackingMessages: trackingMessages.map((item) => ({
          id: item.id,
          message: item.message,
          createdAt: item.createdAt,
          type: item.type,
        })),
        latestMessage: latestMessage
          ? {
              id: latestMessage.id,
              message: latestMessage.message,
              createdAt: latestMessage.createdAt,
              type: latestMessage.type,
            }
          : null,
        items: order.items.map((item) => ({
          id: item.id,
          title: item.title,
          productId: item.productId,
        })),
      }
    })
  )
}

export async function getOrderThreadForCustomer(orderId: string, userId: string, email: string) {
  const ownedOrder = await customerOwnsOrder(orderId, userId, email)
  if (!ownedOrder) return null

  const [state, messages] = await Promise.all([
    ensureOrderMessagingState(orderId),
    prisma.orderMessage.findMany({
      where: { orderId },
      orderBy: { createdAt: "asc" },
    }),
  ])

  return {
    orderId: ownedOrder.id,
    orderNumber: ownedOrder.orderNumber,
    status: ownedOrder.status,
    shipmentStatus: ownedOrder.shipmentStatus,
    messagingOpen: Boolean(state?.messagingOpen),
    messages,
  }
}

export async function getOrderThreadForAdmin(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      customerEmail: true,
      customerName: true,
      status: true,
      shipmentStatus: true,
      userId: true,
    },
  })
  if (!order) return null

  const [state, messages] = await Promise.all([
    ensureOrderMessagingState(orderId),
    prisma.orderMessage.findMany({
      where: { orderId },
      orderBy: { createdAt: "asc" },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    }),
  ])

  return {
    ...order,
    messagingOpen: Boolean(state?.messagingOpen),
    messages,
  }
}
