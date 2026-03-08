import { getImageUrl } from "@/lib/storage/url"

export type ProductImageRecord = {
  image_url: string
  width?: number | null
  height?: number | null
  alt?: string | null
  sort_order?: number
  is_primary?: boolean
  variants?: {
    thumb?: string
    large?: string
    master?: string
  }
}

function isProductImageRecord(value: unknown): value is ProductImageRecord {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as { image_url?: unknown }).image_url === "string"
  )
}

export function parseProductImages(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string" && item.trim().length > 0) return getImageUrl(item.trim())
        if (isProductImageRecord(item)) return getImageUrl(item.image_url)
        return ""
      })
      .filter(Boolean)
  }
  if (typeof value !== "string") return []

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parseProductImages(parsed)
  } catch {
    return []
  }
}

export function pickPrimaryImage(featuredImage: string | null | undefined, imagesValue: unknown) {
  const featured = typeof featuredImage === "string" ? getImageUrl(featuredImage.trim()) : ""
  if (featured.length > 0) return featured
  const parsed = parseProductImages(imagesValue)
  return parsed[0] || ""
}

export function normalizeProductImageRecords(value: unknown): ProductImageRecord[] {
  const urls = parseProductImages(value)
  return urls.map((url, index) => ({
    image_url: url,
    width: null,
    height: null,
    alt: "",
    sort_order: index,
    is_primary: index === 0,
    variants: {
      master: url,
      large: url,
      thumb: url,
    },
  }))
}
