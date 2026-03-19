import { copyFile, mkdir, readdir, rename, rm, rmdir, stat } from "fs/promises"
import path from "path"
import { prisma } from "@/lib/db"
import { ensureMediaRegistryTable, upsertMediaAsset } from "@/lib/media-registry"
import { normalizeProductImageRecords } from "@/lib/product-images"
import { getStorageProvider } from "@/lib/storage/provider"

type MediaBackfillSummary = {
  totalFilesScanned: number
  filesMoved: number
  skippedFiles: number
  potentialConflicts: number
}

export const CATEGORY_IMAGE_ROOT = "Kategori-Fotoğrafları"
const MANAGED_MEDIA_ROOTS = ["categories", "pages", "profile", CATEGORY_IMAGE_ROOT] as const
const LEGACY_MEDIA_ROOTS = ["root", "general", "external", "cache", ".cache", "products", "profiles"] as const

function isMediaBackfillDryRun() {
  return process.env.MEDIA_BACKFILL_DRY_RUN === "true"
}

function createBackfillSummary(): MediaBackfillSummary {
  return {
    totalFilesScanned: 0,
    filesMoved: 0,
    skippedFiles: 0,
    potentialConflicts: 0,
  }
}

function logBackfillSummary(summary: MediaBackfillSummary, context: string) {
  console.log(`[media-backfill] ${context} summary`, {
    totalFilesScanned: summary.totalFilesScanned,
    filesMoved: summary.filesMoved,
    skippedFiles: summary.skippedFiles,
    potentialConflicts: summary.potentialConflicts,
    dryRun: isMediaBackfillDryRun(),
  })
}

export function sanitizeFolderPath(input: string) {
  const sanitizeSegment = (segment: string) =>
    segment
      .normalize("NFC")
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")

  const normalized = (input || "")
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => sanitizeSegment(segment))
    .filter((segment) => segment.length > 0)
    .join("/")

  return normalized
}

export function getManagedMediaRoots() {
  return [...MANAGED_MEDIA_ROOTS]
}

export async function ensureManagedMediaFolders() {
  const uploadRoot = path.join(process.cwd(), "public", "uploads")
  await mkdir(uploadRoot, { recursive: true })
  for (const root of MANAGED_MEDIA_ROOTS) {
    await mkdir(path.join(uploadRoot, root), { recursive: true })
  }
}

export async function cleanupLegacyMediaFolders() {
  const uploadRoot = path.join(process.cwd(), "public", "uploads")
  await mkdir(uploadRoot, { recursive: true })
  for (const legacyFolder of LEGACY_MEDIA_ROOTS) {
    const legacyPath = path.join(uploadRoot, legacyFolder)
    if (!legacyPath.startsWith(uploadRoot)) continue
    await rm(legacyPath, { recursive: true, force: true }).catch(() => undefined)
  }
}

export async function ensureCategoryMediaFolders() {
  const uploadRoot = path.join(process.cwd(), "public", "uploads")
  await mkdir(uploadRoot, { recursive: true })
  await ensureManagedMediaFolders()

  const categories = await prisma.category.findMany({
    select: { id: true, slug: true, parentId: true },
    orderBy: { sortOrder: "asc" },
  })

  const byParent = new Map<string | null, Array<{ id: string; slug: string; parentId: string | null }>>()
  for (const category of categories) {
    const key = category.parentId || null
    const list = byParent.get(key) || []
    list.push(category)
    byParent.set(key, list)
  }

  const topLevel = byParent.get(null) || []
  const createTreeFolders = async (node: { id: string; slug: string }, parentPath: string) => {
    const currentPath = parentPath ? `${parentPath}/${node.slug}` : node.slug
    const safe = sanitizeFolderPath(currentPath)
    if (!safe) return
    await mkdir(path.join(uploadRoot, safe), { recursive: true })
    const children = byParent.get(node.id) || []
    for (const child of children) {
      await createTreeFolders(child, safe)
    }
  }

  for (const node of topLevel) {
    await createTreeFolders(node, "")
  }
}

export function getCategoryImageFolderPath(categorySlug: string) {
  const slug = sanitizeFolderPath(categorySlug)
  if (!slug) return CATEGORY_IMAGE_ROOT
  return sanitizeFolderPath(`${CATEGORY_IMAGE_ROOT}/${slug}`)
}

export async function relocateCategoryImageToFolder(
  categorySlug: string,
  imageUrl: string | null | undefined,
  options?: { dryRun?: boolean; summary?: MediaBackfillSummary; logContext?: string }
) {
  if (!imageUrl) return imageUrl || ""
  const targetFolder = getCategoryImageFolderPath(categorySlug)
  const currentFolder = extractFolderFromManagedUrl(imageUrl)
  if (currentFolder === targetFolder) {
    if (options?.summary) options.summary.skippedFiles += 1
    return imageUrl
  }
  const siblings = await getSiblingUploadAssets(imageUrl)
  if (siblings.length === 0) return imageUrl

  if (options?.summary) {
    options.summary.totalFilesScanned += siblings.length
  }

  const targetDir = path.join(process.cwd(), "public", "uploads", targetFolder)
  const storage = getStorageProvider()
  const masterSibling = siblings.find((sibling) => sibling.fileName.includes("-master.")) || siblings[0]
  const deriveFileName = (candidateBase: string, siblingFileName: string) =>
    siblingFileName.replace(/^(.*?)(-(thumb|large|master)\.[^.]+)$/i, `${candidateBase}$2`)
  const sourceBaseName = masterSibling.fileName
    .replace(/-(thumb|large|master)\.[^.]+$/i, "")
    .replace(/\.[^.]+$/i, "")

  let candidateBaseName = sourceBaseName
  let collisionCounter = 2
  while (true) {
    const hasConflict = await Promise.all(
      siblings.map((sibling) =>
        stat(path.join(targetDir, deriveFileName(candidateBaseName, sibling.fileName)))
          .then(() => true)
          .catch(() => false)
      )
    ).then((rows) => rows.some(Boolean))
    if (!hasConflict) break
    candidateBaseName = `${sourceBaseName}-${collisionCounter}`
    collisionCounter += 1
  }

  if (options?.dryRun) {
    for (const sibling of siblings) {
      if (options?.summary) options.summary.filesMoved += 1
      console.log(`[media-backfill] dry-run copy`, {
        context: options?.logContext || "copy-category-image",
        from: sibling.absolutePath,
        to: path.join(targetDir, deriveFileName(candidateBaseName, sibling.fileName)),
      })
    }
    return storage.getPublicUrl(`${targetFolder}/${deriveFileName(candidateBaseName, masterSibling.fileName)}`)
  }

  await mkdir(targetDir, { recursive: true })
  await ensureMediaRegistryTable()
  for (const sibling of siblings) {
    const nextFileName = deriveFileName(candidateBaseName, sibling.fileName)
    const targetPath = path.join(targetDir, nextFileName)
    await copyFile(sibling.absolutePath, targetPath)
    const nextUrl = storage.getPublicUrl(`${targetFolder}/${nextFileName}`)
    const fileStats = await stat(targetPath).catch(() => null)
    await upsertMediaAsset({
      id: `${targetFolder}:${nextFileName}`,
      image_url: nextUrl,
      variant: nextFileName.match(/-(thumb|large|master)\./i)?.[1] || null,
      is_primary: /-master\./i.test(nextFileName),
      master_url: storage.getPublicUrl(`${targetFolder}/${deriveFileName(candidateBaseName, masterSibling.fileName)}`),
      size_bytes: fileStats?.size ?? null,
      storage_provider: "local",
      object_key: `${targetFolder}/${nextFileName}`,
    })
    if (options?.summary) options.summary.filesMoved += 1
  }

  return storage.getPublicUrl(`${targetFolder}/${deriveFileName(candidateBaseName, masterSibling.fileName)}`)
}

export async function ensureProductSkuFolders(categoryIds: string[], sku: string | null | undefined) {
  const targetFolder = await resolveCanonicalProductFolder(categoryIds, sku)
  if (!targetFolder) return

  const uploadRoot = path.join(process.cwd(), "public", "uploads")
  await mkdir(uploadRoot, { recursive: true })
  await ensureCategoryMediaFolders()
  const targetPath = path.join(uploadRoot, targetFolder)
  const exists = await stat(targetPath).then(() => true).catch(() => false)
  if (exists) return
  await mkdir(targetPath, { recursive: true })
}

export async function ensureAllProductSkuFolders() {
  const products = await prisma.product.findMany({
    where: {
      sku: {
        not: null,
      },
    },
    select: {
      sku: true,
      categories: {
        select: { id: true },
      },
    },
  })

  for (const product of products) {
    await ensureProductSkuFolders(
      product.categories.map((category) => category.id),
      product.sku
    )
  }
}

async function getOrderedCategoryPaths(categoryIds: string[]) {
  if (categoryIds.length === 0) return [] as string[]
  const categories = await prisma.category.findMany({
    select: { id: true, slug: true, parentId: true },
  })

  const byId = new Map(categories.map((category) => [category.id, category]))
  const cache = new Map<string, string>()

  const resolveRoot = (id: string): string => {
    if (cache.has(id)) return cache.get(id) || ""
    const current = byId.get(id)
    if (!current) return ""
    const parentPath = current.parentId ? resolveRoot(current.parentId) : ""
    const currentPath = sanitizeFolderPath([parentPath, current.slug].filter(Boolean).join("/"))
    cache.set(id, currentPath)
    return currentPath
  }

  const folders: string[] = []
  for (const categoryId of categoryIds) {
    const categoryPath = resolveRoot(categoryId)
    if (categoryPath && !folders.includes(categoryPath)) {
      folders.push(categoryPath)
    }
  }

  return folders
}

async function resolveCanonicalProductFolder(
  categoryIds: string[],
  sku: string | null | undefined,
  imageUrls: string[] = []
) {
  const candidateFolders = await getOrderedCategoryPaths(categoryIds)
  const imageFolderCandidates = imageUrls
    .map((url) => extractFolderFromManagedUrl(url))
    .filter(Boolean)

  const matchedFromImages = imageFolderCandidates
    .flatMap((folder) => {
      const topFolder = folder.split("/").filter(Boolean)[0] || ""
      return candidateFolders
        .filter((candidate) => {
          const candidateTopFolder = candidate.split("/").filter(Boolean)[0] || ""
          return candidateTopFolder === topFolder
        })
        .sort((a, b) => b.length - a.length)
    })[0]

  const baseFolder = matchedFromImages || candidateFolders[0] || ""
  const normalizedSku = sanitizeFolderPath(sku || "")
  if (!baseFolder || !normalizedSku) return ""
  return `${baseFolder}/${normalizedSku}`
}

export async function getCanonicalProductMediaFolder(
  categoryIds: string[],
  sku: string | null | undefined,
  imageUrls: string[] = []
) {
  return resolveCanonicalProductFolder(categoryIds, sku, imageUrls)
}

function replaceManagedUrlFolder(url: string | undefined, targetFolder: string) {
  const storage = getStorageProvider()
  const relativePath = storage.toRelativePath(url || "")
  const fileName = relativePath ? path.posix.basename(relativePath) : ""
  if (!fileName) return url || ""
  return storage.getPublicUrl(`${targetFolder}/${fileName}`)
}

function extractFolderFromManagedUrl(url: string) {
  const relativePath = getStorageProvider().toRelativePath(url)
  if (!relativePath) return ""
  return sanitizeFolderPath(path.posix.dirname(relativePath))
}

async function getSiblingUploadAssets(url: string) {
  const storage = getStorageProvider()
  const relativePath = storage.toRelativePath(url)
  if (!relativePath) return [] as Array<{ url: string; absolutePath: string; fileName: string }>

  const folder = sanitizeFolderPath(path.posix.dirname(relativePath))
  const fileName = path.posix.basename(relativePath)
  const baseName = fileName
    .replace(/-(thumb|large|master)\.(webp|avif)$/i, "")
    .replace(/\.(png|jpe?g|gif|webp|avif)$/i, "")

  const variantNames = [
    `${baseName}-thumb.webp`,
    `${baseName}-large.webp`,
    `${baseName}-master.webp`,
    `${baseName}-master.avif`,
  ]

  const assets: Array<{ url: string; absolutePath: string; fileName: string }> = []
  for (const variantName of variantNames) {
    const relativeVariantPath = [...(folder ? [folder] : []), variantName].join("/")
    const absolutePath = path.join(process.cwd(), "public", "uploads", relativeVariantPath)
    const exists = await stat(absolutePath).then(() => true).catch(() => false)
    if (!exists) continue
    assets.push({
      url: storage.getPublicUrl(relativeVariantPath),
      absolutePath,
      fileName: variantName,
    })
  }
  return assets
}

async function pruneEmptyUploadFolders(folder: string) {
  const uploadRoot = path.join(process.cwd(), "public", "uploads")
  let current = sanitizeFolderPath(folder)

  while (current) {
    const currentPath = path.join(uploadRoot, current)
    const entries = await readdir(currentPath).catch(() => null)
    if (!entries || entries.length > 0) break
    await rmdir(currentPath).catch(() => undefined)
    const next = current.split("/").slice(0, -1).join("/")
    if (!next || next === current) break
    current = next
  }
}

export async function removeProductMediaFolder(
  categoryIds: string[],
  sku: string | null | undefined,
  imageUrls: string[] = []
) {
  const normalizedSku = sanitizeFolderPath(sku || "")
  if (!normalizedSku) return

  const candidateFolders = new Set<string>()
  const canonicalFolder = await resolveCanonicalProductFolder(categoryIds, normalizedSku, imageUrls)
  if (canonicalFolder) candidateFolders.add(canonicalFolder)
  const categoryRoots = new Set((await getOrderedCategoryPaths(categoryIds)).map((folder) => folder.split("/")[0] || folder))

  for (const imageUrl of imageUrls) {
    const folder = extractFolderFromManagedUrl(imageUrl)
    const leaf = folder.split("/").filter(Boolean).pop() || ""
    if (folder && leaf === normalizedSku) {
      candidateFolders.add(folder)
    }
  }

  const uploadRoot = path.join(process.cwd(), "public", "uploads")
  for (const folder of candidateFolders) {
    const remainingProducts = await prisma.product.findMany({
      where: {
        sku: normalizedSku,
      },
      select: {
        id: true,
        categories: { select: { id: true } },
      },
    })
    const stillLinked = await Promise.all(
      remainingProducts.map(async (product) => {
        const roots = new Set((await getOrderedCategoryPaths(product.categories.map((category) => category.id))).map((item) => item.split("/")[0] || item))
        return Array.from(roots).some((root) => categoryRoots.has(root))
      })
    ).then((rows) => rows.some(Boolean))
    if (stillLinked) {
      console.warn(`[media-folders] skip folder delete; another product is still linked`, {
        folder,
        sku: normalizedSku,
      })
      continue
    }

    const absolutePath = path.join(uploadRoot, folder)
    if (!absolutePath.startsWith(uploadRoot)) continue
    await rm(absolutePath, { recursive: true, force: true }).catch(() => undefined)
  }
}

export async function moveManagedAssetGroupToFolder(
  url: string,
  targetFolder: string,
  options?: { dryRun?: boolean; summary?: MediaBackfillSummary; logContext?: string }
) {
  const siblings = await getSiblingUploadAssets(url)
  if (siblings.length === 0) return url

  const sourceFolder = extractFolderFromManagedUrl(url)
  const safeTargetFolder = sanitizeFolderPath(targetFolder)
  if (!safeTargetFolder || sourceFolder === safeTargetFolder) return url

  if (options?.summary) {
    options.summary.totalFilesScanned += siblings.length
  }
  const targetDir = path.join(process.cwd(), "public", "uploads", safeTargetFolder)
  if (!options?.dryRun) {
    await mkdir(targetDir, { recursive: true })
  }

  const storage = getStorageProvider()
  const masterSibling = siblings.find((sibling) => sibling.fileName.includes("-master.")) || siblings[0]
  for (const sibling of siblings) {
    const targetPath = path.join(targetDir, sibling.fileName)
    const exists = await stat(targetPath).then(() => true).catch(() => false)
    if (exists) {
      if (options?.summary) options.summary.potentialConflicts += 1
      console.warn(`[media-backfill] conflict`, {
        context: options?.logContext || "move",
        source: sibling.absolutePath,
        target: targetPath,
        dryRun: Boolean(options?.dryRun),
      })
      return storage.getPublicUrl(`${safeTargetFolder}/${masterSibling.fileName}`)
    }
  }

  let nextPrimaryUrl = url
  if (options?.dryRun) {
    for (const sibling of siblings) {
      if (options?.summary) options.summary.filesMoved += 1
      console.log(`[media-backfill] dry-run move`, {
        context: options?.logContext || "move",
        from: sibling.absolutePath,
        to: path.join(targetDir, sibling.fileName),
      })
    }
    return storage.getPublicUrl(`${safeTargetFolder}/${masterSibling.fileName}`)
  }

  await ensureMediaRegistryTable()
  for (const sibling of siblings) {
    const targetPath = path.join(targetDir, sibling.fileName)
    await rename(sibling.absolutePath, targetPath)
    const nextUrl = storage.getPublicUrl(`${safeTargetFolder}/${sibling.fileName}`)
    await prisma.$executeRaw`
      UPDATE "MediaAsset"
      SET "image_url" = ${nextUrl}, "object_key" = ${`${safeTargetFolder}/${sibling.fileName}`}
      WHERE "image_url" = ${sibling.url}
    `
    if (sibling.fileName.endsWith("-master.webp")) {
      nextPrimaryUrl = nextUrl
    }
    if (options?.summary) options.summary.filesMoved += 1
  }

  await pruneEmptyUploadFolders(sourceFolder)
  return nextPrimaryUrl
}

export async function relocateProductImagesToSkuFolders(
  imageUrls: string[],
  categoryIds: string[],
  sku: string | null | undefined,
  options?: { dryRun?: boolean; summary?: MediaBackfillSummary; logContext?: string }
) {
  const targetFolder = await resolveCanonicalProductFolder(categoryIds, sku, imageUrls)
  if (!targetFolder || imageUrls.length === 0) {
    return imageUrls
  }

  const nextUrls: string[] = []
  for (const url of imageUrls) {
    const currentFolder = extractFolderFromManagedUrl(url)
    if (currentFolder === targetFolder) {
      if (options?.summary) options.summary.skippedFiles += 1
      nextUrls.push(url)
      continue
    }
    if (!options?.dryRun) {
      await mkdir(path.join(process.cwd(), "public", "uploads", targetFolder), { recursive: true })
    }
    const movedUrl = await moveManagedAssetGroupToFolder(url, targetFolder, options)
    nextUrls.push(movedUrl)
  }

  return nextUrls
}

export async function migrateAllProductsToCanonicalMediaFolders() {
  const summary = createBackfillSummary()
  const products = await prisma.product.findMany({
    select: {
      id: true,
      sku: true,
      images: true,
      categories: {
        select: { id: true },
      },
    },
  })

  for (const product of products) {
    const categoryIds = product.categories.map((category) => category.id)
    const sku = sanitizeFolderPath(product.sku || "")
    if (!sku || categoryIds.length === 0) continue

    const currentImages = normalizeProductImageRecords(product.images)
    if (currentImages.length === 0) continue

    const currentUrls = currentImages.map((image) => image.image_url)
    const nextUrls = await relocateProductImagesToSkuFolders(currentUrls, categoryIds, sku, {
      dryRun: isMediaBackfillDryRun(),
      summary,
      logContext: `product:${product.id}`,
    })
    const didChange = nextUrls.some((url, index) => url !== currentUrls[index])
    if (!didChange) continue

    const targetFolder = await resolveCanonicalProductFolder(categoryIds, sku, currentUrls)
    if (!targetFolder) continue

    const nextImages = currentImages.map((image, index) => ({
      ...image,
      image_url: nextUrls[index] || image.image_url,
      variants: {
        thumb: replaceManagedUrlFolder(image.variants?.thumb || image.image_url, targetFolder),
        large: replaceManagedUrlFolder(image.variants?.large || image.image_url, targetFolder),
        master: replaceManagedUrlFolder(image.variants?.master || image.image_url, targetFolder),
      },
    }))

    if (isMediaBackfillDryRun()) {
      console.log(`[media-backfill] dry-run product image rewrite`, {
        productId: product.id,
        targetFolder,
        currentUrls,
        nextUrls,
      })
      continue
    }

    await prisma.product.update({
      where: { id: product.id },
      data: {
        images: JSON.stringify(nextImages),
      },
    })
  }

  logBackfillSummary(summary, "migrateAllProductsToCanonicalMediaFolders")
}
