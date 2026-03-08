import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

function slugifyText(input: string) {
  const normalized = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return normalized || "product"
}

function buildSlugBaseWithSku(baseSlug: string, sku?: string | null) {
  const normalizedBase = slugifyText(baseSlug)
  const normalizedSku = sku && sku.trim().length > 0 ? slugifyText(sku) : ""
  if (!normalizedSku) return normalizedBase
  if (normalizedBase === normalizedSku || normalizedBase.endsWith(`-${normalizedSku}`)) {
    return normalizedBase
  }
  return `${normalizedBase}-${normalizedSku}`
}

async function ensureUniqueProductSlug(baseSlug: string, productId: string) {
  const normalizedBase = slugifyText(baseSlug)
  let candidate = normalizedBase
  let index = 2

  while (true) {
    const existing = await prisma.product.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })
    if (!existing || existing.id === productId) {
      return candidate
    }
    candidate = `${normalizedBase}-${index}`
    index += 1
  }
}

async function main() {
  const products = await prisma.product.findMany({
    select: { id: true, title: true, slug: true, sku: true },
  })

  let updated = 0

  for (const product of products) {
    const slugBaseSource = product.title || product.slug
    const targetBase = buildSlugBaseWithSku(slugBaseSource, product.sku)
    const targetSlug = await ensureUniqueProductSlug(targetBase, product.id)
    if (targetSlug !== product.slug) {
      await prisma.product.update({
        where: { id: product.id },
        data: { slug: targetSlug },
      })
      updated += 1
      console.log(`updated: ${product.id} -> ${targetSlug}`)
    }
  }

  console.log(`done. updated ${updated}/${products.length} products`)
}

main()
  .catch((error) => {
    console.error("backfill failed:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
