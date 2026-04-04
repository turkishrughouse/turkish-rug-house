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

type CandidateFix = {
  field: "featuredImage" | "galleryImage"
  from: string
  to: string
}

const prisma = new PrismaClient()
const uploadRoot = path.join(process.cwd(), "public", "uploads")

function getArg(flag: string) {
  const direct = process.argv.find((arg) => arg.startsWith(`${flag}=`))
  if (direct) return direct.slice(flag.length + 1)

  const index = process.argv.findIndex((arg) => arg === flag)
  if (index >= 0) {
    const nextValue = process.argv[index + 1]
    if (nextValue && !nextValue.startsWith("--")) return nextValue
  }

  return ""
}

function normalizeValue(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : ""
}

function parseImageRecords(value: string | null | undefined): ProductImageRecord[] {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item, index) => {
        if (typeof item === "string") {
          const imageUrl = normalizeValue(item)
          return imageUrl ? { image_url: imageUrl, is_primary: index === 0, sort_order: index } : null
        }
        if (item && typeof item === "object" && typeof (item as { image_url?: unknown }).image_url === "string") {
          return {
            ...(item as ProductImageRecord),
            image_url: normalizeValue((item as ProductImageRecord).image_url),
          }
        }
        return null
      })
      .filter((item): item is ProductImageRecord => Boolean(item && item.image_url))
  } catch {
    const imageUrl = normalizeValue(value)
    return imageUrl ? [{ image_url: imageUrl, is_primary: true, sort_order: 0 }] : []
  }
}

function fileExistsForUrl(value: string) {
  const normalized = normalizeValue(value)
  if (!normalized.startsWith("/uploads/")) return false
  const relativePath = normalized.slice("/uploads/".length)
  return fs.existsSync(path.join(uploadRoot, relativePath))
}

function collectMatchesByBasename(basename: string) {
  const matches: string[] = []

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        walk(absolutePath)
        continue
      }
      if (entry.isFile() && entry.name === basename) {
        matches.push(`/${path.relative(path.join(process.cwd(), "public"), absolutePath).replace(/\\/g, "/")}`)
      }
    }
  }

  if (fs.existsSync(uploadRoot)) {
    walk(uploadRoot)
  }

  return matches
}

function pickBestReplacement(url: string, sku: string) {
  const basename = path.basename(url)
  if (!basename) return ""

  const matches = collectMatchesByBasename(basename)
  if (matches.length === 0) return ""

  const preferredBySku = matches.find((match) => match.includes(`/${sku}/`))
  return preferredBySku || matches[0] || ""
}

function serializeRecords(records: ProductImageRecord[]) {
  return JSON.stringify(
    records.map((record, index) => ({
      ...record,
      image_url: normalizeValue(record.image_url),
      sort_order: typeof record.sort_order === "number" ? record.sort_order : index,
      is_primary: index === 0,
    }))
  )
}

async function main() {
  const sku = getArg("--sku")
  const applyChanges = process.argv.includes("--apply")

  if (!sku) {
    throw new Error("Pass --sku <SKU>.")
  }

  const product = await prisma.product.findFirst({
    where: { sku },
    select: {
      id: true,
      sku: true,
      slug: true,
      images: true,
    },
  })

  if (!product) {
    throw new Error(`Product not found for SKU ${sku}.`)
  }

  const records = parseImageRecords(product.images)
  const fixes: CandidateFix[] = []

  const nextRecords = records.map((record, index) => {
    const imageUrl = normalizeValue(record.image_url)
    if (!imageUrl || fileExistsForUrl(imageUrl)) return record

    const replacement = pickBestReplacement(imageUrl, sku)
    if (!replacement || !fileExistsForUrl(replacement)) return record

    fixes.push({
      field: index === 0 ? "featuredImage" : "galleryImage",
      from: imageUrl,
      to: replacement,
    })

    return {
      ...record,
      image_url: replacement,
    }
  })

  const hasAtLeastOneValidImage = nextRecords.some((record) => fileExistsForUrl(record.image_url))
  const changed = serializeRecords(nextRecords) !== (product.images || "[]")

  console.log(`sku=${product.sku || "(no-sku)"}`)
  console.log(`slug=${product.slug}`)
  console.log(`imagesFound=${records.length}`)
  console.log(`fixesFound=${fixes.length}`)

  if (fixes.length === 0) {
    console.log("No incorrect broken base path was safely replaceable.")
  } else {
    for (const fix of fixes) {
      console.log(`${fix.field}: ${fix.from} -> ${fix.to}`)
    }
  }

  console.log(`hasAtLeastOneValidImageAfterFix=${hasAtLeastOneValidImage}`)

  if (applyChanges && changed && hasAtLeastOneValidImage) {
    await prisma.product.update({
      where: { id: product.id },
      data: {
        images: serializeRecords(nextRecords),
      },
    })
    console.log("apply=true")
  } else {
    console.log(`apply=${applyChanges ? "skipped" : "false"}`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
