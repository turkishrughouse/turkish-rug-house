import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { ensureTableColumns } from "@/lib/db-compat"

let shippingContentColumnReadyPromise: Promise<void> | null = null

async function ensureShippingContentColumn() {
  if (!shippingContentColumnReadyPromise) {
    shippingContentColumnReadyPromise = (async () => {
      await ensureTableColumns("Product", [{ name: "shippingContent", postgresType: "TEXT" }])
    })().catch((error) => {
      shippingContentColumnReadyPromise = null
      throw error
    })
  }
  await shippingContentColumnReadyPromise
}

export async function getProductShippingContentById(productId: string) {
  await ensureShippingContentColumn()
  const rows = await prisma.$queryRaw<Array<{ shippingContent: string | null }>>(
    Prisma.sql`SELECT "shippingContent" FROM "Product" WHERE "id" = ${productId} LIMIT 1`
  )
  return rows[0]?.shippingContent ?? null
}
