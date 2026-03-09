import { NextRequest, NextResponse } from "next/server"
import { mkdir, readdir, stat, unlink, rename } from "fs/promises"
import path from "path"
import { z } from "zod"
import { prisma } from "@/lib/db"
import {
  sanitizeFolderPath,
  ensureCategoryMediaFolders,
  ensureManagedMediaFolders,
  cleanupLegacyMediaFolders,
  getManagedMediaRoots,
} from "@/lib/media-folders"
import { logger } from "@/lib/logger"
import { getStorageProvider } from "@/lib/storage/provider"
import { parseProductImages } from "@/lib/product-images"

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

function fileNameFromUrl(url: string): string {
  try {
    const clean = url.split("?")[0]
    return clean.split("/").filter(Boolean).pop() || "file"
  } catch {
    return "file"
  }
}

function toLogicalUploadRelativePath(relativePath: string) {
  const clean = sanitizeFolderPath(relativePath)
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
  if (!relative || relative.includes("..")) return null

  const absolutePath = path.join(process.cwd(), "public", "uploads", relative)
  const fileName = path.basename(relative)
  if (!fileName) return null

  return { absolutePath, fileName }
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
  const assets: MediaAsset[] = []

  for (const entry of entries) {
    const childRelative = relative ? `${relative}/${entry.name}` : entry.name
    const fullPath = path.join(rootDir, childRelative)

    if (entry.isDirectory()) {
      assets.push(...await listUploadFiles(rootDir, childRelative))
      continue
    }

    const fileStats = await stat(fullPath).catch(() => null)
    if (!fileStats || !fileStats.isFile()) continue

    const logicalRelative = toLogicalUploadRelativePath(childRelative)
    const folder = logicalRelative.includes("/") ? logicalRelative.split("/").slice(0, -1).join("/") : "root"
    assets.push({
      id: `upload:${childRelative}`,
      url: storage.getPublicUrl(childRelative),
      name: entry.name,
      folder,
      source: "UPLOAD",
      usedIn: "Uploaded media",
      createdAt: fileStats.mtimeMs,
      sizeBytes: fileStats.size,
    })
  }

  return assets
}

export async function GET() {
  try {
    const uploadRoot = path.join(process.cwd(), "public", "uploads")
    await ensureManagedMediaFolders()
    await cleanupLegacyMediaFolders()
    await ensureCategoryMediaFolders()
    const allowedRoots = await getAllowedFolderRoots()

    const [productsResult, categoriesResult, pagesResult, profilesResult, foldersResult, uploadsResult] = await Promise.allSettled([
      prisma.product.findMany({
        select: {
          id: true,
          title: true,
          images: true,
          categories: { select: { id: true, slug: true, parentId: true } },
        },
      }),
      prisma.category.findMany({ select: { id: true, title: true, slug: true, parentId: true, image: true } }),
      prisma.page.findMany({ select: { id: true, title: true, slug: true, featuredImage: true, content: true } }),
      prisma.customerProfile.findMany({ select: { id: true, firstName: true, lastName: true, displayName: true, avatarUrl: true } }),
      listUploadFolders(uploadRoot),
      listUploadFiles(uploadRoot),
    ])

    const products = productsResult.status === "fulfilled" ? productsResult.value : []
    const categories = categoriesResult.status === "fulfilled" ? categoriesResult.value : []
    const pages = pagesResult.status === "fulfilled" ? pagesResult.value : []
    const profiles = profilesResult.status === "fulfilled" ? profilesResult.value : []
    const uploadFolders = foldersResult.status === "fulfilled" ? foldersResult.value : []
    const uploadedFiles = uploadsResult.status === "fulfilled" ? uploadsResult.value : []
    const uploadLookup = buildUploadLookup(uploadedFiles)
    const categoryPathMap = buildCategoryPathMap(
      categories.map((category) => ({ id: category.id, slug: category.slug, parentId: category.parentId }))
    )

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

    const folders = Array.from(folderSet.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({
      folders,
      assets: uniqueAssets.sort((a, b) => b.createdAt - a.createdAt || a.name.localeCompare(b.name)),
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

    const info = resolveUploadInfo(parsed.data.url)
    if (!info) {
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

    const targetPath = path.join(targetDir, info.fileName)
    await rename(info.absolutePath, targetPath)
    const nextUrl = getStorageProvider().getPublicUrl(`${targetFolder}/${info.fileName}`)
    await replaceUrlReferences(parsed.data.url, nextUrl)

    return NextResponse.json({
      success: true,
      url: nextUrl,
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

    const info = resolveUploadInfo(parsed.data.url)
    await replaceUrlReferences(parsed.data.url, null)
    if (info) {
      await unlink(info.absolutePath).catch((err: NodeJS.ErrnoException) => {
        if (err.code !== "ENOENT") throw err
      })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error("Error deleting media asset", { error: error instanceof Error ? error.message : String(error) }, "admin-media-api")
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 })
  }
}
