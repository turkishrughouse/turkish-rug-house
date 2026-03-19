import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSessionUser } from "@/lib/auth-server"
import { getOrderDetailsMap } from "@/lib/order-details"

export async function GET() {
  const user = await getSessionUser("customer")
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { userId: user.id },
        { customerEmail: user.email.toLowerCase() },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      items: true,
      events: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
    take: 100,
  })

  const detailsMap = await getOrderDetailsMap(orders.map((order) => order.id))

  const data = orders.map((order) => ({
    ...order,
    total: order.total.toNumber(),
    details: detailsMap.get(order.id) || null,
    items: order.items.map((item) => ({
      ...item,
      price: item.price.toNumber(),
    })),
  }))

  return NextResponse.json({ orders: data })
}
