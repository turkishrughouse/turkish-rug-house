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

type ProductImageAltAttribute = {
  name: string
  values: string[]
  visible?: boolean
}

type ProductImageAltInput = {
  title: string
  fallbackAlt?: string | null
  categories?: Array<string | { title?: string | null; name?: string | null }>
  customAttributes?: ProductImageAltAttribute[]
  index?: number
}

function isProductImageRecord(value: unknown): value is ProductImageRecord {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as { image_url?: unknown }).image_url === "string"
  )
}

function normalizeImageRecord(record: ProductImageRecord, index: number): ProductImageRecord {
  return {
    image_url: getImageUrl(record.image_url),
    width: record.width ?? null,
    height: record.height ?? null,
    alt: typeof record.alt === "string" ? record.alt.trim() : "",
    sort_order: typeof record.sort_order === "number" ? record.sort_order : index,
    is_primary: record.is_primary ?? index === 0,
    variants: {
      thumb: getImageUrl(record.variants?.thumb || record.image_url),
      large: getImageUrl(record.variants?.large || record.image_url),
      master: getImageUrl(record.variants?.master || record.image_url),
    },
  }
}

function parseRawProductImages(value: unknown): Array<string | ProductImageRecord> {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value !== "string") return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    const fallback = value.trim()
    return fallback ? [fallback] : []
  }
}

function uniqueNormalized(values: string[]) {
  const seen = new Set<string>()
  return values.filter((value) => {
    const normalized = value.toLowerCase()
    if (!normalized || seen.has(normalized)) return false
    seen.add(normalized)
    return true
  })
}

function cleanText(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim()
}

function isGenericImageAlt(value: string) {
  const normalized = cleanText(value).toLowerCase()
  if (!normalized) return true

  return normalized === "product image" || normalized === "image" || normalized === "product" || normalized === "rug"
}

export function buildProductImageAlt({
  title,
  fallbackAlt,
  categories = [],
  customAttributes = [],
  index = 0,
}: ProductImageAltInput) {
  const safeTitle = cleanText(title) || "Turkish rug"
  const safeFallback = cleanText(fallbackAlt)

  if (safeFallback && !isGenericImageAlt(safeFallback)) {
    return safeFallback
  }

  if (cleanText(title)) {
    return safeTitle
  }

  const categoryLabel = categories
    .map((category) => {
      if (typeof category === "string") return cleanText(category)
      return cleanText(category.title || category.name)
    })
    .find(Boolean)

  const preferredAttributes = ["color", "size", "style", "age", "material"]
  const attributeValues = uniqueNormalized(
    customAttributes
      .filter((attribute) => attribute.visible !== false)
      .sort((a, b) => preferredAttributes.indexOf(a.name.toLowerCase()) - preferredAttributes.indexOf(b.name.toLowerCase()))
      .flatMap((attribute) => attribute.values.map((value) => cleanText(value)).filter(Boolean))
  ).slice(0, 3)

  const parts = uniqueNormalized([safeTitle, ...attributeValues, categoryLabel || ""]).filter(Boolean)
  const alt = parts.join(" - ")
  return index > 0 ? `${alt} image ${index + 1}` : alt
}

export function getProductImageUrl(
  image: ProductImageRecord | string | null | undefined,
  preferredVariant: "thumb" | "large" | "master" = "large"
) {
  if (!image) return ""
  if (typeof image === "string") return getImageUrl(image)
  return image.variants?.[preferredVariant] || image.image_url
}

export function parseProductImages(value: unknown): string[] {
  return parseProductImageRecords(value).map((image) => getProductImageUrl(image, "large")).filter(Boolean)
}

export function pickPrimaryImage(featuredImage: string | null | undefined, imagesValue: unknown) {
  const featured = typeof featuredImage === "string" ? getImageUrl(featuredImage.trim()) : ""
  if (featured.length > 0) return featured
  const parsed = parseProductImages(imagesValue)
  return parsed[0] || ""
}

export function normalizeProductImageRecords(value: unknown): ProductImageRecord[] {
  return parseProductImageRecords(value)
}

export function parseProductImageRecords(value: unknown): ProductImageRecord[] {
  return parseRawProductImages(value)
    .map((item, index) => {
      if (typeof item === "string" && item.trim().length > 0) {
        return normalizeImageRecord({ image_url: item.trim() }, index)
      }
      if (isProductImageRecord(item)) {
        return normalizeImageRecord(item, index)
      }
      return null
    })
    .filter((item): item is ProductImageRecord => Boolean(item))
}
