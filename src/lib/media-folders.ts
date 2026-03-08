import { mkdir, rm } from "fs/promises"
import path from "path"
import { prisma } from "@/lib/db"

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
