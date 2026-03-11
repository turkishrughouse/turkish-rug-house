import { mkdir, readdir, rename, rm, rmdir, stat } from "fs/promises"
import path from "path"
import { prisma } from "@/lib/db"
import { ensureMediaRegistryTable } from "@/lib/media-registry"
import { shouldUseProductSkuFolder } from "@/lib/media-sku-roots"
import { getStorageProvider } from "@/lib/storage/provider"

const MANAGED_MEDIA_ROOTS = ["categories", "pages", "profile"] as const
const LEGACY_MEDIA_ROOTS = ["root", "general", "external", "cache", ".cache", "products", "profiles"] as const

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

export async function ensureProductSkuFolders(categoryIds: string[], sku: string | null | undefined) {
  const normalizedSku = sanitizeFolderPath(sku || "")
  if (!normalizedSku || categoryIds.length === 0) return

  const uploadRoot = path.join(process.cwd(), "public", "uploads")
  await mkdir(uploadRoot, { recursive: true })
  await ensureCategoryMediaFolders()

  const categories = await prisma.category.findMany({
    select: { id: true, slug: true, parentId: true },
  })

  const byId = new Map(categories.map((category) => [category.id, category]))
  const cache = new Map<string, string>()

  const resolvePath = (id: string): string => {
    if (cache.has(id)) return cache.get(id) || ""
    const current = byId.get(id)
    if (!current) return ""
    const parentPath = current.parentId ? resolvePath(current.parentId) : ""
    const currentPath = sanitizeFolderPath(parentPath ? `${parentPath}/${current.slug}` : current.slug)
    cache.set(id, currentPath)
    return currentPath
  }

  for (const categoryId of categoryIds) {
    const categoryPath = resolvePath(categoryId)
    if (!categoryPath || !shouldUseProductSkuFolder(categoryPath)) continue
    await mkdir(path.join(uploadRoot, categoryPath, normalizedSku), { recursive: true })
  }
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

async function getCategoryPathMap(categoryIds: string[]) {
  if (categoryIds.length === 0) return new Map<string, string>()
  const categories = await prisma.category.findMany({
    select: { id: true, slug: true, parentId: true },
  })

  const byId = new Map(categories.map((category) => [category.id, category]))
  const cache = new Map<string, string>()

  const resolvePath = (id: string): string => {
    if (cache.has(id)) return cache.get(id) || ""
    const current = byId.get(id)
    if (!current) return ""
    const parentPath = current.parentId ? resolvePath(current.parentId) : ""
    const currentPath = sanitizeFolderPath(parentPath ? `${parentPath}/${current.slug}` : current.slug)
    cache.set(id, currentPath)
    return currentPath
  }

  for (const categoryId of categoryIds) {
    resolvePath(categoryId)
  }

  return cache
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

export async function moveManagedAssetGroupToFolder(url: string, targetFolder: string) {
  const siblings = await getSiblingUploadAssets(url)
  if (siblings.length === 0) return url

  const sourceFolder = extractFolderFromManagedUrl(url)
  const safeTargetFolder = sanitizeFolderPath(targetFolder)
  if (!safeTargetFolder || sourceFolder === safeTargetFolder) return url

  const targetDir = path.join(process.cwd(), "public", "uploads", safeTargetFolder)
  await mkdir(targetDir, { recursive: true })

  for (const sibling of siblings) {
    const targetPath = path.join(targetDir, sibling.fileName)
    const exists = await stat(targetPath).then(() => true).catch(() => false)
    if (exists) {
      return url
    }
  }

  const storage = getStorageProvider()
  let nextPrimaryUrl = url
  await ensureMediaRegistryTable()
  for (const sibling of siblings) {
    const targetPath = path.join(targetDir, sibling.fileName)
    await rename(sibling.absolutePath, targetPath)
    const nextUrl = storage.getPublicUrl(`${safeTargetFolder}/${sibling.fileName}`)
    await prisma.$executeRawUnsafe(
      `UPDATE "MediaAsset" SET "image_url" = ?, "object_key" = ? WHERE "image_url" = ?`,
      nextUrl,
      `${safeTargetFolder}/${sibling.fileName}`,
      sibling.url
    )
    if (sibling.fileName.endsWith("-master.webp")) {
      nextPrimaryUrl = nextUrl
    }
  }

  await pruneEmptyUploadFolders(sourceFolder)
  return nextPrimaryUrl
}

export async function relocateProductImagesToSkuFolders(imageUrls: string[], categoryIds: string[], sku: string | null | undefined) {
  const normalizedSku = sanitizeFolderPath(sku || "")
  if (!normalizedSku || categoryIds.length === 0 || imageUrls.length === 0) {
    return imageUrls
  }

  const categoryPathMap = await getCategoryPathMap(categoryIds)
  const targetCategoryFolders = Array.from(new Set(categoryIds
    .map((categoryId) => categoryPathMap.get(categoryId) || "")
    .filter((folder) => shouldUseProductSkuFolder(folder))))

  if (targetCategoryFolders.length === 0) {
    return imageUrls
  }

  const nextUrls: string[] = []
  for (const url of imageUrls) {
    const currentFolder = extractFolderFromManagedUrl(url)
    const matchedBaseFolder = targetCategoryFolders.find((folder) => currentFolder === folder)
    const targetBaseFolder = matchedBaseFolder || targetCategoryFolders[0] || ""
    if (!targetBaseFolder) {
      nextUrls.push(url)
      continue
    }

    const targetFolder = `${targetBaseFolder}/${normalizedSku}`
    await mkdir(path.join(process.cwd(), "public", "uploads", targetFolder), { recursive: true })
    const movedUrl = await moveManagedAssetGroupToFolder(url, targetFolder)
    nextUrls.push(movedUrl)
  }

  return nextUrls
}
