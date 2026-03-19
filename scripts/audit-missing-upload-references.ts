import { PrismaClient } from "@prisma/client"
import { promises as fs } from "fs"
import path from "path"

type MissingRef = {
  table: string
  id: string
  slug?: string | null
  field: string
  missingPath: string
}

const PUBLIC_ROOT = path.join(process.cwd(), "public")
const UPLOADS_ROOT = path.join(PUBLIC_ROOT, "uploads")
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})

function toPublicUploadPath(ref: string) {
  const normalized = ref.trim()
  const marker = normalized.includes("/uploads/") ? "/uploads/" : normalized.includes("uploads/") ? "uploads/" : null
  if (!marker) return null
  const idx = normalized.indexOf(marker)
  if (idx < 0) return null
  const uploadsPath = normalized.slice(idx).replace(/^uploads\//, "/uploads/")
  return path.join(PUBLIC_ROOT, uploadsPath.replace(/^\//, ""))
}

function extractUploadRefs(value: string) {
  const matches = value.match(/\/?uploads\/[^\s"'`)\]]+/g)
  if (!matches) return []
  return Array.from(new Set(matches.map((m) => (m.startsWith("/") ? m : `/${m}`))))
}

async function listExistingUploads() {
  const existing = new Set<string>()

  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const ent of entries) {
      const full = path.join(dir, ent.name)
      if (ent.isDirectory()) {
        await walk(full)
        continue
      }
      if (!ent.isFile()) continue
      const rel = path.relative(PUBLIC_ROOT, full).split(path.sep).join("/")
      existing.add(`/${rel}`)
    }
  }

  await walk(UPLOADS_ROOT).catch(() => null)
  return existing
}

async function checkRefs(table: string, id: string, field: string, refs: string[], existingUploads: Set<string>) {
  const missing: MissingRef[] = []
  for (const ref of refs) {
    if (!ref.startsWith("/uploads/")) continue
    if (!existingUploads.has(ref)) {
      missing.push({ table, id, field, missingPath: ref })
    }
  }
  return missing
}

async function main() {
  const shouldFixSiteSettings = process.argv.includes("--fix-site-settings")
  const existingUploads = await listExistingUploads()
  const missing: MissingRef[] = []

  const products = await prisma.product.findMany({
    select: { id: true, slug: true, images: true, description: true },
  })
  for (const p of products) {
    const refs: string[] = []
    try {
      const arr = JSON.parse(p.images || "[]")
      if (Array.isArray(arr)) refs.push(...arr.filter((v): v is string => typeof v === "string"))
    } catch {
      // ignore malformed JSON
    }
    if (typeof p.description === "string") refs.push(...extractUploadRefs(p.description))
    const found = await checkRefs("Product", p.id, "images/description", refs, existingUploads)
    for (const item of found) missing.push({ ...item, slug: p.slug })
  }

  const pages = await prisma.page.findMany({
    select: { id: true, slug: true, featuredImage: true, content: true },
  })
  for (const pageRow of pages) {
    const refs: string[] = []
    if (typeof pageRow.featuredImage === "string") refs.push(pageRow.featuredImage)
    if (typeof pageRow.content === "string") refs.push(...extractUploadRefs(pageRow.content))
    const found = await checkRefs("Page", pageRow.id, "featuredImage/content", refs, existingUploads)
    for (const item of found) missing.push({ ...item, slug: pageRow.slug })
  }

  const posts = await prisma.blogPost.findMany({
    select: { id: true, slug: true, featuredImage: true, content: true },
  })
  for (const post of posts) {
    const refs: string[] = []
    if (typeof post.featuredImage === "string") refs.push(post.featuredImage)
    if (typeof post.content === "string") refs.push(...extractUploadRefs(post.content))
    const found = await checkRefs("BlogPost", post.id, "featuredImage/content", refs, existingUploads)
    for (const item of found) missing.push({ ...item, slug: post.slug })
  }

  const categories = await prisma.category.findMany({
    select: { id: true, slug: true, image: true },
  })
  for (const c of categories) {
    const refs: string[] = []
    if (typeof c.image === "string") refs.push(c.image)
    const found = await checkRefs("Category", c.id, "image", refs, existingUploads)
    for (const item of found) missing.push({ ...item, slug: c.slug })
  }

  const reviews = await prisma.productReview.findMany({
    select: { id: true, productId: true, photoUrl: true },
  })
  for (const r of reviews) {
    const refs: string[] = []
    if (typeof r.photoUrl === "string") refs.push(r.photoUrl)
    missing.push(...(await checkRefs("ProductReview", r.id, "photoUrl", refs, existingUploads)))
  }

  const settings = await prisma.designSettings.findMany({ select: { id: true, key: true, config: true } })
  for (const s of settings) {
    if (typeof s.config !== "string") continue
    const refs = extractUploadRefs(s.config)
    missing.push(...(await checkRefs("DesignSettings", s.id, `config (key=${s.key})`, refs, existingUploads)))

    if (shouldFixSiteSettings && s.key === "site_settings") {
      try {
        const parsed = JSON.parse(s.config || "{}") as Record<string, unknown>
        const current = typeof parsed.maintenanceImageUrl === "string" ? parsed.maintenanceImageUrl : null
        if (current === "/uploads/pages/maintenance-default.jpg") {
          parsed.maintenanceImageUrl = "/uploads/pages/maintenance/2002010FUNKILIM85x127-51512x-master.webp"
          await prisma.designSettings.update({ where: { id: s.id }, data: { config: JSON.stringify(parsed) } })
          // re-check after fix
        }
      } catch {
        // ignore invalid JSON
      }
    }
  }

  const uniqueMissing = Array.from(
    new Map(missing.map((m) => [`${m.table}:${m.id}:${m.field}:${m.missingPath}`, m])).values()
  )

  if (uniqueMissing.length === 0) {
    process.stdout.write("OK: no missing /uploads references found in DB records scanned.\n")
    return
  }

  process.stdout.write(`Missing upload references (${uniqueMissing.length}):\n`)
  for (const m of uniqueMissing) {
    const ident = m.slug ? `${m.table} id=${m.id} slug=${m.slug}` : `${m.table} id=${m.id}`
    process.stdout.write(`- ${ident} field=${m.field} -> ${m.missingPath}\n`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null)
  })

