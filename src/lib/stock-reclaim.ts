import { prisma } from "@/lib/db"

const PENDING_TTL_MS = 30 * 60 * 1000 // 30 minutes

export async function reclaimExpiredOrders(): Promise<number> {
  const cutoff = new Date(Date.now() - PENDING_TTL_MS)

  const stale = await prisma.order.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: cutoff },
    },
    select: {
      id: true,
      items: { select: { productId: true, quantity: true } },
    },
  })

  if (stale.length === 0) return 0

  let reclaimed = 0

  for (const order of stale) {
    await prisma.$transaction(async (tx) => {
      const current = await tx.order.findUnique({
        where: { id: order.id },
        select: { status: true },
      })
      if (!current || current.status !== "PENDING") return

      await tx.order.update({
        where: { id: order.id },
        data: { status: "EXPIRED" },
      })

      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockCount: { increment: item.quantity },
            isStock: true,
          },
        })
      }
    })

    reclaimed++
  }

  if (reclaimed > 0) {
    console.info(`[stock-reclaim] expired ${reclaimed} stale PENDING order(s), stock restored`)
  }

  return reclaimed
}
