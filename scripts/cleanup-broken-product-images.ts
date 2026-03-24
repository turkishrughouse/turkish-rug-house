import fs from "node:fs"
import path from "node:path"
import { PrismaClient } from "@prisma/client"

type ProductImageRecord = {
  image_url: string
  width?: number | null
  height?: number | null
  alt?: string | null
  sort_order?: number
  is_primary?: boolean
  variants?: {
    thumb?: string
    large?: string
    master?: string
  }
}

const prisma = new PrismaClient()
const PLACEHOLDER_IMAGE_URL = "/placeholder.jpg"
const VARIANT_FILENAME_PATTERN = /-(thumb|large|master)(\.[^/?#]+)$/i

function normalizeUrl(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : ""
}

function isRemoteUrl(value: string) {
  return /^https?:\/\//i.test(value)
}

function inferVariantUrl(urlOrPath: string, preferredVariant: "thumb" | "large" | "master") {
  const normalized = normalizeUrl(urlOrPath)
  if (!normalized || normalized === PLACEHOLDER_IMAGE_URL) return normalized

  const queryIndex = normalized.search(/[?#]/)
  const pathname = queryIndex >= 0 ? normalized.slice(0, queryIndex) : normalized
  const suffix = queryIndex >= 0 ? normalized.slice(queryIndex) : ""

  if (!VARIANT_FILENAME_PATTERN.test(pathname)) return normalized
  return `${pathname.replace(VARIANT_FILENAME_PATTERN, `-${preferredVariant}$2`)}${suffix}`
}

function fileExistsForUrl(url: string) {
  const normalized = normalizeUrl(url)
  if (!normalized) return false
  if (isRemoteUrl(normalized)) return true
  if (!normalized.startsWith("/")) return false
  return fs.existsSync(path.join(process.cwd(), "public", normalized.replace(/^\/+/, "")))
}

function parseImages(value: string | null | undefined): Array<string | ProductImageRecord> {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    const normalized = normalizeUrl(value)
    return normalized ? [normalized] : []
  }
}

function normalizeRecord(input: string | ProductImageRecord, index: number): ProductImageRecord | null {
  const record = typeof input === "string" ? { image_url: input } : input

  const validBase =
    [
      record.image_url,
      record.variants?.master,
      record.variants?.large,
      record.variants?.thumb,
    ]
      .map(normalizeUrl)
      .find(fileExistsForUrl) || ""

  if (!validBase) return null

  const resolveVariant = (variant: "thumb" | "large" | "master") => {
    const candidates = [
      record.variants?.[variant],
      inferVariantUrl(validBase, variant),
      inferVariantUrl(record.image_url, variant),
    ]
      .map(normalizeUrl)
      .filter(Boolean)

    return candidates.find(fileExistsForUrl) || validBase
  }

  return {
    image_url: validBase,
    width: record.width ?? null,
    height: record.height ?? null,
    alt: typeof record.alt === "string" ? record.alt.trim() : "",
    sort_order: typeof record.sort_order === "number" ? record.sort_order : index,
    is_primary: record.is_primary ?? index === 0,
    variants: {
      thumb: resolveVariant("thumb"),
      large: resolveVariant("large"),
      master: resolveVariant("master"),
    },
  }
}

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      slug: true,
      images: true,
    },
  })

  let updated = 0

  for (const product of products) {
    const normalizedRecords = parseImages(product.images)
      .map((item, index) => normalizeRecord(item, index))
      .filter((item): item is ProductImageRecord => Boolean(item))

    const nextImages = JSON.stringify(normalizedRecords)
    if (nextImages === (product.images || "[]")) continue

    await prisma.product.update({
      where: { id: product.id },
      data: { images: nextImages },
    })
    updated += 1
    console.log(`cleaned product images: ${product.slug}`)
  }

  if (!fileExistsForUrl(PLACEHOLDER_IMAGE_URL)) {
    throw new Error("public/placeholder.jpg is missing")
  }

  console.log(`product image cleanup complete; updated ${updated} products`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
