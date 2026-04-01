import { copyFile, mkdir, readdir, rename, rm, rmdir, stat } from "fs/promises"
import path from "path"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { ensureMediaRegistryTable, upsertMediaAsset, type MediaRegistryRow } from "@/lib/media-registry"
import { getProductImageUrl, normalizeProductImageRecords } from "@/lib/product-images"
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
  const targetFolder = await resolveCanonicalProductFolder(categoryIds, sku)
  if (!targetFolder) return

  const uploadRoot = path.join(process.cwd(), "public", "uploads")
  await mkdir(uploadRoot, { recursive: true })
  await ensureCategoryMediaFolders()
  await mkdir(path.join(uploadRoot, targetFolder), { recursive: true })
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

  const resolvePath = (id: string): string => {
    if (cache.has(id)) return cache.get(id) || ""
    const current = byId.get(id)
    if (!current) return ""
    const parentPath = current.parentId ? resolvePath(current.parentId) : ""
    const currentPath = sanitizeFolderPath(parentPath ? `${parentPath}/${current.slug}` : current.slug)
    cache.set(id, currentPath)
    return currentPath
  }

  const folders: string[] = []
  for (const categoryId of categoryIds) {
    const categoryPath = resolvePath(categoryId)
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

function isManagedProductImageUrl(url: string | null | undefined) {
  if (!url) return false
  return Boolean(getStorageProvider().toRelativePath(url))
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

function parseVariantFileName(fileName: string) {
  const match = fileName.match(/^(.*)-(thumb|large|master)(\.[^./]+)$/i)
  if (!match) return null

  return {
    baseName: match[1] || fileName,
    variant: match[2].toLowerCase(),
    extension: match[3] || "",
  }
}

function buildVariantFileName(baseName: string, variant: string, extension: string) {
  return `${baseName}-${variant}${extension}`
}

async function resolveTargetSiblingFileNames(
  siblings: Array<{ fileName: string }>,
  targetDir: string
) {
  const parsed = siblings.map((sibling) => parseVariantFileName(sibling.fileName))
  const parsedBaseName = parsed.find(Boolean)?.baseName || path.parse(siblings[0]?.fileName || "asset").name
  const safeBaseName = sanitizeFolderPath(parsedBaseName).replace(/\//g, "-") || "asset"

  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const candidateBaseName = attempt === 0 ? safeBaseName : `${safeBaseName}-${attempt + 1}`
    const candidateNames = siblings.map((sibling, index) => {
      const current = parsed[index]
      if (!current) return sibling.fileName
      return buildVariantFileName(candidateBaseName, current.variant, current.extension)
    })

    const collisions = await Promise.all(
      candidateNames.map((candidateName) =>
        stat(path.join(targetDir, candidateName)).then(() => true).catch(() => false)
      )
    )

    if (!collisions.some(Boolean)) {
      return candidateNames
    }
  }

  throw new Error("Unable to resolve a unique target filename for product media normalization.")
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

async function replaceMediaUrlReferences(oldUrl: string, nextUrl: string | null) {
  const [products, categories, pages, profiles] = await Promise.all([
    prisma.product.findMany({ select: { id: true, images: true } }),
    prisma.category.findMany({ select: { id: true, image: true } }),
    prisma.page.findMany({ select: { id: true, featuredImage: true, content: true } }),
    prisma.customerProfile.findMany({ select: { id: true, avatarUrl: true } }),
  ])

  for (const product of products) {
    const images = normalizeProductImageRecords(product.images)
    let changed = false
    const nextImages = images.map((image) => {
      const nextImage = {
        ...image,
        variants: image.variants ? { ...image.variants } : undefined,
      }

      if (nextImage.image_url === oldUrl) {
        nextImage.image_url = nextUrl || ""
        changed = true
      }
      if (nextImage.variants?.thumb === oldUrl) {
        nextImage.variants.thumb = nextUrl || ""
        changed = true
      }
      if (nextImage.variants?.large === oldUrl) {
        nextImage.variants.large = nextUrl || ""
        changed = true
      }
      if (nextImage.variants?.master === oldUrl) {
        nextImage.variants.master = nextUrl || ""
        changed = true
      }

      return nextImage
    }).filter((image) => image.image_url)

    if (changed) {
      await prisma.product.update({
        where: { id: product.id },
        data: { images: JSON.stringify(nextImages) },
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

  const escaped = oldUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
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

async function getMediaRegistryRowsByUrls(urls: string[]) {
  if (urls.length === 0) return new Map<string, MediaRegistryRow>()
  await ensureMediaRegistryTable()
  const rows = await prisma.$queryRaw<MediaRegistryRow[]>`
    SELECT *
    FROM "MediaAsset"
    WHERE "image_url" IN (${Prisma.join(urls)})
  `
  return new Map(rows.map((row) => [row.image_url, row]))
}

export async function moveManagedAssetGroupToFolder(url: string, targetFolder: string) {
  const siblings = await getSiblingUploadAssets(url)
  if (siblings.length === 0) return url

  const sourceFolder = extractFolderFromManagedUrl(url)
  const safeTargetFolder = sanitizeFolderPath(targetFolder)
  if (!safeTargetFolder || sourceFolder === safeTargetFolder) return url

  const targetDir = path.join(process.cwd(), "public", "uploads", safeTargetFolder)
  await mkdir(targetDir, { recursive: true })

  const storage = getStorageProvider()
  const masterSibling = siblings.find((sibling) => sibling.fileName.includes("-master.")) || siblings[0]
  const targetFileNames = await resolveTargetSiblingFileNames(siblings, targetDir)

  let nextPrimaryUrl = url
  await ensureMediaRegistryTable()
  for (const [index, sibling] of siblings.entries()) {
    const targetFileName = targetFileNames[index] || sibling.fileName
    const targetPath = path.join(targetDir, targetFileName)
    await rename(sibling.absolutePath, targetPath)
    const nextUrl = storage.getPublicUrl(`${safeTargetFolder}/${targetFileName}`)
    await replaceMediaUrlReferences(sibling.url, nextUrl)
    await prisma.$executeRaw`UPDATE "MediaAsset" SET "image_url" = ${nextUrl}, "object_key" = ${`${safeTargetFolder}/${targetFileName}`} WHERE "image_url" = ${sibling.url}`
    if (sibling === masterSibling || targetFileName.endsWith("-master.webp")) {
      nextPrimaryUrl = nextUrl
    }
  }

  await pruneEmptyUploadFolders(sourceFolder)
  return nextPrimaryUrl
}

async function hasExternalMediaReferences(url: string, currentProductId?: string) {
  const siblings = await getSiblingUploadAssets(url)
  const relevantUrls = new Set([url, ...siblings.map((sibling) => sibling.url)])

  const [products, categories, pages, profiles] = await Promise.all([
    prisma.product.findMany({
      select: {
        id: true,
        images: true,
      },
    }),
    prisma.category.findMany({
      select: {
        image: true,
      },
    }),
    prisma.page.findMany({
      select: {
        featuredImage: true,
        content: true,
      },
    }),
    prisma.customerProfile.findMany({
      select: {
        avatarUrl: true,
      },
    }),
  ])

  for (const product of products) {
    if (currentProductId && product.id === currentProductId) continue
    const images = normalizeProductImageRecords(product.images)
    const isReferenced = images.some((image) =>
      relevantUrls.has(image.image_url) ||
      (image.variants ? Object.values(image.variants).some((variant) => relevantUrls.has(variant || "")) : false)
    )
    if (isReferenced) return true
  }

  if (categories.some((category) => category.image && relevantUrls.has(category.image))) return true
  if (profiles.some((profile) => profile.avatarUrl && relevantUrls.has(profile.avatarUrl))) return true
  if (pages.some((page) =>
    (page.featuredImage && relevantUrls.has(page.featuredImage)) ||
    Array.from(relevantUrls).some((candidate) => page.content?.includes(candidate))
  )) {
    return true
  }

  return false
}

async function copyManagedAssetGroupToFolder(url: string, targetFolder: string) {
  const siblings = await getSiblingUploadAssets(url)
  if (siblings.length === 0) return url

  const sourceFolder = extractFolderFromManagedUrl(url)
  const safeTargetFolder = sanitizeFolderPath(targetFolder)
  if (!safeTargetFolder || sourceFolder === safeTargetFolder) return url

  const targetDir = path.join(process.cwd(), "public", "uploads", safeTargetFolder)
  await mkdir(targetDir, { recursive: true })

  const storage = getStorageProvider()
  const masterSibling = siblings.find((sibling) => sibling.fileName.includes("-master.")) || siblings[0]
  const targetFileNames = await resolveTargetSiblingFileNames(siblings, targetDir)
  const registryRows = await getMediaRegistryRowsByUrls(siblings.map((sibling) => sibling.url))

  const urlMap = new Map<string, string>()
  for (const [index, sibling] of siblings.entries()) {
    const targetFileName = targetFileNames[index] || sibling.fileName
    const targetPath = path.join(targetDir, targetFileName)
    await copyFile(sibling.absolutePath, targetPath)
    urlMap.set(sibling.url, storage.getPublicUrl(`${safeTargetFolder}/${targetFileName}`))
  }

  for (const [index, sibling] of siblings.entries()) {
    const targetFileName = targetFileNames[index] || sibling.fileName
    const nextUrl = urlMap.get(sibling.url) || storage.getPublicUrl(`${safeTargetFolder}/${targetFileName}`)
    const sourceRow = registryRows.get(sibling.url)
    await upsertMediaAsset({
      id: `${safeTargetFolder}/${targetFileName}`,
      image_url: nextUrl,
      width: sourceRow?.width ?? null,
      height: sourceRow?.height ?? null,
      alt: sourceRow?.alt ?? null,
      sort_order: sourceRow?.sort_order ?? 0,
      is_primary: Boolean(sourceRow?.is_primary),
      variant: sourceRow?.variant ?? null,
      master_url: sourceRow?.master_url ? (urlMap.get(sourceRow.master_url) || sourceRow.master_url) : null,
      checksum: sourceRow?.checksum ?? null,
      mime_type: sourceRow?.mime_type ?? null,
      size_bytes: sourceRow?.size_bytes ?? null,
      storage_provider: sourceRow?.storage_provider ?? null,
      object_key: `${safeTargetFolder}/${targetFileName}`,
    })
  }

  return urlMap.get(masterSibling.url) || url
}

export async function relocateProductImagesToSkuFolders(
  imageUrls: string[],
  categoryIds: string[],
  sku: string | null | undefined,
  currentProductId?: string
) {
  const targetFolder = await resolveCanonicalProductFolder(categoryIds, sku, imageUrls)
  if (!targetFolder || imageUrls.length === 0) {
    return imageUrls
  }

  const nextUrls: string[] = []
  for (const url of imageUrls) {
    if (!isManagedProductImageUrl(url)) {
      nextUrls.push(url)
      continue
    }
    const currentFolder = extractFolderFromManagedUrl(url)
    if (currentFolder === targetFolder) {
      nextUrls.push(url)
      continue
    }
    await mkdir(path.join(process.cwd(), "public", "uploads", targetFolder), { recursive: true })
    const isShared = await hasExternalMediaReferences(url, currentProductId)
    const nextUrl = isShared
      ? await copyManagedAssetGroupToFolder(url, targetFolder)
      : await moveManagedAssetGroupToFolder(url, targetFolder)
    nextUrls.push(nextUrl)
  }

  return nextUrls
}

export async function normalizeProductImageRecordsToSkuFolder(
  imagesValue: unknown,
  categoryIds: string[],
  sku: string | null | undefined,
  currentProductId?: string
) {
  const currentImages = normalizeProductImageRecords(imagesValue)
  if (currentImages.length === 0) return currentImages

  const nextUrls = await relocateProductImagesToSkuFolders(
    currentImages.map((image) => image.image_url),
    categoryIds,
    sku,
    currentProductId
  )

  return currentImages.map((image, index) => {
    const nextUrl = nextUrls[index] || image.image_url
    if (nextUrl === image.image_url) return image
    return {
      ...image,
      image_url: nextUrl,
      variants: {
        thumb: getProductImageUrl(nextUrl, "thumb") || image.variants?.thumb || nextUrl,
        large: getProductImageUrl(nextUrl, "large") || image.variants?.large || nextUrl,
        master: getProductImageUrl(nextUrl, "master") || image.variants?.master || nextUrl,
      },
    }
  })
}

export async function migrateAllProductsToCanonicalMediaFolders() {
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

    const nextImages = await normalizeProductImageRecordsToSkuFolder(product.images, categoryIds, sku)
    const didChange = nextImages.some((image, index) => {
      const current = currentImages[index]
      if (!current) return true
      return (
        image.image_url !== current.image_url ||
        image.variants?.thumb !== current.variants?.thumb ||
        image.variants?.large !== current.variants?.large ||
        image.variants?.master !== current.variants?.master
      )
    })
    if (!didChange) continue

    await prisma.product.update({
      where: { id: product.id },
      data: {
        images: JSON.stringify(nextImages),
      },
    })
  }
}
