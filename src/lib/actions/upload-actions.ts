"use server"

import { v4 as uuidv4 } from "uuid"
import { getEnv } from "@/lib/env"
import { logger } from "@/lib/logger"
import { getStorageProvider } from "@/lib/storage/provider"
import { processUploadImage } from "@/lib/storage/image-pipeline"
import { ensureMediaRegistryTable, findMediaByChecksum, upsertMediaAsset } from "@/lib/media-registry"

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/avif"])
const MIN_MASTER_WIDTH = 1800

export async function uploadImage(formData: FormData) {
  const file = formData.get("file") as File | null
  if (!file) {
    return { success: false, error: "No file provided" }
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return { success: false, error: "Unsupported file type" }
  }

  try {
    const env = getEnv()
    const maxBytes = env.UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024
    if (file.size > maxBytes) {
      return { success: false, error: `File too large. Max ${env.UPLOAD_MAX_FILE_SIZE_MB}MB.` }
    }

    const bytes = await file.arrayBuffer()
    const processed = await processUploadImage(Buffer.from(bytes), env.UPLOAD_ENABLE_AVIF)
    if ((processed.width || 0) < MIN_MASTER_WIDTH) {
      return {
        success: false,
        error: `Image resolution too small for product detail. Minimum width is ${MIN_MASTER_WIDTH}px.`,
      }
    }
    const storage = getStorageProvider()
    const base = uuidv4()
    const folder = "general"

    await ensureMediaRegistryTable()
    const existing = await findMediaByChecksum(processed.checksum)
    if (existing.length > 0) {
      const primary = existing.find((item) => item.is_primary === 1) || existing[0]
      return {
        success: false,
        duplicate: true,
        error: "This image has already been uploaded.",
        url: primary.image_url,
      }
    }

    const variants: Array<{ variant: string; url: string; width?: number; height?: number; size: number; contentType: string; path: string }> = []
    for (const variant of processed.variants) {
      const object = await storage.putObject({
        folder,
        filename: `${base}-${variant.variant}.${variant.ext}`,
        data: variant.buffer,
        contentType: variant.contentType,
        cacheControl: "public, max-age=31536000, immutable",
      })
      variants.push({
        variant: variant.variant,
        url: object.url,
        width: variant.width,
        height: variant.height,
        size: object.size,
        contentType: variant.contentType,
        path: object.path,
      })
    }

    const master = variants.find((item) => item.variant === "master") || variants[0]
    for (const variant of variants) {
      await upsertMediaAsset({
        id: `${base}-${variant.variant}`,
        image_url: variant.url,
        width: variant.width ?? processed.width ?? null,
        height: variant.height ?? processed.height ?? null,
        alt: "",
        sort_order: variant.variant === "thumb" ? 0 : variant.variant === "large" ? 1 : 2,
        is_primary: variant.url === master.url,
        variant: variant.variant,
        master_url: master.url,
        checksum: processed.checksum,
        mime_type: variant.contentType,
        size_bytes: variant.size,
        storage_provider: storage.name,
        object_key: variant.path,
      })
    }

    return {
      success: true,
      url: master.url,
      name: file.name,
      size: master.size,
      variants: {
        thumb: variants.find((item) => item.variant === "thumb")?.url || master.url,
        large: variants.find((item) => item.variant === "large")?.url || master.url,
        master: master.url,
      },
    }
  } catch (error) {
    logger.error("uploadImage action failed", { error: error instanceof Error ? error.message : String(error) }, "upload-action")
    return { success: false, error: "Failed to upload file" }
  }
}
