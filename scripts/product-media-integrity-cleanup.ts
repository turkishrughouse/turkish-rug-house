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

type AuditIssue = {
  role: "featured" | "gallery"
  path: string
  reason: "missing_file" | "invalid_path"
}

type AuditFix =
  | { type: "featured_replaced"; from: string; to: string }
  | { type: "gallery_removed"; path: string }
  | { type: "all_images_removed" }

type ProductAudit = {
  id: string
  slug: string
  sku: string | null
  issues: AuditIssue[]
  fixes: AuditFix[]
  nextImages: string
  validRemainingImages: number
  wouldBecomeEmpty: boolean
  skippedInApply: boolean
  changed: boolean
}

const prisma = new PrismaClient()
const PLACEHOLDER_IMAGE_URL = "/placeholder.jpg"
const uploadRoot = path.join(process.cwd(), "public", "uploads")

function normalizeValue(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : ""
}

function isRemoteUrl(value: string) {
  return /^https?:\/\//i.test(value)
}

function isUploadPath(value: string) {
  return value.startsWith("/uploads/") || value.startsWith("uploads/")
}

function toUploadsRelativePath(value: string) {
  if (value.startsWith("/uploads/")) return value.slice("/uploads/".length)
  if (value.startsWith("uploads/")) return value.slice("uploads/".length)
  return ""
}

function fileExistsForPath(value: string) {
  const normalized = normalizeValue(value)
  if (!normalized) return false
  if (normalized === PLACEHOLDER_IMAGE_URL) return true
  if (isRemoteUrl(normalized)) return true
  if (!isUploadPath(normalized)) return false
  const relativePath = toUploadsRelativePath(normalized)
  if (!relativePath) return false
  return fs.existsSync(path.join(uploadRoot, relativePath))
}

function parseRawImages(value: string | null | undefined): Array<string | ProductImageRecord> {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    const normalized = normalizeValue(value)
    return normalized ? [normalized] : []
  }
}

function normalizeRecord(input: string | ProductImageRecord, index: number): ProductImageRecord | null {
  if (typeof input === "string") {
    const normalized = normalizeValue(input)
    return normalized ? { image_url: normalized, sort_order: index, is_primary: index === 0 } : null
  }

  const imageUrl = normalizeValue(input.image_url)
  if (!imageUrl) return null

  return {
    image_url: imageUrl,
    width: typeof input.width === "number" ? input.width : null,
    height: typeof input.height === "number" ? input.height : null,
    alt: normalizeValue(input.alt),
    sort_order: typeof input.sort_order === "number" ? input.sort_order : index,
    is_primary: input.is_primary ?? index === 0,
    variants: {
      thumb: normalizeValue(input.variants?.thumb) || undefined,
      large: normalizeValue(input.variants?.large) || undefined,
      master: normalizeValue(input.variants?.master) || undefined,
    },
  }
}

function serializeImages(records: ProductImageRecord[]) {
  return JSON.stringify(
    records.map((record, index) => ({
      ...record,
      sort_order: typeof record.sort_order === "number" ? record.sort_order : index,
      is_primary: index === 0,
    }))
  )
}

function parseFlagValue(flag: string) {
  const direct = process.argv.find((arg) => arg.startsWith(`${flag}=`))
  if (direct) return direct.slice(flag.length + 1)

  const index = process.argv.findIndex((arg) => arg === flag)
  if (index >= 0) {
    const nextValue = process.argv[index + 1]
    if (nextValue && !nextValue.startsWith("--")) return nextValue
  }

  return ""
}

function auditProductImages(product: {
  id: string
  slug: string
  sku: string | null
  images: string
}, allowEmpty: boolean): ProductAudit {
  const parsedRecords = parseRawImages(product.images)
    .map((item, index) => normalizeRecord(item, index))
    .filter((item): item is ProductImageRecord => Boolean(item))

  const issues: AuditIssue[] = []
  const fixes: AuditFix[] = []
  const validRecords: ProductImageRecord[] = []

  parsedRecords.forEach((record, index) => {
    const role = index === 0 ? "featured" : "gallery"
    const normalizedPath = normalizeValue(record.image_url)
    const valid = fileExistsForPath(normalizedPath)

    if (!valid) {
      issues.push({
        role,
        path: normalizedPath || "(empty)",
        reason: normalizedPath ? "missing_file" : "invalid_path",
      })

      if (role === "gallery") {
        fixes.push({ type: "gallery_removed", path: normalizedPath || "(empty)" })
      }
      return
    }

    validRecords.push(record)
  })

  if (parsedRecords[0] && validRecords[0] && parsedRecords[0].image_url !== validRecords[0].image_url) {
    fixes.unshift({
      type: "featured_replaced",
      from: parsedRecords[0].image_url,
      to: validRecords[0].image_url,
    })
  }

  if (parsedRecords.length > 0 && validRecords.length === 0) {
    fixes.push({ type: "all_images_removed" })
  }

  const nextImages = validRecords.length > 0 || allowEmpty ? serializeImages(validRecords) : (product.images || "[]")
  const wouldBecomeEmpty = parsedRecords.length > 0 && validRecords.length === 0
  const skippedInApply = wouldBecomeEmpty && !allowEmpty
  const changed = nextImages !== (product.images || "[]")

  return {
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    issues,
    fixes,
    nextImages,
    validRemainingImages: validRecords.length,
    wouldBecomeEmpty,
    skippedInApply,
    changed,
  }
}

function formatFix(fix: AuditFix) {
  if (fix.type === "featured_replaced") return `featured_replaced: ${fix.from} -> ${fix.to}`
  if (fix.type === "gallery_removed") return `gallery_removed: ${fix.path}`
  return "all_images_removed"
}

async function main() {
  const applyChanges = process.argv.includes("--apply")
  const allowEmpty = process.argv.includes("--allow-empty")
  const writeReportPath = parseFlagValue("--write-report")
  const products = await prisma.product.findMany({
    select: {
      id: true,
      slug: true,
      sku: true,
      images: true,
    },
    orderBy: { updatedAt: "desc" },
  })

  const reports = products
    .map((product) => auditProductImages(product, allowEmpty))
    .filter((report) => report.issues.length > 0 || report.changed)

  const withRemainingImages = reports.filter((report) => report.validRemainingImages > 0)
  const wouldLoseAllImages = reports.filter((report) => report.wouldBecomeEmpty)

  let updatedCount = 0
  let skippedDestructiveCount = 0

  console.log(`mode=${applyChanges ? "apply" : "dry-run"}`)
  console.log(`allowEmpty=${allowEmpty}`)
  console.log(`uploadsRoot=${uploadRoot}`)
  console.log(`productsScanned=${products.length}`)
  console.log(`productsWithIssues=${reports.length}`)
  console.log(`productsWithValidRemainingImages=${withRemainingImages.length}`)
  console.log(`productsThatWouldLoseAllImages=${wouldLoseAllImages.length}`)

  console.log("")
  console.log("[SUMMARY] products with at least one valid remaining image")
  if (withRemainingImages.length === 0) {
    console.log("  none")
  } else {
    withRemainingImages.forEach((report) => {
      console.log(`  SKU=${report.sku || "(no-sku)"} slug=${report.slug} validRemaining=${report.validRemainingImages}`)
    })
  }

  console.log("")
  console.log("[SUMMARY] products that would lose all images on apply")
  if (wouldLoseAllImages.length === 0) {
    console.log("  none")
  } else {
    wouldLoseAllImages.forEach((report) => {
      console.log(`  SKU=${report.sku || "(no-sku)"} slug=${report.slug} allowEmptyRequired=true`)
    })
  }

  for (const report of reports) {
    console.log("")
    console.log(`SKU=${report.sku || "(no-sku)"} slug=${report.slug}`)
    report.issues.forEach((issue) => {
      console.log(`  broken role=${issue.role} path=${issue.path} reason=${issue.reason}`)
    })
    if (report.fixes.length === 0) {
      console.log("  fix=none")
    } else {
      report.fixes.forEach((fix) => {
        console.log(`  fix=${formatFix(fix)}`)
      })
    }
    console.log(`  validRemainingImages=${report.validRemainingImages}`)
    console.log(`  wouldBecomeEmpty=${report.wouldBecomeEmpty}`)

    if (applyChanges && report.changed) {
      if (report.skippedInApply) {
        console.log("  apply=skipped (would remove all images; pass --allow-empty to force)")
        skippedDestructiveCount += 1
        continue
      }
      await prisma.product.update({
        where: { id: report.id },
        data: { images: report.nextImages },
      })
      updatedCount += 1
    }
  }

  if (writeReportPath) {
    const reportPayload = {
      mode: applyChanges ? "apply" : "dry-run",
      allowEmpty,
      uploadsRoot: uploadRoot,
      productsScanned: products.length,
      productsWithIssues: reports.length,
      productsWithValidRemainingImages: withRemainingImages.length,
      productsThatWouldLoseAllImages: wouldLoseAllImages.length,
      updatedProducts: updatedCount,
      skippedDestructiveProducts: skippedDestructiveCount,
      groups: {
        withValidRemainingImages: withRemainingImages.map((report) => ({
          sku: report.sku,
          slug: report.slug,
          validRemainingImages: report.validRemainingImages,
          issues: report.issues,
          fixes: report.fixes,
        })),
        wouldLoseAllImages: wouldLoseAllImages.map((report) => ({
          sku: report.sku,
          slug: report.slug,
          validRemainingImages: report.validRemainingImages,
          issues: report.issues,
          fixes: report.fixes,
          skippedInApply: report.skippedInApply,
        })),
      },
      products: reports,
    }
    const absoluteReportPath = path.isAbsolute(writeReportPath) ? writeReportPath : path.join(process.cwd(), writeReportPath)
    fs.writeFileSync(absoluteReportPath, `${JSON.stringify(reportPayload, null, 2)}\n`, "utf8")
    console.log(`reportWritten=${absoluteReportPath}`)
  }

  console.log("")
  console.log(`updatedProducts=${updatedCount}`)
  console.log(`skippedDestructiveProducts=${skippedDestructiveCount}`)
  console.log(applyChanges ? "apply_complete=true" : "dry_run_complete=true")
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
