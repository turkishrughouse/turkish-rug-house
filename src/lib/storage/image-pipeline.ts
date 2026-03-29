import crypto from "crypto"
import { logger } from "@/lib/logger"

export type ImageVariantName = "thumb" | "large" | "master"

export type ImageVariantResult = {
  variant: ImageVariantName
  buffer: Buffer
  width?: number
  height?: number
  ext: "webp" | "avif"
  contentType: "image/webp" | "image/avif"
}

export type ProcessedImage = {
  checksum: string
  width?: number
  height?: number
  variants: ImageVariantResult[]
}

type SharpLike = ((
  input: Buffer
) => {
  metadata: () => Promise<{ width?: number; height?: number }>
  rotate: () => {
    clone: () => SharpPipelineLike
  }
}) & {
  // noop, needed only for type compatibility when module exists.
}

type SharpPipelineLike = {
  resize: (width: number, height?: number, opts?: Record<string, unknown>) => SharpPipelineLike
  webp: (opts: Record<string, unknown>) => SharpPipelineLike
  avif: (opts: Record<string, unknown>) => SharpPipelineLike
  toBuffer: (opts?: { resolveWithObject?: boolean }) => Promise<{ data: Buffer; info?: { width?: number; height?: number } }>
}

async function loadSharp() {
  try {
    const req = eval("require") as (id: string) => unknown
    return req("sharp") as SharpLike
  } catch {
    return null
  }
}

function sha256(input: Buffer) {
  return crypto.createHash("sha256").update(input).digest("hex")
}

export async function processUploadImage(
  input: Buffer,
  enableAvif = false
): Promise<ProcessedImage> {
  const checksum = sha256(input)
  const sharp = await loadSharp()
  if (!sharp) {
    return {
      checksum,
      variants: [
        {
          variant: "master",
          buffer: input,
          ext: "webp",
          contentType: "image/webp",
        },
      ],
    }
  }

  const base = sharp(input).rotate()
  const meta = await sharp(input).metadata()

  const makeWebpVariant = async (
    variant: ImageVariantName,
    maxWidth: number,
    quality: number
  ): Promise<ImageVariantResult> => {
    const out = await base
      .clone()
      .resize(maxWidth, undefined, { fit: "inside", withoutEnlargement: true })
      .webp({ quality, effort: 6 })
      .toBuffer({ resolveWithObject: true })
    return {
      variant,
      buffer: out.data,
      width: out.info?.width,
      height: out.info?.height,
      ext: "webp",
      contentType: "image/webp",
    }
  }

  const variants: ImageVariantResult[] = [
    await makeWebpVariant("thumb", 480, 82),
    await makeWebpVariant("large", 1400, 86),
    await makeWebpVariant("master", 2400, 90),
  ]

  if (enableAvif) {
    try {
      const avif = await base
        .clone()
        .resize(2400, undefined, { fit: "inside", withoutEnlargement: true })
        .avif({ quality: 55, effort: 4 })
        .toBuffer({ resolveWithObject: true })
      variants.push({
        variant: "master",
        buffer: avif.data,
        width: avif.info?.width,
        height: avif.info?.height,
        ext: "avif",
        contentType: "image/avif",
      })
    } catch (error) {
      logger.warn("AVIF generation skipped", { error: error instanceof Error ? error.message : String(error) }, "image-pipeline")
    }
  }

  return {
    checksum,
    width: meta.width,
    height: meta.height,
    variants,
  }
}
