import { mkdir, writeFile } from "fs/promises"
import path from "path"
import { getEnv } from "@/lib/env"
import type { PutObjectInput, StorageProvider, StoredObject } from "@/lib/storage/types"

const UPLOAD_PREFIX = "/uploads/"

function cleanSegment(value: string) {
  return value.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "")
}

export class LocalStorageProvider implements StorageProvider {
  readonly name = "local"

  getPublicUrl(storagePath: string) {
    const cleaned = cleanSegment(storagePath)
    const env = getEnv()
    if (env.UPLOAD_PUBLIC_BASE_URL) {
      return `${env.UPLOAD_PUBLIC_BASE_URL.replace(/\/+$/, "")}${UPLOAD_PREFIX}${cleaned}`
    }
    return `${UPLOAD_PREFIX}${cleaned}`
  }

  toRelativePath(urlOrPath: string) {
    const value = (urlOrPath || "").trim()
    if (!value) return null
    if (value.startsWith(UPLOAD_PREFIX)) return cleanSegment(value.replace(UPLOAD_PREFIX, ""))
    const uploadsIndex = value.indexOf(`${UPLOAD_PREFIX}`)
    if (uploadsIndex >= 0) return cleanSegment(value.slice(uploadsIndex + UPLOAD_PREFIX.length))
    return null
  }

  async putObject(input: PutObjectInput): Promise<StoredObject> {
    const folder = cleanSegment(input.folder)
    const relativePath = cleanSegment(path.posix.join(folder, input.filename))
    const absolutePath = path.join(process.cwd(), "public", "uploads", relativePath)
    await mkdir(path.dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, input.data)
    return {
      path: relativePath,
      url: this.getPublicUrl(relativePath),
      size: input.data.length,
    }
  }
}

