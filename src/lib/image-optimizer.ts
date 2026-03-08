const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
])

type OptimizeResult = {
  buffer: Buffer
  width?: number
  height?: number
  optimized: boolean
}

async function loadSharp() {
  try {
    // Avoid TS module resolution errors when sharp is not installed.
    const req = eval("require") as (id: string) => unknown
    return req("sharp") as
      | ((input?: Buffer) => {
          metadata: () => Promise<{ width?: number; height?: number }>
          rotate: () => unknown
          jpeg: (options: Record<string, unknown>) => { toBuffer: () => Promise<Buffer> }
          png: (options: Record<string, unknown>) => { toBuffer: () => Promise<Buffer> }
          webp: (options: Record<string, unknown>) => { toBuffer: () => Promise<Buffer> }
          avif: (options: Record<string, unknown>) => { toBuffer: () => Promise<Buffer> }
        })
      | null
  } catch {
    return null
  }
}

export async function optimizeImageForUpload(
  input: Buffer,
  mimeType: string
): Promise<OptimizeResult> {
  if (!IMAGE_MIME_TYPES.has(mimeType)) {
    return { buffer: input, optimized: false }
  }

  const sharp = await loadSharp()
  if (!sharp) {
    return { buffer: input, optimized: false }
  }

  try {
    const image = sharp(input)
    const meta = await image.metadata()
    const rotated = image.rotate() as {
      jpeg: (options: Record<string, unknown>) => { toBuffer: () => Promise<Buffer> }
      png: (options: Record<string, unknown>) => { toBuffer: () => Promise<Buffer> }
      webp: (options: Record<string, unknown>) => { toBuffer: () => Promise<Buffer> }
      avif: (options: Record<string, unknown>) => { toBuffer: () => Promise<Buffer> }
    }
    let output = input

    if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
      output = await rotated
        .jpeg({
          quality: 95,
          mozjpeg: true,
          chromaSubsampling: "4:4:4",
          progressive: true,
        })
        .toBuffer()
    } else if (mimeType === "image/png") {
      output = await rotated
        .png({
          compressionLevel: 9,
          palette: false,
          adaptiveFiltering: true,
        })
        .toBuffer()
    } else if (mimeType === "image/webp") {
      output = await rotated
        .webp({
          quality: 96,
          alphaQuality: 100,
          smartSubsample: true,
        })
        .toBuffer()
    } else if (mimeType === "image/avif") {
      output = await rotated
        .avif({
          quality: 90,
        })
        .toBuffer()
    }

    // Keep original buffer if optimization does not help.
    if (output.length > input.length * 1.05) {
      output = input
    }

    return {
      buffer: output,
      width: meta.width,
      height: meta.height,
      optimized: output !== input,
    }
  } catch {
    return { buffer: input, optimized: false }
  }
}
