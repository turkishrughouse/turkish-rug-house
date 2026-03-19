/* eslint-disable no-console */
const fs = require("fs")
const fsp = require("fs/promises")
const path = require("path")
const { execFileSync } = require("child_process")

const ROOT = process.cwd()
const PUBLIC_ROOT = path.join(ROOT, "public")
const UPLOADS_ROOT = path.join(PUBLIC_ROOT, "uploads")

function loadEnvDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const envPath = path.join(ROOT, ".env")
  if (!fs.existsSync(envPath)) return null
  const raw = fs.readFileSync(envPath, "utf8")
  const match = raw.match(/^\s*DATABASE_URL\s*=\s*("?)(.+?)\1\s*$/m)
  return match ? match[2] : null
}

function extractUploadRefsFromText(text) {
  if (!text || typeof text !== "string") return []
  const matches = text.match(/\/?uploads\/[^\s"'`)\]]+/g)
  if (!matches) return []
  const normalized = matches.map((m) => (m.startsWith("/") ? m : `/${m}`))
  return Array.from(new Set(normalized))
}

async function listExistingUploads() {
  const existing = new Set()

  async function walk(dir) {
    const entries = await fsp.readdir(dir, { withFileTypes: true })
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

  if (fs.existsSync(UPLOADS_ROOT)) await walk(UPLOADS_ROOT)
  return existing
}

function psql(databaseUrl, sql) {
  const out = execFileSync("psql", [databaseUrl, "-At", "-F", "\t", "-c", sql], { encoding: "utf8" })
  return out
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split("\t"))
}

function missingForRefs(existingUploads, refs) {
  return refs.filter((ref) => ref.startsWith("/uploads/") && !existingUploads.has(ref))
}

async function main() {
  const databaseUrl = loadEnvDatabaseUrl()
  if (!databaseUrl) {
    console.error("DATABASE_URL not set and .env missing; cannot audit DB records.")
    process.exitCode = 1
    return
  }

  const existingUploads = await listExistingUploads()
  const missing = []

  // Product: images (json stored as text), description
  for (const [id, slug, images, description] of psql(
    databaseUrl,
    `
      SELECT id, slug, images, COALESCE(description, '')
      FROM "Product"
      WHERE images LIKE '%/uploads/%' OR COALESCE(description,'') LIKE '%/uploads/%'
    `
  )) {
    const refs = []
    try {
      const arr = JSON.parse(images || "[]")
      if (Array.isArray(arr)) refs.push(...arr.filter((v) => typeof v === "string"))
    } catch {}
    refs.push(...extractUploadRefsFromText(description))
    for (const mp of missingForRefs(existingUploads, refs)) {
      missing.push({ table: "Product", id, slug, field: "images/description", missingPath: mp })
    }
  }

  // Page
  for (const [id, slug, featuredImage, content] of psql(
    databaseUrl,
    `
      SELECT id, slug, COALESCE("featuredImage", ''), COALESCE(content,'')
      FROM "Page"
      WHERE COALESCE("featuredImage",'') LIKE '%/uploads/%' OR COALESCE(content,'') LIKE '%/uploads/%'
    `
  )) {
    const refs = []
    refs.push(...extractUploadRefsFromText(featuredImage))
    refs.push(...extractUploadRefsFromText(content))
    for (const mp of missingForRefs(existingUploads, refs)) {
      missing.push({ table: "Page", id, slug, field: "featuredImage/content", missingPath: mp })
    }
  }

  // BlogPost
  for (const [id, slug, featuredImage, content] of psql(
    databaseUrl,
    `
      SELECT id, slug, COALESCE("featuredImage", ''), COALESCE(content,'')
      FROM "BlogPost"
      WHERE COALESCE("featuredImage",'') LIKE '%/uploads/%' OR COALESCE(content,'') LIKE '%/uploads/%'
    `
  )) {
    const refs = []
    refs.push(...extractUploadRefsFromText(featuredImage))
    refs.push(...extractUploadRefsFromText(content))
    for (const mp of missingForRefs(existingUploads, refs)) {
      missing.push({ table: "BlogPost", id, slug, field: "featuredImage/content", missingPath: mp })
    }
  }

  // Category
  for (const [id, slug, image] of psql(
    databaseUrl,
    `
      SELECT id, slug, COALESCE(image,'')
      FROM "Category"
      WHERE COALESCE(image,'') LIKE '%/uploads/%'
    `
  )) {
    const refs = extractUploadRefsFromText(image)
    for (const mp of missingForRefs(existingUploads, refs)) {
      missing.push({ table: "Category", id, slug, field: "image", missingPath: mp })
    }
  }

  // ProductReview
  for (const [id, productId, photoUrl] of psql(
    databaseUrl,
    `
      SELECT id, "productId", COALESCE("photoUrl",'')
      FROM "ProductReview"
      WHERE COALESCE("photoUrl",'') LIKE '%/uploads/%'
    `
  )) {
    const refs = extractUploadRefsFromText(photoUrl)
    for (const mp of missingForRefs(existingUploads, refs)) {
      missing.push({ table: "ProductReview", id, slug: productId, field: "photoUrl", missingPath: mp })
    }
  }

  // DesignSettings (JSON stored as text)
  for (const [id, key, config] of psql(
    databaseUrl,
    `
      SELECT id, key, config
      FROM "DesignSettings"
      WHERE config LIKE '%/uploads/%'
    `
  )) {
    const refs = extractUploadRefsFromText(config)
    for (const mp of missingForRefs(existingUploads, refs)) {
      missing.push({ table: "DesignSettings", id, slug: key, field: "config", missingPath: mp })
    }
  }

  // MediaAsset (authoritative media registry)
  for (const [id, imageUrl, masterUrl] of psql(
    databaseUrl,
    `
      SELECT id, image_url, COALESCE(master_url,'')
      FROM "MediaAsset"
      WHERE image_url LIKE '%/uploads/%' OR COALESCE(master_url,'') LIKE '%/uploads/%'
    `
  )) {
    const refs = [...extractUploadRefsFromText(imageUrl), ...extractUploadRefsFromText(masterUrl)]
    for (const mp of missingForRefs(existingUploads, refs)) {
      missing.push({ table: "MediaAsset", id, slug: null, field: "image_url/master_url", missingPath: mp })
    }
  }

  // de-dupe
  const keyFn = (m) => `${m.table}:${m.id}:${m.field}:${m.missingPath}`
  const uniq = Array.from(new Map(missing.map((m) => [keyFn(m), m])).values())

  if (uniq.length === 0) {
    console.log("OK: No missing /uploads references found in DB tables scanned.")
    return
  }

  console.log(`Missing upload references (${uniq.length}):`)
  for (const m of uniq) {
    const extra = m.slug ? ` slug=${m.slug}` : ""
    console.log(`- ${m.table} id=${m.id}${extra} field=${m.field} -> ${m.missingPath}`)
  }

  // Also summarize unique missing paths
  const paths = Array.from(new Set(uniq.map((m) => m.missingPath))).sort()
  console.log("\nUnique missing paths:")
  for (const p of paths) console.log(`- ${p}`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

