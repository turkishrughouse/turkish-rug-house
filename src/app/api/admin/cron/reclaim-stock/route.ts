import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

const PENDING_TTL_MS = 30 * 60 * 1000 // 30 minutes

// Called by Vercel cron or external scheduler.
// Finds PENDING orders older than TTL, reclaims their stock, marks them EXPIRED.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret")
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - PENDING_TTL_MS)

  const expiredOrders = await prisma.order.findMany({
    where: { status: "PENDING", createdAt: { lt: cutoff } },
    include: { items: true },
  })

  if (expiredOrders.length === 0) {
    return NextResponse.json({ reclaimed: 0 })
  }

  let reclaimed = 0

  for (const order of expiredOrders) {
    await prisma.$transaction(async (tx) => {
      // Re-check inside tx to avoid race with concurrent finalize.
      const current = await tx.order.findUnique({
        where: { id: order.id },
        select: { status: true },
      })
      if (!current || current.status !== "PENDING") return

      // Restore stock for each item (symmetric to checkout decrement).
      for (const item of order.items) {
        if (!item.productId) continue
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockCount: { increment: item.quantity },
            isStock: true,
          },
        })
      }

      await tx.order.update({
        where: { id: order.id },
        data: { status: "EXPIRED" },
      })

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          type: "STATUS",
          title: "Order expired",
          description: "Payment not completed within 30 minutes. Stock reclaimed.",
          actorType: "SYSTEM",
          isAdmin: false,
        },
      })
    })
    reclaimed++
  }

  return NextResponse.json({ reclaimed })
}
