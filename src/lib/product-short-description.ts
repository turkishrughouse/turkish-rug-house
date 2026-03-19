import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"

export async function getProductShortDescriptionMap(productIds: string[]) {
  const uniqueIds = Array.from(new Set(productIds.map((id) => String(id || "").trim()).filter(Boolean)))
  if (uniqueIds.length === 0) return new Map<string, string | null>()

  try {
    const rows = await prisma.$queryRaw<Array<{ id: string; shortDescription: string | null }>>(
      Prisma.sql`
        SELECT "id", "shortDescription"
        FROM "Product"
        WHERE "id" IN (${Prisma.join(uniqueIds)})
      `
    )

    return new Map(rows.map((row) => [row.id, row.shortDescription ?? null]))
  } catch {
    return new Map<string, string | null>()
  }
}

export async function getProductShortDescriptionById(productId: string) {
  const descriptions = await getProductShortDescriptionMap([productId])
  return descriptions.get(productId) ?? null
}
