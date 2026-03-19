import { NextRequest } from "next/server"
import { promises as fs } from "fs"
import path from "path"

function contentTypeFor(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === ".webp") return "image/webp"
  if (ext === ".png") return "image/png"
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg"
  if (ext === ".gif") return "image/gif"
  if (ext === ".svg") return "image/svg+xml"
  if (ext === ".mp4") return "video/mp4"
  if (ext === ".json") return "application/json"
  return "application/octet-stream"
}

function safePathParts(parts: string[]) {
  return parts.filter(Boolean).filter((p) => p !== "." && p !== ".." && !p.includes("\\"))
}

export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: rawParts } = await ctx.params
  const parts = safePathParts(Array.isArray(rawParts) ? rawParts : [])
  const publicRoot = path.join(process.cwd(), "public")
  const target = path.join(publicRoot, "uploads", ...parts)

  // Ensure request stays inside /public/uploads.
  const normalized = path.normalize(target)
  const allowedRoot = path.join(publicRoot, "uploads") + path.sep
  if (!normalized.startsWith(allowedRoot)) {
    return new Response("Not found", { status: 404 })
  }

  try {
    const buf = await fs.readFile(normalized)
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": contentTypeFor(normalized),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch {
    // Serve a lightweight placeholder to avoid repeated 404 runtime noise
    // when DB references an upload path that no longer exists on disk.
    const placeholder = await fs.readFile(path.join(publicRoot, "placeholder.svg")).catch(() => null)
    if (!placeholder) return new Response("Not found", { status: 404 })
    return new Response(placeholder, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "no-store",
      },
    })
  }
}

