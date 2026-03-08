import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSessionUser } from "@/lib/auth"

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

  const data = orders.map((order) => ({
    ...order,
    total: order.total.toNumber(),
    items: order.items.map((item) => ({
      ...item,
      price: item.price.toNumber(),
    })),
  }))

  return NextResponse.json({ orders: data })
}
