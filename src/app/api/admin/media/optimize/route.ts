import { NextRequest, NextResponse } from "next/server"
import { readdir, readFile, stat, writeFile } from "fs/promises"
import path from "path"
import { getSessionUser } from "@/lib/auth-server"
import { isAdminRole } from "@/lib/rbac"
import { optimizeImageForUpload } from "@/lib/image-optimizer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
}

async function listFilesRecursive(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => [])
  const files: string[] = []
  for (const entry of entries) {
    const full = path.join(root, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(full)))
      continue
    }
    files.push(full)
  }
  return files
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser("admin")
  if (!user || !isAdminRole(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as { folder?: string | null }
  const folderRaw = (body.folder || "").trim()
  const uploadRoot = path.join(process.cwd(), "public", "uploads")
  const targetRoot = folderRaw && folderRaw !== "all" ? path.join(uploadRoot, folderRaw) : uploadRoot

  if (!targetRoot.startsWith(uploadRoot)) {
    return NextResponse.json({ error: "Invalid folder path" }, { status: 400 })
  }

  const files = await listFilesRecursive(targetRoot)
  let processed = 0
  let optimized = 0
  let skipped = 0
  let bytesSaved = 0

  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase()
    const mime = MIME_BY_EXT[ext]
    if (!mime) {
      skipped += 1
      continue
    }

    const meta = await stat(filePath).catch(() => null)
    if (!meta?.isFile()) {
      skipped += 1
      continue
    }
    processed += 1

    try {
      const original = await readFile(filePath)
      const result = await optimizeImageForUpload(original, mime)
      if (result.optimized && result.buffer.length < original.length) {
        await writeFile(filePath, result.buffer)
        optimized += 1
        bytesSaved += original.length - result.buffer.length
      }
    } catch {
      skipped += 1
    }
  }

  return NextResponse.json({
    success: true,
    processed,
    optimized,
    skipped,
    bytesSaved,
  })
}
