import { lstat, mkdir, readlink, symlink } from "fs/promises"
import path from "path"
import { getEnv } from "@/lib/env"

function projectRoot() {
  return process.cwd()
}

function publicUploadsPath() {
  return path.join(projectRoot(), "public", "uploads")
}

function fallbackUploadsRoot() {
  return path.join(projectRoot(), "public", "uploads")
}

export function getPersistentUploadsRoot() {
  const env = getEnv()
  const configured = (env.UPLOAD_ROOT_DIR || "").trim()
  if (configured) return path.resolve(configured)
  if (env.NODE_ENV === "production") return "/var/www/uploads"
  return fallbackUploadsRoot()
}

export function resolveUploadAbsolutePath(relativePath: string) {
  const clean = (relativePath || "").replace(/\\/g, "/").replace(/^\/+/, "")
  return path.join(getPersistentUploadsRoot(), clean)
}

async function ensurePublicUploadsSymlink() {
  const targetRoot = getPersistentUploadsRoot()
  const publicPath = publicUploadsPath()
  const publicDir = path.dirname(publicPath)

  await mkdir(targetRoot, { recursive: true })
  await mkdir(publicDir, { recursive: true })

  if (targetRoot === publicPath) return

  const existing = await lstat(publicPath).catch(() => null)
  if (!existing) {
    await symlink(targetRoot, publicPath)
    return
  }

  if (existing.isSymbolicLink()) {
    const currentTarget = await readlink(publicPath).catch(() => "")
    if (path.resolve(publicDir, currentTarget) === targetRoot || path.resolve(currentTarget) === targetRoot) {
      return
    }
  }
}

export async function ensureUploadStorageReady() {
  await ensurePublicUploadsSymlink().catch(async () => {
    await mkdir(getPersistentUploadsRoot(), { recursive: true })
  })
}

export { publicUploadsPath }
