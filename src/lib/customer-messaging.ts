import { prisma } from "@/lib/db"
import { getSiteSettings } from "@/lib/site-settings"
import { sendSiteEmail } from "@/lib/mailer"

type MessageInput = {
  kind: "SYSTEM" | "ORDER" | "DISCOUNT" | "NEW_PRODUCT" | "NEW_CATEGORY"
  title: string
  content: string
  ctaLabel?: string
  ctaUrl?: string
  metadata?: Record<string, unknown>
  orderId?: string
}

export async function createCustomerMessage(userId: string, input: MessageInput) {
  return prisma.customerMessage.create({
    data: {
      userId,
      orderId: input.orderId || null,
      kind: input.kind,
      title: input.title,
      content: input.content,
      ctaLabel: input.ctaLabel || null,
      ctaUrl: input.ctaUrl || null,
      metadata: JSON.stringify(input.metadata || {}),
    },
  })
}

async function getOrderUserId(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, userId: true, customerEmail: true, orderNumber: true },
  })
  if (!order) return null
  if (order.userId) {
    const owner = await prisma.user.findUnique({
      where: { id: order.userId },
      select: { id: true, email: true, notifyOrderUpdates: true },
    })
    if (owner) {
      return {
        userId: owner.id,
        email: owner.email,
        orderNumber: order.orderNumber,
        notifyOrderUpdates: owner.notifyOrderUpdates,
      }
    }
  }

  const byEmail = await prisma.user.findUnique({
    where: { email: order.customerEmail.toLowerCase() },
    select: { id: true, email: true, notifyOrderUpdates: true },
  })
  if (!byEmail) return null
  return {
    userId: byEmail.id,
    email: byEmail.email,
    orderNumber: order.orderNumber,
    notifyOrderUpdates: byEmail.notifyOrderUpdates,
  }
}

function shouldSendForEvent(
  eventType: "CREATE" | "CANCELLED" | "STATUS" | "FULFILLMENT",
  settings: Awaited<ReturnType<typeof getSiteSettings>>
) {
  if (eventType === "CREATE") return settings.sendOrderEmailOnCreate
  if (eventType === "CANCELLED") return settings.sendOrderEmailOnCancelled
  if (eventType === "FULFILLMENT") return settings.sendOrderEmailOnFulfillment
  return settings.sendOrderEmailOnStatusChange
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function linkifyText(value: string) {
  const escaped = escapeHtml(value)
  return escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
  )
}

export async function notifyOrderUpdate(
  orderId: string,
  title: string,
  content: string,
  ctaUrl?: string,
  eventType: "CREATE" | "CANCELLED" | "STATUS" | "FULFILLMENT" = "STATUS",
  options?: {
    sendCustomerPanelMessage?: boolean
  }
) {
  const [recipient, siteSettings, order] = await Promise.all([
    getOrderUserId(orderId),
    getSiteSettings(),
    prisma.order.findUnique({
      where: { id: orderId },
      select: { orderNumber: true, customerEmail: true, customerName: true, total: true },
    }),
  ])

  if (!order) return
  if (!shouldSendForEvent(eventType, siteSettings)) return

  const sendCustomerPanelMessage = options?.sendCustomerPanelMessage !== false

  if (recipient && recipient.notifyOrderUpdates) {
    if (sendCustomerPanelMessage) {
      await createCustomerMessage(recipient.userId, {
        kind: "ORDER",
        title,
        content,
        ctaLabel: "View order",
        ctaUrl: ctaUrl || "/account?tab=orders",
        orderId,
        metadata: { orderId },
      })
    }

    const accountUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}${ctaUrl || "/account?tab=orders"}`
    await sendSiteEmail({
      to: recipient.email,
      subject: `${title} • ${recipient.orderNumber}`,
      text: `${content}\n\nView details: ${accountUrl}`,
      html: `<p>${linkifyText(content)}</p><p><a href="${accountUrl}">View order details</a></p>`,
    })
  }

  const adminRecipients = ["senoltr@gmail.com"]
  if (adminRecipients.length > 0) {
    const orderTotal = Number(order.total || 0).toFixed(2)
    await Promise.all(
      adminRecipients.map((email) =>
        sendSiteEmail({
          to: email,
          subject: `[Order] ${title} • ${order.orderNumber}`,
          text: `${title}\n\nOrder: ${order.orderNumber}\nCustomer: ${order.customerName || order.customerEmail}\nEmail: ${order.customerEmail}\nTotal: ${orderTotal}\n\n${content}`,
          html: `<p><strong>${escapeHtml(title)}</strong></p><p>Order: ${escapeHtml(order.orderNumber)}<br/>Customer: ${escapeHtml(order.customerName || order.customerEmail)}<br/>Email: ${escapeHtml(order.customerEmail)}<br/>Total: ${escapeHtml(orderTotal)}</p><p>${linkifyText(content)}</p>`,
        })
      )
    )
  }
}

export async function notifyNewProduct(product: { id: string; title: string; slug: string }) {
  const users = await prisma.user.findMany({
    where: {
      role: "CUSTOMER",
      isBlocked: false,
      notifyNewProducts: true,
    },
    select: { id: true },
    take: 5000,
  })

  if (users.length === 0) return

  await prisma.customerMessage.createMany({
    data: users.map((u) => ({
      userId: u.id,
      kind: "NEW_PRODUCT",
      title: "New product is live",
      content: `${product.title} has just been added to the store.`,
      ctaLabel: "View product",
      ctaUrl: `/product/${product.slug}`,
      metadata: JSON.stringify({ productId: product.id }),
    })),
  })
}

export async function notifyProductDiscount(product: {
  id: string
  title: string
  slug: string
  discountPercent: number
}) {
  const users = await prisma.user.findMany({
    where: {
      role: "CUSTOMER",
      isBlocked: false,
      notifyDiscounts: true,
    },
    select: { id: true },
    take: 5000,
  })

  if (users.length === 0) return

  await prisma.customerMessage.createMany({
    data: users.map((u) => ({
      userId: u.id,
      kind: "DISCOUNT",
      title: `${product.discountPercent}% OFF`,
      content: `${product.title} is now discounted.`,
      ctaLabel: "Shop now",
      ctaUrl: `/product/${product.slug}`,
      metadata: JSON.stringify({ productId: product.id, discountPercent: product.discountPercent }),
    })),
  })
}

export async function notifyNewCategory(category: { id: string; title: string; slug: string }) {
  const users = await prisma.user.findMany({
    where: {
      role: "CUSTOMER",
      isBlocked: false,
      notifyNewCategories: true,
    },
    select: { id: true },
    take: 5000,
  })

  if (users.length === 0) return

  await prisma.customerMessage.createMany({
    data: users.map((u) => ({
      userId: u.id,
      kind: "NEW_CATEGORY",
      title: "New category opened",
      content: `${category.title} category is now available.`,
      ctaLabel: "Browse category",
      ctaUrl: `/category/${category.slug}`,
      metadata: JSON.stringify({ categoryId: category.id }),
    })),
  })
}
