import { NextRequest, NextResponse } from "next/server"
import { mkdir, readdir, rmdir, stat, unlink, rename } from "fs/promises"
import path from "path"
import { z } from "zod"
import { prisma } from "@/lib/db"
import {
  CATEGORY_IMAGE_ROOT,
  sanitizeFolderPath,
  ensureCategoryMediaFolders,
  ensureAllProductSkuFolders,
  ensureManagedMediaFolders,
  cleanupLegacyMediaFolders,
  getManagedMediaRoots,
  getCategoryImageFolderPath,
  relocateCategoryImageToFolder,
} from "@/lib/media-folders"
import { logger } from "@/lib/logger"
import { getStorageProvider } from "@/lib/storage/provider"
import { parseProductImages } from "@/lib/product-images"
import { ensureMediaRegistryTable } from "@/lib/media-registry"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type MediaAsset = {
  id: string
  url: string
  name: string
  folder: string
  source: "UPLOAD" | "PRODUCT" | "CATEGORY" | "PAGE_FEATURED" | "PAGE_CONTENT" | "PROFILE"
  usedIn: string
  createdAt: number
  sizeBytes?: number
}

type FolderInfo = {
  name: string
  path: string
}

type CategoryFolderMeta = {
  path: string
  label: string
  count: number
  productCount: number
}

type ProductFolderMeta = {
  path: string
  categoryPath: string
  sku: string
  productId: string
  count: number
}

type MediaBackfillSummary = {
  totalFilesScanned: number
  filesMoved: number
  skippedFiles: number
  potentialConflicts: number
}

type UploadCandidate = {
  folder: string
  url: string
}

type AggregatedMediaAsset = {
  id: string
  url: string
  name: string
  folder: string
  source: string
  usedIn: string
  createdAt: number
  sizeBytes?: number
}

type UploadVariantGroup = {
  baseKey: string
  relativeBase: string
  folder: string
  masterRelative: string
  createdAt: number
  sizeBytes?: number
}

type SiblingUploadAsset = {
  url: string
  relativePath: string
  absolutePath: string
  fileName: string
}

const createFolderSchema = z.object({
  name: z.string().min(1, "Folder name is required"),
  parentFolder: z.string().optional().nullable(),
})
const deleteAssetSchema = z.object({
  url: z.string().min(1),
})
const moveAssetSchema = z.object({
  url: z.string().min(1),
  targetFolder: z.string().min(1),
})

const OPTIMIZED_ROOT = "_optimized"

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
function normalizeUploadRelativePath(relativePath: string) {
  return (relativePath || "")
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && segment !== "." && segment !== "..")
    .join("/")
}

function fileNameFromUrl(url: string): string {
  try {
    const clean = url.split("?")[0]
    return clean.split("/").filter(Boolean).pop() || "file"
  } catch {
    return "file"
  }
}

function toLogicalUploadRelativePath(relativePath: string) {
  const clean = normalizeUploadRelativePath(relativePath)
  if (!clean) return ""
  if (clean === OPTIMIZED_ROOT) return ""
  if (clean.startsWith(`${OPTIMIZED_ROOT}/`)) {
    return clean.slice(OPTIMIZED_ROOT.length + 1)
  }
  return clean
}

function extractFolderFromUrl(url: string): string {
  const storage = getStorageProvider()
  const relative = storage.toRelativePath(url)
  if (!relative) return "external"
  const logicalRelative = toLogicalUploadRelativePath(relative)
  const parts = logicalRelative.split("/").filter(Boolean)
  if (parts.length <= 1) return "root"
  return parts.slice(0, -1).join("/") || "root"
}

function resolveUploadInfo(url: string): { absolutePath: string; fileName: string } | null {
  const storage = getStorageProvider()
  const relative = storage.toRelativePath(url)
  if (!relative) return null
  const normalizedRelative = normalizeUploadRelativePath(relative)
  if (!normalizedRelative || normalizedRelative.includes("..")) return null

  const absolutePath = path.join(process.cwd(), "public", "uploads", normalizedRelative)
  const fileName = path.basename(normalizedRelative)
  if (!fileName) return null

  return { absolutePath, fileName }
}

function extractVariantBaseName(fileName: string) {
  return fileName.replace(/-(thumb|large|master)\.(avif|webp)$/i, "")
}

function extractVariantGroup(relativePath: string): UploadVariantGroup {
  const logicalRelative = toLogicalUploadRelativePath(relativePath)
  const normalizedRelative = logicalRelative || normalizeUploadRelativePath(relativePath)
  const parts = normalizedRelative.split("/").filter(Boolean)
  const fileName = parts.pop() || ""
  const folder = parts.join("/") || "root"
  const baseName = extractVariantBaseName(fileName)
  const relativeBase = [...parts, baseName].filter(Boolean).join("/") || baseName
  const isVariant = /-(thumb|large|master)\.(avif|webp)$/i.test(fileName)
  const masterRelative = isVariant
    ? [...parts, `${baseName}-master.webp`].filter(Boolean).join("/")
    : normalizedRelative

  return {
    baseKey: relativeBase.toLowerCase(),
    relativeBase,
    folder,
    masterRelative,
    createdAt: 0,
  }
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function topFolderName(folder: string) {
  const clean = sanitizeFolderPath(folder)
  return clean.split("/")[0] || clean
}

function looksLikeSkuFolderName(value: string) {
  const clean = sanitizeFolderPath(value)
  return /[0-9]/.test(clean) && /^[A-Z0-9-]{6,}$/i.test(clean)
}

function normalizeAssetUrl(
  rawUrl: string,
  fallbackFolder?: string,
  uploadLookup?: Map<string, UploadCandidate[]>
) {
  const storage = getStorageProvider()
  const value = (rawUrl || "").trim()
  if (!value) return ""

  const relativeFromStorage = storage.toRelativePath(value)
  if (relativeFromStorage) return storage.getPublicUrl(relativeFromStorage)

  if (value.startsWith("http://") || value.startsWith("https://")) return value

  const withoutLeadingSlash = value.replace(/^\/+/, "")
  if (withoutLeadingSlash.startsWith("uploads/")) {
    return storage.getPublicUrl(withoutLeadingSlash.slice("uploads/".length))
  }

  const looksLikeFileName = !value.includes("/") && !value.includes("\\")
  if (looksLikeFileName) {
    const candidates = uploadLookup?.get(value.toLowerCase()) || []
    if (candidates.length === 1) return candidates[0].url

    if (candidates.length > 1 && fallbackFolder) {
      const folder = sanitizeFolderPath(fallbackFolder)
      if (folder) {
        const exact = candidates.find((item) => item.folder === folder)
        if (exact) return exact.url
        const nested = candidates.find((item) => item.folder.startsWith(`${folder}/`))
        if (nested) return nested.url
      }
      return candidates[0].url
    }
  }

  return value
}

function buildUploadLookup(uploadedFiles: MediaAsset[]) {
  const lookup = new Map<string, UploadCandidate[]>()
  for (const asset of uploadedFiles) {
    const key = (asset.name || fileNameFromUrl(asset.url)).toLowerCase()
    if (!key) continue
    const list = lookup.get(key) || []
    list.push({ folder: asset.folder, url: asset.url })
    lookup.set(key, list)
  }
  return lookup
}

function buildCategoryPathMap(
  categories: Array<{ id: string; slug: string; parentId: string | null }>
) {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const cache = new Map<string, string>()

  const resolvePath = (id: string): string => {
    if (cache.has(id)) return cache.get(id) || ""
    const current = byId.get(id)
    if (!current) return ""
    const parentPath = current.parentId ? resolvePath(current.parentId) : ""
    const next = sanitizeFolderPath(`${parentPath}/${current.slug}`)
    cache.set(id, next)
    return next
  }

  for (const category of categories) resolvePath(category.id)
  return cache
}

async function getAllowedFolderRoots() {
  const managed = getManagedMediaRoots().map((item) => sanitizeFolderPath(item)).filter(Boolean)
  const topCategories = await prisma.category.findMany({
    where: { parentId: null },
    select: { slug: true },
  })
  const categoryRoots = topCategories.map((item) => sanitizeFolderPath(item.slug)).filter(Boolean)
  const uploadRoot = path.join(process.cwd(), "public", "uploads")
  const diskRoots = await readdir(uploadRoot, { withFileTypes: true })
    .catch(() => [])
    .then((entries) =>
      entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => sanitizeFolderPath(entry.name))
        .filter(Boolean)
    )
  return new Set([...managed, ...categoryRoots, ...diskRoots])
}

async function replaceUrlReferences(oldUrl: string, nextUrl: string | null) {
  const [products, categories, pages, profiles] = await Promise.all([
    prisma.product.findMany({ select: { id: true, images: true } }),
    prisma.category.findMany({ select: { id: true, image: true } }),
    prisma.page.findMany({ select: { id: true, featuredImage: true, content: true } }),
    prisma.customerProfile.findMany({ select: { id: true, avatarUrl: true } }),
  ])

  for (const product of products) {
    const images = parseProductImages(product.images)

    let changed = false
    const updated = images
      .map((img) => {
        if (img !== oldUrl) return img
        changed = true
        return nextUrl
      })
      .filter((img): img is string => Boolean(img))

    if (changed) {
      await prisma.product.update({
        where: { id: product.id },
        data: { images: JSON.stringify(updated) },
      })
    }
  }

  for (const category of categories) {
    if (category.image !== oldUrl) continue
    await prisma.category.update({
      where: { id: category.id },
      data: { image: nextUrl },
    })
  }

  const escaped = escapeRegExp(oldUrl)
  const imgTagRegex = new RegExp(`<img[^>]*src=["']${escaped}["'][^>]*>`, "gi")
  const urlRegex = new RegExp(escaped, "g")

  for (const page of pages) {
    const featuredChanged = page.featuredImage === oldUrl
    let nextContent = page.content || ""
    const hadInContent = nextContent.includes(oldUrl)

    if (hadInContent) {
      if (nextUrl) {
        nextContent = nextContent.replace(urlRegex, nextUrl)
      } else {
        nextContent = nextContent.replace(imgTagRegex, "")
        nextContent = nextContent.replace(urlRegex, "")
      }
    }

    if (featuredChanged || hadInContent) {
      await prisma.page.update({
        where: { id: page.id },
        data: {
          featuredImage: featuredChanged ? nextUrl : undefined,
          content: hadInContent ? nextContent : undefined,
        },
      })
    }
  }

  for (const profile of profiles) {
    if (profile.avatarUrl !== oldUrl) continue
    await prisma.customerProfile.update({
      where: { id: profile.id },
      data: { avatarUrl: nextUrl },
    })
  }
}

async function listUploadFolders(rootDir: string, relative = ""): Promise<FolderInfo[]> {
  const current = path.join(rootDir, relative)
  const entries = await readdir(current, { withFileTypes: true }).catch(() => [])
  const folders: FolderInfo[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const childRelative = relative ? `${relative}/${entry.name}` : entry.name
    const logicalPath = toLogicalUploadRelativePath(childRelative)
    if (logicalPath) {
      const logicalName = logicalPath.split("/").pop() || logicalPath
      folders.push({ name: logicalName, path: logicalPath })
    }
    const nested = await listUploadFolders(rootDir, childRelative)
    folders.push(...nested)
  }

  return folders
}

async function listUploadFiles(rootDir: string, relative = ""): Promise<MediaAsset[]> {
  const storage = getStorageProvider()
  const current = path.join(rootDir, relative)
  const entries = await readdir(current, { withFileTypes: true }).catch(() => [])
  const groups = new Map<string, UploadVariantGroup>()

  for (const entry of entries) {
    const childRelative = relative ? `${relative}/${entry.name}` : entry.name
    const fullPath = path.join(rootDir, childRelative)

    if (entry.isDirectory()) {
      const nestedAssets = await listUploadFiles(rootDir, childRelative)
      for (const asset of nestedAssets) {
        const group = extractVariantGroup(getStorageProvider().toRelativePath(asset.url) || "")
        groups.set(`${asset.folder}@@${group.baseKey}`, {
          ...group,
          folder: asset.folder,
          masterRelative: getStorageProvider().toRelativePath(asset.url) || group.masterRelative,
          createdAt: asset.createdAt,
          sizeBytes: asset.sizeBytes,
        })
      }
      continue
    }

    const fileStats = await stat(fullPath).catch(() => null)
    if (!fileStats || !fileStats.isFile()) continue

    const group = extractVariantGroup(childRelative)
    const groupKey = `${group.folder}@@${group.baseKey}`
    const existing = groups.get(groupKey)
    const isPreferredMaster = childRelative === group.masterRelative

    if (!existing) {
      groups.set(groupKey, {
        ...group,
        createdAt: fileStats.mtimeMs,
        sizeBytes: fileStats.size,
        masterRelative: childRelative,
      })
      continue
    }

    if (fileStats.mtimeMs > existing.createdAt) {
      existing.createdAt = fileStats.mtimeMs
    }
    if (!existing.sizeBytes || isPreferredMaster) {
      existing.sizeBytes = fileStats.size
    }
    if (isPreferredMaster) {
      existing.masterRelative = childRelative
    }
  }

  return Array.from(groups.values()).map((group) => ({
    id: `upload:${group.masterRelative}`,
    url: storage.getPublicUrl(group.masterRelative),
    name: path.basename(group.masterRelative),
    folder: group.folder,
    source: "UPLOAD",
    usedIn: "Uploaded media",
    createdAt: group.createdAt,
    sizeBytes: group.sizeBytes,
  }))
}

async function getSiblingUploadUrls(url: string) {
  const storage = getStorageProvider()
  const relative = storage.toRelativePath(url)
  if (!relative) return [url]

  const logicalRelative = toLogicalUploadRelativePath(relative)
  const parts = logicalRelative.split("/").filter(Boolean)
  const fileName = parts.pop() || ""
  const folder = parts.join("/")
  const baseName = extractVariantBaseName(fileName)
  const variants = [
    `${baseName}-thumb.webp`,
    `${baseName}-large.webp`,
    `${baseName}-master.webp`,
    `${baseName}-master.avif`,
  ]

  const urls = new Set<string>([url])
  for (const variantName of variants) {
    const relativePath = [...(folder ? [folder] : []), variantName].join("/")
    if (!relativePath) continue
    const absolutePath = path.join(process.cwd(), "public", "uploads", relativePath)
    const exists = await stat(absolutePath).then(() => true).catch(() => false)
    if (exists) {
      urls.add(storage.getPublicUrl(relativePath))
    }
  }

  return Array.from(urls)
}

async function getSiblingUploadAssets(url: string): Promise<SiblingUploadAsset[]> {
  const storage = getStorageProvider()
  const relative = storage.toRelativePath(url)
  if (!relative) return []

  const normalizedRelative = normalizeUploadRelativePath(relative)
  const parts = normalizedRelative.split("/").filter(Boolean)
  const fileName = parts.pop() || ""
  const folder = parts.join("/")
  const baseName = extractVariantBaseName(fileName)
  const variantNames = [
    `${baseName}-thumb.webp`,
    `${baseName}-large.webp`,
    `${baseName}-master.webp`,
    `${baseName}-master.avif`,
  ]

  const assets: SiblingUploadAsset[] = []
  for (const variantName of variantNames) {
    const relativePath = [...(folder ? [folder] : []), variantName].join("/")
    if (!relativePath) continue
    const absolutePath = path.join(process.cwd(), "public", "uploads", relativePath)
    const exists = await stat(absolutePath).then(() => true).catch(() => false)
    if (!exists) continue
    assets.push({
      url: storage.getPublicUrl(relativePath),
      relativePath,
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

async function moveUploadedAssetToFolder(
  url: string,
  targetFolder: string,
  options: {
    dryRun?: boolean
    summary?: MediaBackfillSummary
    logContext?: string
  } = {}
) {
  const siblings = await getSiblingUploadAssets(url)
  if (siblings.length === 0) return null

  if (options.summary) {
    options.summary.totalFilesScanned += siblings.length
  }

  const sourceFolder = extractFolderFromUrl(url)
  if (sourceFolder === targetFolder) {
    if (options.summary) {
      options.summary.skippedFiles += siblings.length
    }
    return url
  }

  const targetDir = path.join(process.cwd(), "public", "uploads", targetFolder)
  if (!options.dryRun) {
    await mkdir(targetDir, { recursive: true })
  }

  for (const sibling of siblings) {
    const targetPath = path.join(targetDir, sibling.fileName)
    const exists = await stat(targetPath).then(() => true).catch(() => false)
    if (exists) {
      if (options.summary) {
        options.summary.potentialConflicts += 1
      }
      if (options.dryRun) {
        console.warn("[media-backfill] DRY_RUN conflict", {
          url: sibling.url,
          targetFolder,
          targetPath,
          context: options.logContext || "backfill",
        })
      }
      return null
    }
  }

  const storage = getStorageProvider()
  if (options.dryRun) {
    for (const sibling of siblings) {
      console.log("[media-backfill] DRY_RUN move", {
        from: sibling.relativePath,
        to: `${targetFolder}/${sibling.fileName}`,
        context: options.logContext || "backfill",
      })
    }
    if (options.summary) {
      options.summary.filesMoved += siblings.length
    }
    const preferredSibling =
      siblings.find((sibling) => sibling.fileName.endsWith("-master.webp")) || siblings[0]
    return preferredSibling ? storage.getPublicUrl(`${targetFolder}/${preferredSibling.fileName}`) : url
  }

  let nextPrimaryUrl = ""
  await ensureMediaRegistryTable()
  for (const sibling of siblings) {
    const targetPath = path.join(targetDir, sibling.fileName)
    await rename(sibling.absolutePath, targetPath)
    const nextUrl = storage.getPublicUrl(`${targetFolder}/${sibling.fileName}`)
    await replaceUrlReferences(sibling.url, nextUrl)
    await prisma.$executeRaw`
      UPDATE "MediaAsset"
      SET "image_url" = ${nextUrl}, "object_key" = ${`${targetFolder}/${sibling.fileName}`}
      WHERE "image_url" = ${sibling.url}
    `
    if (sibling.fileName.endsWith("-master.webp") || !nextPrimaryUrl) {
      nextPrimaryUrl = nextUrl
    }
  }
  await pruneEmptyUploadFolders(sourceFolder)
  return nextPrimaryUrl || url
}

async function backfillProductSkuFolders(
  products: Array<{ id: string; sku: string | null; title: string; images: string; categories: Array<{ id: string; slug: string; parentId: string | null }> }>,
  categoryPathMap: Map<string, string>,
  options: {
    dryRun?: boolean
    summary?: MediaBackfillSummary
  } = {}
) {
  for (const product of products) {
    const sku = sanitizeFolderPath(product.sku || "")
    if (!sku) continue

    const productImages = parseProductImages(product.images)
    const targetCategoryFolders = Array.from(
      new Set(
        product.categories
          .map((category) => topFolderName(categoryPathMap.get(category.id) || category.slug))
          .filter(Boolean)
      )
    )

    if (targetCategoryFolders.length === 0) continue

    for (const categoryFolder of targetCategoryFolders) {
      const targetFolder = `${categoryFolder}/${sku}`
      if (!options.dryRun) {
        await mkdir(path.join(process.cwd(), "public", "uploads", targetFolder), { recursive: true })
      }
    }

    for (const imageUrl of productImages) {
      const currentFolder = extractFolderFromUrl(imageUrl)
      const matchedCategoryFolder = targetCategoryFolders.find((folder) => {
        if (!currentFolder || currentFolder === "root") return false
        const currentTopFolder = topFolderName(currentFolder)
        return currentTopFolder === folder
      })
      if (!matchedCategoryFolder) continue
      const targetFolder = `${matchedCategoryFolder}/${sku}`
      if (currentFolder === targetFolder) {
        if (options.summary) {
          options.summary.skippedFiles += 1
        }
        continue
      }
      await moveUploadedAssetToFolder(imageUrl, targetFolder, {
        dryRun: options.dryRun,
        summary: options.summary,
        logContext: `product:${product.id}`,
      }).catch(() => null)
    }
  }
}

export async function GET() {
  try {
    const uploadRoot = path.join(process.cwd(), "public", "uploads")
    await ensureManagedMediaFolders()
    await cleanupLegacyMediaFolders()
    await ensureCategoryMediaFolders()
    await ensureAllProductSkuFolders()
    const allowedRoots = await getAllowedFolderRoots()

    const [products, categories, pages, profiles] = await Promise.all([
      prisma.product.findMany({
        select: {
          id: true,
          sku: true,
          title: true,
          images: true,
          categories: { select: { id: true, slug: true, parentId: true } },
        },
      }),
      prisma.category.findMany({ select: { id: true, title: true, slug: true, parentId: true, image: true } }),
      prisma.page.findMany({ select: { id: true, title: true, slug: true, featuredImage: true, content: true } }),
      prisma.customerProfile.findMany({ select: { id: true, firstName: true, lastName: true, displayName: true, avatarUrl: true } }),
    ])

    const categoryPathMap = buildCategoryPathMap(
      categories.map((category) => ({ id: category.id, slug: category.slug, parentId: category.parentId }))
    )
    const backfillSummary = createBackfillSummary()
    const backfillDryRun = isMediaBackfillDryRun()
    await backfillProductSkuFolders(products, categoryPathMap, {
      dryRun: backfillDryRun,
      summary: backfillSummary,
    })
    for (const category of categories) {
      if (!category.image) continue
      const nextImage = await relocateCategoryImageToFolder(category.slug, category.image, {
        dryRun: backfillDryRun,
        summary: backfillSummary,
        logContext: `category:${category.id}`,
      })
      if (!backfillDryRun && nextImage && nextImage !== category.image) {
        await prisma.category.update({
          where: { id: category.id },
          data: { image: nextImage },
        })
        category.image = nextImage
      }
    }
    if (backfillSummary.totalFilesScanned > 0 || backfillSummary.skippedFiles > 0 || backfillSummary.potentialConflicts > 0) {
      logBackfillSummary(backfillSummary, "api-admin-media-backfill")
    }

    const [uploadFolders, uploadedFiles] = await Promise.all([
      listUploadFolders(uploadRoot),
      listUploadFiles(uploadRoot),
    ])
    const uploadLookup = buildUploadLookup(uploadedFiles)

    const assets: MediaAsset[] = [...uploadedFiles]

    for (const product of products) {
      const imgs = parseProductImages(product.images)
      const featuredImage = imgs[0]
      if (!featuredImage) continue
      const productCategoryFolders = product.categories
        .map((category) => categoryPathMap.get(category.id) || "")
        .filter(Boolean)
      const defaultProductFolder = productCategoryFolders[0] || "categories/uncategorized"
      const uploadFolder = extractFolderFromUrl(featuredImage)
      const isUpload = Boolean(getStorageProvider().toRelativePath(featuredImage))
      const uploadFolderTop = topFolderName(uploadFolder)
      const canUseUploadFolder = isUpload && uploadFolder !== "root" && allowedRoots.has(uploadFolderTop)
      const folderCandidates = canUseUploadFolder
        ? [uploadFolder]
        : productCategoryFolders.length > 0
            ? productCategoryFolders
            : [defaultProductFolder]

      for (const folder of folderCandidates) {
        const normalizedFeaturedImage = normalizeAssetUrl(featuredImage, folder, uploadLookup)
        const relativeFeaturedImage = getStorageProvider().toRelativePath(normalizedFeaturedImage)
        if (relativeFeaturedImage) {
          const exists = uploadedFiles.some((file) => file.url === normalizedFeaturedImage)
          if (!exists) {
            console.warn("[media-integrity] product image reference missing on disk", {
              productId: product.id,
              productTitle: product.title,
              imageUrl: normalizedFeaturedImage,
            })
          }
        }
        assets.push({
          id: `product:${product.id}:${folder}:${normalizedFeaturedImage}`,
          url: normalizedFeaturedImage,
          name: fileNameFromUrl(normalizedFeaturedImage),
          folder,
          source: "PRODUCT",
          usedIn: `Product featured: ${product.title}`,
          createdAt: 0,
        })
      }
    }

    for (const category of categories) {
      if (!category.image) continue
      const categoryFolder = getCategoryImageFolderPath(category.slug) || CATEGORY_IMAGE_ROOT
      const normalizedCategoryImage = normalizeAssetUrl(category.image, categoryFolder, uploadLookup)
      assets.push({
        id: `category:${category.id}:${normalizedCategoryImage}`,
        url: normalizedCategoryImage,
        name: fileNameFromUrl(normalizedCategoryImage),
        folder: categoryFolder,
        source: "CATEGORY",
        usedIn: `Category: ${category.title}`,
        createdAt: 0,
      })
    }

    const contentImageRegex = /<img[^>]+src=["']([^"']+)["']/gi
    for (const page of pages) {
      if (page.featuredImage) {
        const normalizedFeatured = normalizeAssetUrl(page.featuredImage, "pages", uploadLookup)
        assets.push({
          id: `page-featured:${page.id}:${normalizedFeatured}`,
          url: normalizedFeatured,
          name: fileNameFromUrl(normalizedFeatured),
          folder: "pages",
          source: "PAGE_FEATURED",
          usedIn: `Page featured: ${page.title}`,
          createdAt: 0,
        })
      }

      const content = page.content || ""
      let match: RegExpExecArray | null
      while ((match = contentImageRegex.exec(content)) !== null) {
        const src = match[1]
        if (!src) continue
        const normalizedSrc = normalizeAssetUrl(src, "pages", uploadLookup)
        assets.push({
          id: `page-content:${page.id}:${normalizedSrc}`,
          url: normalizedSrc,
          name: fileNameFromUrl(normalizedSrc),
          folder: "pages",
          source: "PAGE_CONTENT",
          usedIn: `Page content: ${page.title}`,
          createdAt: 0,
        })
      }
    }

    for (const profile of profiles) {
      if (!profile.avatarUrl) continue
      const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim()
      const profileName = profile.displayName || fullName || "Profile"
      const normalizedAvatar = normalizeAssetUrl(profile.avatarUrl, "profile", uploadLookup)
      assets.push({
        id: `profile:${profile.id}:${normalizedAvatar}`,
        url: normalizedAvatar,
        name: fileNameFromUrl(normalizedAvatar),
        folder: "profile",
        source: "PROFILE",
        usedIn: `Profile: ${profileName}`,
        createdAt: 0,
      })
    }

    const dedup = new Map<string, AggregatedMediaAsset & { sourceSet: Set<string>; usedInSet: Set<string> }>()
    for (const asset of assets) {
      const assetTopFolder = topFolderName(asset.folder)
      if (!allowedRoots.has(assetTopFolder)) continue
      const dedupKey = `${asset.url}@@${asset.folder}`
      const existing = dedup.get(dedupKey)
      if (!existing) {
        dedup.set(dedupKey, {
          id: asset.id,
          url: asset.url,
          name: asset.name,
          folder: asset.folder,
          source: asset.source,
      usedIn: asset.usedIn,
      createdAt: asset.createdAt,
      sizeBytes: asset.sizeBytes,
      sourceSet: new Set([asset.source]),
      usedInSet: new Set([asset.usedIn]),
    })
        continue
      }

      existing.sourceSet.add(asset.source)
      existing.usedInSet.add(asset.usedIn)
      if (asset.createdAt > existing.createdAt) {
        existing.createdAt = asset.createdAt
      }
      if (!existing.sizeBytes && asset.sizeBytes) {
        existing.sizeBytes = asset.sizeBytes
      }
    }
    const uniqueAssets: AggregatedMediaAsset[] = Array.from(dedup.values()).map((asset) => ({
      id: asset.id,
      url: asset.url,
      name: asset.name,
      folder: asset.folder,
      source: Array.from(asset.sourceSet).join(", "),
      usedIn: Array.from(asset.usedInSet).slice(0, 3).join(" | "),
      createdAt: asset.createdAt,
      sizeBytes: asset.sizeBytes,
    }))

    const assetCountByFolder = new Map<string, number>()
    for (const asset of uniqueAssets) {
      assetCountByFolder.set(asset.folder, (assetCountByFolder.get(asset.folder) || 0) + 1)
    }

    const categoryFolders: CategoryFolderMeta[] = categories
      .filter((category) => !category.parentId)
      .map((category) => {
        const path = sanitizeFolderPath(category.slug)
        return {
          path,
          label: category.title || path,
          count: 0,
          productCount: 0,
        }
      })
      .filter((folder) => folder.path)
      .sort((a, b) => a.label.localeCompare(b.label))

    const categoryRootSet = new Set(categoryFolders.map((folder) => folder.path))

    const productFolderMap = new Map<string, ProductFolderMeta>()
    for (const product of products) {
      const sku = sanitizeFolderPath(product.sku || "")
      if (!sku) continue
      const categoryRoot = product.categories
        .map((category) => topFolderName(categoryPathMap.get(category.id) || category.slug))
        .find((folder) => categoryRootSet.has(folder))
      if (!categoryRoot) continue

      const path = `${categoryRoot}/${sku}`
      productFolderMap.set(path, {
        path,
        categoryPath: categoryRoot,
        sku,
        productId: product.id,
        count: assetCountByFolder.get(path) || 0,
      })
    }

    const productFolders = Array.from(productFolderMap.values()).sort((a, b) => {
      if (a.categoryPath !== b.categoryPath) return a.categoryPath.localeCompare(b.categoryPath)
      return a.sku.localeCompare(b.sku)
    })

    const productFolderCountByCategory = new Map<string, number>()
    for (const folder of productFolders) {
      productFolderCountByCategory.set(
        folder.categoryPath,
        (productFolderCountByCategory.get(folder.categoryPath) || 0) + 1
      )
    }

    const categoryFoldersWithCounts = categoryFolders.map((folder) => ({
      ...folder,
      productCount: productFolderCountByCategory.get(folder.path) || 0,
    }))

    const validProductFolderSet = new Set(productFolders.map((folder) => folder.path))

    const folderSet = new Map<string, number>()
    for (const asset of uniqueAssets) {
      folderSet.set(asset.folder, (folderSet.get(asset.folder) || 0) + 1)
    }
    for (const folder of uploadFolders) {
      const folderPath = folder.path || folder.name
      const top = topFolderName(folderPath)
      if (!allowedRoots.has(top)) continue
      if (!folderSet.has(folderPath)) folderSet.set(folderPath, 0)
    }

    for (const folder of uploadFolders) {
      const folderPath = sanitizeFolderPath(folder.path || folder.name)
      const parts = folderPath.split("/").filter(Boolean)
      const leaf = parts[parts.length - 1] || ""
      if (parts.length < 2 || !categoryRootSet.has(parts[0] || "") || validProductFolderSet.has(folderPath)) continue
      if (!looksLikeSkuFolderName(leaf)) continue
      if ((folderSet.get(folderPath) || 0) > 0) continue

      const absolutePath = path.join(uploadRoot, folderPath)
      const entries = await readdir(absolutePath).catch(() => null)
      if (!entries || entries.length > 0) continue
      await rmdir(absolutePath).catch(() => undefined)
      folderSet.delete(folderPath)
    }

    const folders = Array.from(folderSet.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({
      folders,
      assets: uniqueAssets.sort((a, b) => b.createdAt - a.createdAt || a.name.localeCompare(b.name)),
      categoryFolders: categoryFoldersWithCounts,
      productFolders,
    })
  } catch (error) {
    logger.error("Error fetching media", { error: error instanceof Error ? error.message : String(error) }, "admin-media-api")
    return NextResponse.json({ error: "Failed to fetch media" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = createFolderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const slug = sanitizeFolderPath(parsed.data.name)
    const parentFolder = sanitizeFolderPath(parsed.data.parentFolder || "")
    if (!slug) {
      return NextResponse.json({ error: "Invalid folder name" }, { status: 400 })
    }
    if (parentFolder) {
      const parentTop = topFolderName(parentFolder)
      const allowedRoots = await getAllowedFolderRoots()
      if (!allowedRoots.has(parentTop)) {
        return NextResponse.json({ error: "Folder must be under allowed main folders" }, { status: 400 })
      }
    }

    const uploadRoot = path.join(process.cwd(), "public", "uploads")
    await mkdir(uploadRoot, { recursive: true })
    const relativeFolder = parentFolder ? `${parentFolder}/${slug}` : slug
    const folderPath = path.join(uploadRoot, relativeFolder)
    await mkdir(folderPath, { recursive: true })

    return NextResponse.json({ success: true, folder: relativeFolder }, { status: 201 })
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "EEXIST") {
      return NextResponse.json({ error: "Folder already exists" }, { status: 409 })
    }
    logger.error("Error creating media folder", { error: error instanceof Error ? error.message : String(error) }, "admin-media-api")
    return NextResponse.json({ error: "Failed to create folder" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = moveAssetSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const siblings = await getSiblingUploadAssets(parsed.data.url)
    if (siblings.length === 0) {
      return NextResponse.json({ error: "Only uploaded files can be moved" }, { status: 400 })
    }

    const targetFolder = sanitizeFolderPath(parsed.data.targetFolder)
    if (!targetFolder) {
      return NextResponse.json({ error: "Invalid target folder" }, { status: 400 })
    }
    const targetTop = topFolderName(targetFolder)
    const allowedRoots = await getAllowedFolderRoots()
    if (!allowedRoots.has(targetTop)) {
      return NextResponse.json({ error: "Target folder must be under allowed main folders" }, { status: 400 })
    }

    const targetDir = path.join(process.cwd(), "public", "uploads", targetFolder)
    await mkdir(targetDir, { recursive: true })
    const sourceFolder = extractFolderFromUrl(parsed.data.url)
    if (sourceFolder === targetFolder) {
      return NextResponse.json({ error: "File is already in the selected folder" }, { status: 400 })
    }

    for (const sibling of siblings) {
      const targetPath = path.join(targetDir, sibling.fileName)
      const exists = await stat(targetPath).then(() => true).catch(() => false)
      if (exists) {
        return NextResponse.json({ error: `A file named ${sibling.fileName} already exists in the target folder` }, { status: 409 })
      }
    }

    const storage = getStorageProvider()
    await ensureMediaRegistryTable()
    let nextPrimaryUrl = ""
    for (const sibling of siblings) {
      const targetPath = path.join(targetDir, sibling.fileName)
      await rename(sibling.absolutePath, targetPath)
      const nextUrl = storage.getPublicUrl(`${targetFolder}/${sibling.fileName}`)
      await replaceUrlReferences(sibling.url, nextUrl)
      await prisma.$executeRaw`
        UPDATE "MediaAsset"
        SET "image_url" = ${nextUrl}, "object_key" = ${`${targetFolder}/${sibling.fileName}`}
        WHERE "image_url" = ${sibling.url}
      `
      if (sibling.fileName.endsWith("-master.webp") || !nextPrimaryUrl) {
        nextPrimaryUrl = nextUrl
      }
    }
    await pruneEmptyUploadFolders(sourceFolder)

    return NextResponse.json({
      success: true,
      url: nextPrimaryUrl,
    })
  } catch (error) {
    logger.error("Error moving media asset", { error: error instanceof Error ? error.message : String(error) }, "admin-media-api")
    return NextResponse.json({ error: "Failed to move file" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = deleteAssetSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const relatedUrls = await getSiblingUploadUrls(parsed.data.url)
    const productsUsingAsset = await prisma.product.findMany({
      select: { id: true, title: true, images: true },
    }).then((products) =>
      products.filter((product) => {
        const imageUrls = parseProductImages(product.images)
        return relatedUrls.some((url) => imageUrls.includes(url))
      })
    )
    if (productsUsingAsset.length > 0) {
      return NextResponse.json(
        {
          error: "This image is used by one or more products and cannot be deleted.",
          productIds: productsUsingAsset.map((product) => product.id),
          productTitles: productsUsingAsset.map((product) => product.title),
        },
        { status: 409 }
      )
    }

    await ensureMediaRegistryTable()
    for (const url of relatedUrls) {
      await replaceUrlReferences(url, null)
      const info = resolveUploadInfo(url)
      if (info) {
        await unlink(info.absolutePath).catch((err: NodeJS.ErrnoException) => {
          if (err.code !== "ENOENT") throw err
        })
      }
    }
    for (const url of relatedUrls) {
      await prisma.$executeRaw`DELETE FROM "MediaAsset" WHERE "image_url" = ${url}`
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error("Error deleting media asset", { error: error instanceof Error ? error.message : String(error) }, "admin-media-api")
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 })
  }
}
