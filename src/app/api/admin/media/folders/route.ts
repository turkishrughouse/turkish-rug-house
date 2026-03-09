import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { mkdir, readdir, rm, rename, stat } from "fs/promises"
import path from "path"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { sanitizeFolderPath, getManagedMediaRoots } from "@/lib/media-folders"
import { ensureMediaRegistryTable } from "@/lib/media-registry"
import { parseProductImages } from "@/lib/product-images"
import { getStorageProvider } from "@/lib/storage/provider"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const deleteFolderSchema = z.object({
  folder: z.string().min(1, "Folder is required"),
})

const renameFolderSchema = z.object({
  folder: z.string().min(1, "Folder is required"),
  newName: z.string().min(1, "New name is required").optional(),
  targetParent: z.string().min(1, "Target parent is required").optional(),
})

const cloneFolderSchema = z.object({
  action: z.literal("clone"),
  folder: z.string().min(1, "Folder is required"),
})

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

async function replaceFolderUrlReferences(oldFolder: string, nextFolder: string) {
  const storage = getStorageProvider()
  const oldPrefix = storage.getPublicUrl(`${oldFolder}/`)
  const nextPrefix = storage.getPublicUrl(`${nextFolder}/`)

  const [products, categories, pages, profiles] = await Promise.all([
    prisma.product.findMany({ select: { id: true, images: true } }),
    prisma.category.findMany({ select: { id: true, image: true } }),
    prisma.page.findMany({ select: { id: true, featuredImage: true, content: true } }),
    prisma.customerProfile.findMany({ select: { id: true, avatarUrl: true } }),
  ])

  for (const product of products) {
    const images = parseProductImages(product.images)

    const updated = images.map((url) => (url.startsWith(oldPrefix) ? `${nextPrefix}${url.slice(oldPrefix.length)}` : url))
    if (JSON.stringify(updated) !== JSON.stringify(images)) {
      await prisma.product.update({
        where: { id: product.id },
        data: { images: JSON.stringify(updated) },
      })
    }
  }

  for (const category of categories) {
    if (!category.image || !category.image.startsWith(oldPrefix)) continue
    await prisma.category.update({
      where: { id: category.id },
      data: { image: `${nextPrefix}${category.image.slice(oldPrefix.length)}` },
    })
  }

  const escapedPrefix = escapeRegExp(oldPrefix)
  const contentRegex = new RegExp(escapedPrefix, "g")
  for (const page of pages) {
    const featuredChanged = Boolean(page.featuredImage?.startsWith(oldPrefix))
    const hadInContent = Boolean(page.content?.includes(oldPrefix))
    if (!featuredChanged && !hadInContent) continue
    await prisma.page.update({
      where: { id: page.id },
      data: {
        featuredImage: featuredChanged ? `${nextPrefix}${(page.featuredImage || "").slice(oldPrefix.length)}` : undefined,
        content: hadInContent ? (page.content || "").replace(contentRegex, nextPrefix) : undefined,
      },
    })
  }

  for (const profile of profiles) {
    if (!profile.avatarUrl || !profile.avatarUrl.startsWith(oldPrefix)) continue
    await prisma.customerProfile.update({
      where: { id: profile.id },
      data: { avatarUrl: `${nextPrefix}${profile.avatarUrl.slice(oldPrefix.length)}` },
    })
  }

  await ensureMediaRegistryTable()
  await prisma.$executeRawUnsafe(
    `
      UPDATE "MediaAsset"
      SET "image_url" = REPLACE("image_url", ?, ?),
          "object_key" = REPLACE("object_key", ?, ?)
      WHERE "image_url" LIKE ? OR "object_key" LIKE ?
    `,
    oldPrefix,
    nextPrefix,
    `${oldFolder}/`,
    `${nextFolder}/`,
    `${oldPrefix}%`,
    `${oldFolder}/%`
  )
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = deleteFolderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const safeFolder = sanitizeFolderPath(parsed.data.folder)
    if (!safeFolder) {
      return NextResponse.json({ error: "Invalid folder path" }, { status: 400 })
    }
    const topCategories = await prisma.category.findMany({
      where: { parentId: null },
      select: { slug: true },
    })
    const protectedRoots = new Set([
      ...getManagedMediaRoots().map((item) => sanitizeFolderPath(item)).filter(Boolean),
      ...topCategories.map((item) => sanitizeFolderPath(item.slug)).filter(Boolean),
    ])
    if (protectedRoots.has(safeFolder)) {
      return NextResponse.json({ error: "Main folders cannot be deleted" }, { status: 400 })
    }

    const uploadRoot = path.join(process.cwd(), "public", "uploads")
    const folderPath = path.join(uploadRoot, safeFolder)
    if (!folderPath.startsWith(uploadRoot)) {
      return NextResponse.json({ error: "Invalid folder path" }, { status: 400 })
    }

    await rm(folderPath, { recursive: true, force: true })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/admin/media/folders error:", error)
    return NextResponse.json({ error: "Failed to delete folder" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = renameFolderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const safeFolder = sanitizeFolderPath(parsed.data.folder)
    if (!safeFolder) {
      return NextResponse.json({ error: "Invalid folder name" }, { status: 400 })
    }

    const segments = safeFolder.split("/")
    if (segments.length === 0) {
      return NextResponse.json({ error: "Invalid folder path" }, { status: 400 })
    }
    const currentLeaf = segments[segments.length - 1] || ""
    const parent = segments.slice(0, -1).join("/")
    const hasTargetParent = Object.prototype.hasOwnProperty.call(parsed.data, "targetParent")
    const targetParent = hasTargetParent ? sanitizeFolderPath(parsed.data.targetParent || "") : ""
    const newLeaf = parsed.data.newName ? sanitizeFolderPath(parsed.data.newName).split("/")[0] || "" : currentLeaf
    if (!newLeaf) {
      return NextResponse.json({ error: "Invalid folder name" }, { status: 400 })
    }

    const nextParent = targetParent || parent
    const nextFolder = nextParent ? `${nextParent}/${newLeaf}` : newLeaf

    const topCategories = await prisma.category.findMany({
      where: { parentId: null },
      select: { slug: true },
    })
    const protectedRoots = new Set([
      ...getManagedMediaRoots().map((item) => sanitizeFolderPath(item)).filter(Boolean),
      ...topCategories.map((item) => sanitizeFolderPath(item.slug)).filter(Boolean),
    ])
    if (protectedRoots.has(safeFolder) || protectedRoots.has(nextFolder)) {
      return NextResponse.json({ error: "Main folders cannot be renamed" }, { status: 400 })
    }
    if (hasTargetParent) {
      const topTarget = (targetParent || newLeaf).split("/")[0] || ""
      if (!protectedRoots.has(topTarget)) {
        return NextResponse.json({ error: "Target parent is invalid" }, { status: 400 })
      }
      if (targetParent === safeFolder || (targetParent && targetParent.startsWith(`${safeFolder}/`))) {
        return NextResponse.json({ error: "Folder cannot be moved into itself" }, { status: 400 })
      }
    }

    const uploadRoot = path.join(process.cwd(), "public", "uploads")
    const fromPath = path.join(uploadRoot, safeFolder)
    const toPath = path.join(uploadRoot, nextFolder)
    if (!fromPath.startsWith(uploadRoot) || !toPath.startsWith(uploadRoot)) {
      return NextResponse.json({ error: "Invalid folder path" }, { status: 400 })
    }
    if (safeFolder === nextFolder) {
      return NextResponse.json({ success: true, folder: nextFolder })
    }
    const targetExists = await stat(toPath).then(() => true).catch(() => false)
    if (targetExists) {
      return NextResponse.json({ error: "A folder with the same name already exists in the target location" }, { status: 409 })
    }

    await rename(fromPath, toPath)
    await replaceFolderUrlReferences(safeFolder, nextFolder)
    revalidatePath("/dashboard/media")
    revalidatePath("/dashboard/products")
    revalidatePath("/dashboard/pages")
    return NextResponse.json({ success: true, folder: nextFolder })
  } catch (error) {
    console.error("PATCH /api/admin/media/folders error:", error)
    return NextResponse.json({ error: "Failed to rename folder" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = cloneFolderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const sourceFolder = sanitizeFolderPath(parsed.data.folder)
    if (!sourceFolder) {
      return NextResponse.json({ error: "Invalid folder name" }, { status: 400 })
    }
    const parts = sourceFolder.split("/").filter(Boolean)
    const sourceLeaf = parts[parts.length - 1] || ""
    const parentPath = parts.slice(0, -1).join("/")
    const match = sourceLeaf.match(/^(.*?)(\d+)$/)
    if (!match) {
      return NextResponse.json({ error: "Folder name must end with a number for clone" }, { status: 400 })
    }
    const [, prefix, digits] = match

    const topCategories = await prisma.category.findMany({
      where: { parentId: null },
      select: { slug: true },
    })
    const protectedRoots = new Set([
      ...getManagedMediaRoots().map((item) => sanitizeFolderPath(item)).filter(Boolean),
      ...topCategories.map((item) => sanitizeFolderPath(item.slug)).filter(Boolean),
    ])
    const topSource = sourceFolder.split("/")[0] || ""
    if (!protectedRoots.has(topSource)) {
      return NextResponse.json({ error: "Folder is outside allowed roots" }, { status: 400 })
    }

    const uploadRoot = path.join(process.cwd(), "public", "uploads")
    const parentAbs = path.join(uploadRoot, parentPath)
    const sourceAbs = path.join(uploadRoot, sourceFolder)
    if (!sourceAbs.startsWith(uploadRoot) || !parentAbs.startsWith(uploadRoot)) {
      return NextResponse.json({ error: "Invalid folder path" }, { status: 400 })
    }

    const siblings = await readdir(parentAbs, { withFileTypes: true }).catch(() => [])
    let maxNumber = Number.parseInt(digits, 10)
    for (const entry of siblings) {
      if (!entry.isDirectory()) continue
      const siblingMatch = entry.name.match(/^(.*?)(\d+)$/)
      if (!siblingMatch) continue
      if (siblingMatch[1] !== prefix) continue
      const siblingNumber = Number.parseInt(siblingMatch[2], 10)
      if (siblingNumber > maxNumber) maxNumber = siblingNumber
    }

    const nextLeaf = `${prefix}${String(maxNumber + 1).padStart(digits.length, "0")}`
    const targetFolder = parentPath ? `${parentPath}/${nextLeaf}` : nextLeaf
    const targetAbs = path.join(uploadRoot, targetFolder)
    if (!targetAbs.startsWith(uploadRoot)) {
      return NextResponse.json({ error: "Invalid target folder path" }, { status: 400 })
    }

    await readdir(sourceAbs)
    await mkdir(targetAbs, { recursive: false })
    revalidatePath("/dashboard/media")
    revalidatePath("/dashboard/products")
    return NextResponse.json({ success: true, folder: targetFolder })
  } catch (error) {
    console.error("POST /api/admin/media/folders error:", error)
    return NextResponse.json({ error: "Failed to clone folder" }, { status: 500 })
  }
}
