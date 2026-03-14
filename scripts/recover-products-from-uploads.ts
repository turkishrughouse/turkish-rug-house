import fs from "fs"
import path from "path"
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

type ParsedArgs = {
  write: boolean
  rootDir: string
  skuFilter: string | null
}

type VariantKind = "master" | "large" | "thumb"

type VariantFile = {
  kind: VariantKind
  fileName: string
  diskPath: string
  publicPath: string
  baseName: string
}

type SkuFolder = {
  sku: string
  dirPath: string
  relativeDir: string
  categorySlugs: string[]
  files: VariantFile[]
}

type RecoveredProduct = {
  sku: string
  title: string
  slug: string
  description: string
  images: ProductImageRecord[]
  categorySlugs: string[]
  sourceDirs: string[]
}

const prisma = new PrismaClient()
const SKU_DIR_PATTERN = /^(?=.*\d)[A-Z0-9]{5,}$/
const VARIANT_FILE_PATTERN = /-(master|large|thumb)\.(webp|jpg|jpeg|png|avif)$/i

function parseArgs(argv: string[]): ParsedArgs {
  let write = false
  let rootDir = path.join(process.cwd(), "public", "uploads")
  let skuFilter: string | null = null

  for (const arg of argv) {
    if (arg === "--write") {
      write = true
      continue
    }
    if (arg.startsWith("--root=")) {
      rootDir = path.resolve(process.cwd(), arg.slice("--root=".length))
      continue
    }
    if (arg.startsWith("--sku=")) {
      skuFilter = arg.slice("--sku=".length).trim().toUpperCase() || null
    }
  }

  return { write, rootDir, skuFilter }
}

function slugifyText(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "product"
}

function titleCaseText(input: string) {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (/^\d+x\d+$/i.test(word)) return word.toUpperCase()
      if (/^[A-Z0-9]{2,}$/i.test(word) && word === word.toUpperCase()) return word
      return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`
    })
    .join(" ")
}

function naturalCompare(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
}

function stripVariantSuffix(fileName: string) {
  return fileName.replace(VARIANT_FILE_PATTERN, "")
}

function variantKindFromFileName(fileName: string): VariantKind | null {
  const match = fileName.match(VARIANT_FILE_PATTERN)
  if (!match) return null
  const variant = match[1]?.toLowerCase()
  if (variant === "master" || variant === "large" || variant === "thumb") return variant
  return null
}

function toPublicUrl(filePath: string) {
  const normalized = filePath.split(path.sep).join("/")
  const index = normalized.indexOf("/uploads/")
  return index >= 0 ? normalized.slice(index) : normalized.replace(/^public/, "")
}

function parseExistingImages(value: unknown): ProductImageRecord[] {
  if (!value) return []
  if (Array.isArray(value)) return value as ProductImageRecord[]
  if (typeof value !== "string") return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as ProductImageRecord[]) : []
  } catch {
    return value.trim() ? [{ image_url: value.trim() }] : []
  }
}

function buildDescription(title: string, categorySlugs: string[]) {
  const categoryText = categorySlugs.length > 0 ? `Recovered from media in: ${categorySlugs.join(", ")}.` : "Recovered from existing uploaded media."
  return `${title}. ${categoryText}`
}

function deriveTitleFromBaseName(baseName: string) {
  const normalized = baseName
    .replace(/^copy-of-/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return titleCaseText(normalized || "Recovered Product")
}

function buildAltText(title: string, index: number) {
  return index === 0 ? title : `${title} image ${index + 1}`
}

function buildSlugBase(title: string, sku: string) {
  const titleSlug = slugifyText(title)
  const skuSlug = slugifyText(sku)
  return titleSlug.endsWith(`-${skuSlug}`) || titleSlug === skuSlug ? titleSlug : `${titleSlug}-${skuSlug}`
}

async function ensureUniqueSlug(baseSlug: string, currentProductId?: string) {
  let candidate = slugifyText(baseSlug)
  let index = 2

  while (true) {
    const existing = await prisma.product.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })

    if (!existing || existing.id === currentProductId) return candidate
    candidate = `${slugifyText(baseSlug)}-${index}`
    index += 1
  }
}

function walkSkuFolders(rootDir: string, skuFilter: string | null) {
  const found: SkuFolder[] = []

  function visit(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const nextDir = path.join(currentDir, entry.name)

      const normalizedDirName = entry.name.trim().toUpperCase()

      if (SKU_DIR_PATTERN.test(normalizedDirName)) {
        const files = fs
          .readdirSync(nextDir, { withFileTypes: true })
          .filter((item) => item.isFile())
          .map((item) => {
            const kind = variantKindFromFileName(item.name)
            if (!kind) return null
            const diskPath = path.join(nextDir, item.name)
            return {
              kind,
              fileName: item.name,
              diskPath,
              publicPath: toPublicUrl(diskPath),
              baseName: stripVariantSuffix(item.name),
            } satisfies VariantFile
          })
          .filter((item): item is VariantFile => Boolean(item))

        if (files.length > 0 && (!skuFilter || normalizedDirName === skuFilter)) {
          const relativeDir = path.relative(rootDir, nextDir).split(path.sep).join("/")
          const segments = relativeDir.split("/").filter(Boolean)
          found.push({
            sku: normalizedDirName,
            dirPath: nextDir,
            relativeDir,
            categorySlugs: segments.slice(0, -1).map((segment) => slugifyText(segment)),
            files,
          })
        }
      }

      visit(nextDir)
    }
  }

  visit(rootDir)
  return found
}

function recoverProductsFromFolders(folders: SkuFolder[]) {
  const grouped = new Map<string, SkuFolder[]>()
  for (const folder of folders) {
    const bucket = grouped.get(folder.sku) || []
    bucket.push(folder)
    grouped.set(folder.sku, bucket)
  }

  const recovered: RecoveredProduct[] = []

  for (const [sku, skuFolders] of grouped) {
    const variantGroups = new Map<string, { baseName: string; variants: Partial<Record<VariantKind, string>> }>()
    const categorySlugs = Array.from(new Set(skuFolders.flatMap((folder) => folder.categorySlugs)))
    const sourceDirs = skuFolders.map((folder) => folder.relativeDir)

    for (const folder of skuFolders) {
      for (const file of folder.files) {
        const current = variantGroups.get(file.baseName) || { baseName: file.baseName, variants: {} }
        current.variants[file.kind] = file.publicPath
        variantGroups.set(file.baseName, current)
      }
    }

    const sortedGroups = Array.from(variantGroups.values()).sort((a, b) => naturalCompare(a.baseName, b.baseName))
    if (sortedGroups.length === 0) continue

    const title = deriveTitleFromBaseName(sortedGroups[0].baseName)
    const description = buildDescription(title, categorySlugs)
    const images = sortedGroups.map((group, index) => {
      const primaryUrl = group.variants.large || group.variants.master || group.variants.thumb || ""
      return {
        image_url: primaryUrl,
        alt: buildAltText(title, index),
        sort_order: index,
        is_primary: index === 0,
        variants: {
          thumb: group.variants.thumb || primaryUrl,
          large: group.variants.large || primaryUrl,
          master: group.variants.master || primaryUrl,
        },
      } satisfies ProductImageRecord
    })

    recovered.push({
      sku,
      title,
      slug: buildSlugBase(title, sku),
      description,
      images,
      categorySlugs,
      sourceDirs,
    })
  }

  return recovered.sort((a, b) => naturalCompare(a.sku, b.sku))
}

function mergeImages(existing: ProductImageRecord[], recovered: ProductImageRecord[]) {
  const merged = [...existing]
  const seen = new Set(
    existing.map((image) => {
      const master = image.variants?.master || image.image_url
      return (master || "").toLowerCase()
    })
  )

  for (const image of recovered) {
    const key = (image.variants?.master || image.image_url || "").toLowerCase()
    if (!key || seen.has(key)) continue
    merged.push({
      ...image,
      sort_order: merged.length,
      is_primary: merged.length === 0,
    })
    seen.add(key)
  }

  return merged.map((image, index) => ({
    ...image,
    sort_order: index,
    is_primary: index === 0,
  }))
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!fs.existsSync(args.rootDir)) {
    throw new Error(`Uploads root does not exist: ${args.rootDir}`)
  }

  const folders = walkSkuFolders(args.rootDir, args.skuFilter)
  const recoveredProducts = recoverProductsFromFolders(folders)
  const categories = await prisma.category.findMany({
    select: { id: true, slug: true },
  })
  const categoriesBySlug = new Map(categories.map((category) => [category.slug, category.id]))

  let created = 0
  let updated = 0
  let skipped = 0

  console.log(`[recover] mode=${args.write ? "write" : "dry-run"} root=${args.rootDir}`)
  console.log(`[recover] detected ${recoveredProducts.length} recoverable product candidates`)

  for (const recovered of recoveredProducts) {
    const existing = await prisma.product.findFirst({
      where: {
        OR: [{ sku: recovered.sku }, { slug: recovered.slug }],
      },
      select: {
        id: true,
        sku: true,
        slug: true,
        title: true,
        description: true,
        images: true,
        categories: {
          select: { id: true, slug: true },
        },
      },
    })

    const connectCategoryIds = recovered.categorySlugs
      .map((slug) => categoriesBySlug.get(slug))
      .filter((id): id is string => Boolean(id))
    const existingCategoryIds = new Set(existing?.categories.map((category) => category.id) || [])

    const nextSlug = await ensureUniqueSlug(recovered.slug, existing?.id)
    const nextImages = mergeImages(parseExistingImages(existing?.images), recovered.images)
    const needsImageUpdate = JSON.stringify(parseExistingImages(existing?.images)) !== JSON.stringify(nextImages)
    const needsCategoryConnect = connectCategoryIds.some((id) => !existingCategoryIds.has(id))
    const shouldCreate = !existing
    const shouldUpdate = Boolean(
      existing &&
        (needsImageUpdate ||
          needsCategoryConnect ||
          (!existing.sku && recovered.sku) ||
          (!existing.description && recovered.description) ||
          (!existing.title && recovered.title) ||
          existing.slug !== nextSlug)
    )

    if (!args.write) {
      console.log(
        `[dry-run] ${shouldCreate ? "create" : shouldUpdate ? "update" : "skip"} sku=${recovered.sku} slug=${nextSlug} images=${recovered.images.length} categories=${connectCategoryIds.length} sources=${recovered.sourceDirs.join(", ")}`
      )
      continue
    }

    if (shouldCreate) {
      await prisma.product.create({
        data: {
          sku: recovered.sku,
          slug: nextSlug,
          title: recovered.title,
          description: recovered.description,
          price: 0,
          compareAtPrice: 0,
          images: JSON.stringify(recovered.images),
          isStock: true,
          stockCount: 1,
          isFeatured: false,
          isPublished: true,
          categories: connectCategoryIds.length > 0 ? { connect: connectCategoryIds.map((id) => ({ id })) } : undefined,
        },
      })
      created += 1
      console.log(`[create] sku=${recovered.sku} slug=${nextSlug} images=${recovered.images.length}`)
      continue
    }

    if (shouldUpdate && existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          sku: existing.sku || recovered.sku,
          slug: nextSlug,
          title: existing.title || recovered.title,
          description: existing.description || recovered.description,
          images: needsImageUpdate ? JSON.stringify(nextImages) : undefined,
          categories: needsCategoryConnect
            ? { connect: connectCategoryIds.filter((id) => !existingCategoryIds.has(id)).map((id) => ({ id })) }
            : undefined,
        },
      })
      updated += 1
      console.log(`[update] sku=${recovered.sku} slug=${nextSlug} images=${nextImages.length}`)
      continue
    }

    skipped += 1
    console.log(`[skip] sku=${recovered.sku} already has recovered media`)
  }

  console.log(`[done] created=${created} updated=${updated} skipped=${skipped}`)
}

main()
  .catch((error) => {
    console.error("[recover] failed:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
