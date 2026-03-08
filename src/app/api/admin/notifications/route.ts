import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type NotificationItem = {
  id: string
  type: "SALE" | "MESSAGE" | "UPDATE"
  title: string
  description: string
  href: string
  createdAt: string
}

export async function GET() {
  try {
    const [orders, messages, orderEvents, pages, products, menus, users, openOrderRows, unreadMessages] = await Promise.all([
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          customerEmail: true,
          total: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.message.findMany({
        where: { deletedAt: null },
        orderBy: { receivedAt: "desc" },
        take: 30,
        select: {
          id: true,
          source: true,
          status: true,
          name: true,
          email: true,
          subject: true,
          receivedAt: true,
        },
      }),
      prisma.orderEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 40,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
            },
          },
        },
      }),
      prisma.page.findMany({
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: {
          id: true,
          title: true,
          updatedAt: true,
        },
      }),
      prisma.product.findMany({
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: {
          id: true,
          title: true,
          updatedAt: true,
        },
      }),
      prisma.menu.findMany({
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: {
          id: true,
          title: true,
          updatedAt: true,
        },
      }),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
        },
      }),
      prisma.order.findMany({
        where: { status: { in: ["PENDING", "PAID"] } },
        select: { id: true },
      }),
      prisma.message.count({
        where: {
          deletedAt: null,
          status: "NEW",
        },
      }),
    ])

    const items: NotificationItem[] = [
      ...orders.map((order) => ({
        id: `sale:${order.id}`,
        type: "SALE" as const,
        title: `New order ${order.orderNumber}`,
        description: `${order.customerName || order.customerEmail} • $${Number(order.total)} • ${order.status}`,
        href: `/dashboard/orders/${order.id}`,
        createdAt: order.createdAt.toISOString(),
      })),
      ...orderEvents.map((event) => ({
        id: `order-event:${event.id}`,
        type: "UPDATE" as const,
        title: `Order ${event.order.orderNumber} updated`,
        description: `${event.title}${event.description ? ` • ${event.description}` : ""}`,
        href: `/dashboard/orders/${event.order.id}`,
        createdAt: event.createdAt.toISOString(),
      })),
      ...messages.map((message) => ({
        id: `message:${message.id}`,
        type: "MESSAGE" as const,
        title: `${message.source} message`,
        description: `${message.name || message.email || "Unknown sender"} • ${message.subject || "No subject"} • ${message.status}`,
        href: `/dashboard/messages`,
        createdAt: message.receivedAt.toISOString(),
      })),
      ...pages.map((page) => ({
        id: `page-update:${page.id}`,
        type: "UPDATE" as const,
        title: `Page updated`,
        description: page.title,
        href: `/dashboard/pages/${page.id}`,
        createdAt: page.updatedAt.toISOString(),
      })),
      ...products.map((product) => ({
        id: `product-update:${product.id}`,
        type: "UPDATE" as const,
        title: `Product updated`,
        description: product.title,
        href: `/dashboard/products/${product.id}`,
        createdAt: product.updatedAt.toISOString(),
      })),
      ...menus.map((menu) => ({
        id: `menu-update:${menu.id}`,
        type: "UPDATE" as const,
        title: "Menu updated",
        description: menu.title,
        href: "/dashboard/menus",
        createdAt: menu.updatedAt.toISOString(),
      })),
      ...users.map((user) => ({
        id: `user-registered:${user.id}`,
        type: "UPDATE" as const,
        title: "New customer registered",
        description: user.name || user.email || "Customer account created",
        href: "/dashboard/users",
        createdAt: user.createdAt.toISOString(),
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 120)

    const openOrderIds = openOrderRows.map((order) => order.id)
    const openOrders = openOrderIds.length

    return NextResponse.json({
      items,
      meta: {
        unreadMessages,
        openOrders,
        openOrderIds,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error("Error fetching notifications:", error)
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 })
  }
}
