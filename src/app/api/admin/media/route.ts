import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { mkdir, readdir, rmdir, stat, unlink, rename } from "fs/promises"
import path from "path"
import { z } from "zod"
import { prisma } from "@/lib/db"
import {
  sanitizeFolderPath,
  getManagedMediaRoots,
} from "@/lib/media-folders"
import { logger } from "@/lib/logger"
import { getStorageProvider } from "@/lib/storage/provider"
import { getProductImageUrl, parseProductImageRecords } from "@/lib/product-images"
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

type MediaPagination = {
  page: number
  limit: number
  totalItems: number
  totalPages: number
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

type FolderMatchMode = "exact" | "prefix"

const createFolderSchema = z.object({
  name: z.string().min(1, "Folder name is required"),
  parentFolder: z.string().min(1, "Parent folder is required"),
})
const deleteAssetSchema = z.object({
  url: z.string().min(1),
})
const moveAssetSchema = z.object({
  url: z.string().min(1),
  targetFolder: z.string().min(1),
})

const OPTIMIZED_ROOT = "_optimized"

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

function normalizeAssetUrl(
  rawUrl: string,
  fallbackFolder?: string,
  uploadLookup?: Map<string, UploadCandidate[]>
) {
  const storage = getStorageProvider()
  const value = (rawUrl || "").trim()
  if (!value) return ""

  const relativeFromStorage = storage.toRelativePath(value)
  if (relativeFromStorage) {
    const fileName = path.basename(relativeFromStorage)
    const candidates = uploadLookup?.get(fileName.toLowerCase()) || []
    if (candidates.length > 0 && fallbackFolder) {
      const folder = sanitizeFolderPath(fallbackFolder)
      if (folder) {
        const exact = candidates.find((item) => item.folder === folder)
        if (exact) return exact.url
        const nested = candidates.find((item) => item.folder.startsWith(`${folder}/`))
        if (nested) return nested.url
      }
    }
    return storage.getPublicUrl(relativeFromStorage)
  }

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

function resolveCanonicalAssetIdentity(
  rawUrl: string,
  folder: string,
  uploadLookup?: Map<string, UploadCandidate[]>
) {
  const normalizedUrl = normalizeAssetUrl(rawUrl, folder, uploadLookup)
  const storage = getStorageProvider()
  const relative = storage.toRelativePath(normalizedUrl)

  if (!relative) {
    return {
      dedupKey: `${normalizedUrl}@@${sanitizeFolderPath(folder)}`,
      canonicalUrl: normalizedUrl,
      canonicalName: fileNameFromUrl(normalizedUrl),
      canonicalFolder: sanitizeFolderPath(folder) || folder,
    }
  }

  const group = extractVariantGroup(relative)
  return {
    dedupKey: `${group.folder}@@${group.baseKey}`,
    canonicalUrl: storage.getPublicUrl(group.masterRelative),
    canonicalName: path.basename(group.masterRelative),
    canonicalFolder: group.folder,
  }
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
  return new Set([...managed, ...categoryRoots])
}

async function replaceUrlReferences(oldUrl: string, nextUrl: string | null) {
  const [products, categories, pages, profiles] = await Promise.all([
    prisma.product.findMany({ select: { id: true, images: true } }),
    prisma.category.findMany({ select: { id: true, image: true } }),
    prisma.page.findMany({ select: { id: true, featuredImage: true, content: true } }),
    prisma.customerProfile.findMany({ select: { id: true, avatarUrl: true } }),
  ])

  for (const product of products) {
    const images = parseProductImageRecords(product.images)
    let changed = false
    const updated = images
      .map((image) => {
        const nextImage = {
          ...image,
          variants: image.variants ? { ...image.variants } : undefined,
        }

        if (nextImage.image_url === oldUrl) {
          nextImage.image_url = nextUrl || ""
          changed = true
        }
        if (nextImage.variants?.thumb === oldUrl) {
          nextImage.variants.thumb = nextUrl ? getProductImageUrl(nextUrl, "thumb") || nextUrl : ""
          changed = true
        }
        if (nextImage.variants?.large === oldUrl) {
          nextImage.variants.large = nextUrl ? getProductImageUrl(nextUrl, "large") || nextUrl : ""
          changed = true
        }
        if (nextImage.variants?.master === oldUrl) {
          nextImage.variants.master = nextUrl ? getProductImageUrl(nextUrl, "master") || nextUrl : ""
          changed = true
        }

        return nextImage
      })
      .filter((image) => image.image_url)

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

function folderMatchesContext(assetFolder: string, targetFolder: string, mode: FolderMatchMode) {
  if (!targetFolder) return true
  if (mode === "prefix") return assetFolder === targetFolder || assetFolder.startsWith(`${targetFolder}/`)
  return assetFolder === targetFolder
}

async function listUploadFilesInFolder(rootDir: string, relative = "", recursive = false): Promise<MediaAsset[]> {
  const storage = getStorageProvider()
  const current = path.join(rootDir, relative)
  const entries = await readdir(current, { withFileTypes: true }).catch(() => [])
  const groups = new Map<string, UploadVariantGroup>()

  for (const entry of entries) {
    const childRelative = relative ? `${relative}/${entry.name}` : entry.name
    const fullPath = path.join(rootDir, childRelative)

    if (entry.isDirectory()) {
      if (!recursive) continue
      const nestedAssets = await listUploadFilesInFolder(rootDir, childRelative, true)
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

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const pageInput = Number(searchParams.get("page") || "1")
    const limitInput = Number(searchParams.get("limit") || "30")
    const page = Number.isFinite(pageInput) && pageInput > 0 ? Math.floor(pageInput) : 1
    const limit = Number.isFinite(limitInput) && limitInput > 0 ? Math.min(100, Math.floor(limitInput)) : 30
    const search = (searchParams.get("search") || "").trim().toLowerCase()
    const folder = sanitizeFolderPath(searchParams.get("folder") || "")
    const folderMode: FolderMatchMode = searchParams.get("folderMode") === "prefix" ? "prefix" : "exact"

    const uploadRoot = path.join(process.cwd(), "public", "uploads")
    const allowedRoots = await getAllowedFolderRoots()
    const scopedFolderTop = topFolderName(folder)
    const hasScopedFolder = Boolean(folder)
    const folderAllowed = !hasScopedFolder || allowedRoots.has(scopedFolderTop)

    if (!folderAllowed) {
      return NextResponse.json({
        assets: [],
        pagination: {
          page: 1,
          limit,
          totalItems: 0,
          totalPages: 1,
        },
      })
    }

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

    const uploadedFiles = hasScopedFolder
      ? await listUploadFilesInFolder(uploadRoot, folder, folderMode === "prefix")
      : []
    const uploadLookup = buildUploadLookup(uploadedFiles)

    const assets: MediaAsset[] = [...uploadedFiles]

    for (const product of products) {
      const imageRecords = parseProductImageRecords(product.images)
      if (imageRecords.length === 0) continue
      const normalizedSku = sanitizeFolderPath(product.sku || "")
      const productCategoryFolders = product.categories
        .map((category) => categoryPathMap.get(category.id) || "")
        .filter(Boolean)
      const productSkuFolders = normalizedSku
        ? productCategoryFolders.map((folder) => `${folder}/${normalizedSku}`)
        : []
      const defaultProductFolder =
        productSkuFolders[0] ||
        productCategoryFolders[0] ||
        (normalizedSku ? `categories/uncategorized/${normalizedSku}` : "categories/uncategorized")
      for (const imageRecord of imageRecords) {
        const imageUrl = getProductImageUrl(imageRecord, "master") || imageRecord.image_url
        const uploadFolder = extractFolderFromUrl(imageUrl)
        const isUpload = Boolean(getStorageProvider().toRelativePath(imageUrl))
        const uploadFolderTop = topFolderName(uploadFolder)
        const canUseUploadFolder = isUpload && uploadFolder !== "root" && allowedRoots.has(uploadFolderTop)
        const folderCandidates = productSkuFolders.length > 0
          ? productSkuFolders
          : canUseUploadFolder
              ? [uploadFolder]
              : productCategoryFolders.length > 0
                ? productCategoryFolders
                : [defaultProductFolder]

        for (const folder of folderCandidates) {
          const normalizedImage = normalizeAssetUrl(imageUrl, folder, uploadLookup)
          assets.push({
            id: `product:${product.id}:${folder}:${normalizedImage}`,
            url: normalizedImage,
            name: fileNameFromUrl(normalizedImage),
            folder,
            source: "PRODUCT",
            usedIn: `Product image: ${product.title}`,
            createdAt: 0,
          })
        }
      }
    }

    for (const category of categories) {
      if (!category.image) continue
      const categoryFolder = categoryPathMap.get(category.id) || "categories"
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
      if (hasScopedFolder && !folderMatchesContext(asset.folder, folder, folderMode)) continue
      const canonical = resolveCanonicalAssetIdentity(asset.url, asset.folder, uploadLookup)
      const dedupKey = canonical.dedupKey
      const existing = dedup.get(dedupKey)
      if (!existing) {
        dedup.set(dedupKey, {
          id: asset.id,
          url: canonical.canonicalUrl,
          name: canonical.canonicalName,
          folder: canonical.canonicalFolder,
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

    const sortedAssets = uniqueAssets
      .sort((a, b) => b.createdAt - a.createdAt || a.name.localeCompare(b.name))
      .filter((asset) => {
        if (folder) {
          const inFolder = folderMode === "prefix"
            ? asset.folder === folder || asset.folder.startsWith(`${folder}/`)
            : asset.folder === folder
          if (!inFolder) return false
        }

        if (!search) return true

        const haystack = [asset.name, asset.folder, asset.usedIn, asset.source]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
        return haystack.includes(search)
      })

    const totalItems = sortedAssets.length
    const totalPages = Math.max(1, Math.ceil(totalItems / limit))
    const safePage = Math.min(page, totalPages)
    const start = (safePage - 1) * limit
    const pagination: MediaPagination = {
      page: safePage,
      limit,
      totalItems,
      totalPages,
    }

    return NextResponse.json({
      assets: sortedAssets.slice(start, start + limit),
      pagination,
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
    const parentFolder = sanitizeFolderPath(parsed.data.parentFolder)
    if (!slug) {
      return NextResponse.json({ error: "Invalid folder name" }, { status: 400 })
    }
    if (!parentFolder) {
      return NextResponse.json({ error: "Parent folder is required" }, { status: 400 })
    }
    const parentTop = topFolderName(parentFolder)
    const allowedRoots = await getAllowedFolderRoots()
    if (!allowedRoots.has(parentTop)) {
      return NextResponse.json({ error: "Folder must be under allowed main folders" }, { status: 400 })
    }

    const uploadRoot = path.join(process.cwd(), "public", "uploads")
    await mkdir(uploadRoot, { recursive: true })
    const folderPath = path.join(uploadRoot, parentFolder, slug)
    await mkdir(folderPath, { recursive: true })

    return NextResponse.json({ success: true, folder: `${parentFolder}/${slug}` }, { status: 201 })
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
      await prisma.$executeRaw`UPDATE "MediaAsset" SET "image_url" = ${nextUrl}, "object_key" = ${`${targetFolder}/${sibling.fileName}`} WHERE "image_url" = ${sibling.url}`
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
    await prisma.$executeRaw`DELETE FROM "MediaAsset" WHERE "image_url" IN (${Prisma.join(relatedUrls)})`
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error("Error deleting media asset", { error: error instanceof Error ? error.message : String(error) }, "admin-media-api")
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 })
  }
}
