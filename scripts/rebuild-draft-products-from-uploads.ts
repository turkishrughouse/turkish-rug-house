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
  publicPath: string
  baseName: string
}

type SkuFolder = {
  sku: string
  relativeDir: string
  categorySlugs: string[]
  files: VariantFile[]
}

type DraftProductCandidate = {
  sku: string
  title: string
  slugBase: string
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

function toPublicUrl(filePath: string) {
  const normalized = filePath.split(path.sep).join("/")
  const index = normalized.indexOf("/uploads/")
  return index >= 0 ? normalized.slice(index) : normalized.replace(/^public/, "")
}

function variantKindFromFileName(fileName: string): VariantKind | null {
  const match = fileName.match(VARIANT_FILE_PATTERN)
  if (!match) return null
  const variant = match[1]?.toLowerCase()
  if (variant === "master" || variant === "large" || variant === "thumb") return variant
  return null
}

function stripVariantSuffix(fileName: string) {
  return fileName.replace(VARIANT_FILE_PATTERN, "")
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

async function ensureUniqueSlug(baseSlug: string) {
  let candidate = slugifyText(baseSlug)
  let index = 2

  while (true) {
    const existing = await prisma.product.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })
    if (!existing) return candidate
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

function buildDraftCandidates(folders: SkuFolder[]) {
  const grouped = new Map<string, SkuFolder[]>()

  for (const folder of folders) {
    const current = grouped.get(folder.sku) || []
    current.push(folder)
    grouped.set(folder.sku, current)
  }

  const candidates: DraftProductCandidate[] = []

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
    const images = sortedGroups.map((group, index) => {
      const imageUrl = group.variants.large || group.variants.master || group.variants.thumb || ""
      return {
        image_url: imageUrl,
        alt: buildAltText(title, index),
        sort_order: index,
        is_primary: index === 0,
        variants: {
          thumb: group.variants.thumb || imageUrl,
          large: group.variants.large || imageUrl,
          master: group.variants.master || imageUrl,
        },
      } satisfies ProductImageRecord
    })

    candidates.push({
      sku,
      title,
      slugBase: buildSlugBase(title, sku),
      images,
      categorySlugs,
      sourceDirs,
    })
  }

  return candidates.sort((a, b) => naturalCompare(a.sku, b.sku))
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!fs.existsSync(args.rootDir)) {
    throw new Error(`Uploads root does not exist: ${args.rootDir}`)
  }

  const folders = walkSkuFolders(args.rootDir, args.skuFilter)
  const candidates = buildDraftCandidates(folders)
  const categories = await prisma.category.findMany({
    select: { id: true, slug: true },
  })
  const categoriesBySlug = new Map(categories.map((category) => [category.slug, category.id]))

  let created = 0
  let skippedExisting = 0

  console.log(`[draft-rebuild] mode=${args.write ? "write" : "dry-run"} root=${args.rootDir}`)
  console.log(`[draft-rebuild] detected ${candidates.length} SKU folder candidates`)

  for (const candidate of candidates) {
    const existing = await prisma.product.findFirst({
      where: {
        OR: [{ sku: candidate.sku }, { slug: candidate.slugBase }],
      },
      select: { id: true, sku: true, slug: true, title: true, isPublished: true },
    })

    if (existing) {
      skippedExisting += 1
      console.log(
        `[skip-existing] sku=${candidate.sku} existingSlug=${existing.slug} published=${existing.isPublished ? "true" : "false"}`
      )
      continue
    }

    const nextSlug = await ensureUniqueSlug(candidate.slugBase)
    const categoryIds = candidate.categorySlugs
      .map((slug) => categoriesBySlug.get(slug))
      .filter((id): id is string => Boolean(id))

    if (!args.write) {
      console.log(
        `[dry-run] create-draft sku=${candidate.sku} slug=${nextSlug} images=${candidate.images.length} categories=${categoryIds.length} sources=${candidate.sourceDirs.join(", ")}`
      )
      continue
    }

    await prisma.product.create({
      data: {
        sku: candidate.sku,
        slug: nextSlug,
        title: candidate.title,
        description: null,
        price: 0,
        compareAtPrice: 0,
        images: JSON.stringify(candidate.images),
        isStock: true,
        stockCount: 1,
        isFeatured: false,
        isPublished: false,
        categories: categoryIds.length > 0 ? { connect: categoryIds.map((id) => ({ id })) } : undefined,
      },
    })

    created += 1
    console.log(`[create-draft] sku=${candidate.sku} slug=${nextSlug} images=${candidate.images.length}`)
  }

  console.log(`[draft-rebuild] draftProductsCreated=${created} skippedExisting=${skippedExisting}`)
}

main()
  .catch((error) => {
    console.error("[draft-rebuild] failed:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
