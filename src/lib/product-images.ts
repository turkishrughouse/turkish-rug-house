import { getImageUrl } from "@/lib/storage/url"

export const PLACEHOLDER_IMAGE_URL = "/placeholder.jpg"

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

const VARIANT_FILENAME_PATTERN = /-(thumb|large|master)(\.[^/?#]+)$/i

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
  const normalizedSources = safeImages([
    record.image_url,
    record.variants?.master || "",
    record.variants?.large || "",
    record.variants?.thumb || "",
  ])
  const normalizedImageUrl = normalizedSources[0] || PLACEHOLDER_IMAGE_URL
  return {
    image_url: normalizedImageUrl,
    width: record.width ?? null,
    height: record.height ?? null,
    alt: typeof record.alt === "string" ? record.alt.trim() : "",
    sort_order: typeof record.sort_order === "number" ? record.sort_order : index,
    is_primary: record.is_primary ?? index === 0,
    variants: {
      thumb: inferVariantUrl(record.variants?.thumb || normalizedImageUrl, "thumb") || normalizedImageUrl,
      large: inferVariantUrl(record.variants?.large || normalizedImageUrl, "large") || normalizedImageUrl,
      master: inferVariantUrl(record.variants?.master || normalizedImageUrl, "master") || normalizedImageUrl,
    },
  }
}

function inferVariantUrl(urlOrPath: string | null | undefined, preferredVariant: "thumb" | "large" | "master") {
  const normalized = getImageUrl(urlOrPath)
  if (!normalized) return ""
  if (normalized === PLACEHOLDER_IMAGE_URL) return PLACEHOLDER_IMAGE_URL

  const queryIndex = normalized.search(/[?#]/)
  const path = queryIndex >= 0 ? normalized.slice(0, queryIndex) : normalized
  const suffix = queryIndex >= 0 ? normalized.slice(queryIndex) : ""

  if (!VARIANT_FILENAME_PATTERN.test(path)) {
    return normalized
  }

  return `${path.replace(VARIANT_FILENAME_PATTERN, `-${preferredVariant}$2`)}${suffix}`
}

function buildVariantCandidates(
  image: ProductImageRecord,
  preferredVariant: "thumb" | "large" | "master"
) {
  const sources = [
    image.variants?.thumb,
    image.variants?.large,
    image.variants?.master,
    image.image_url,
  ]

  const variantOrder =
    preferredVariant === "thumb"
      ? (["thumb", "large", "master"] as const)
      : preferredVariant === "large"
        ? (["large", "thumb", "master"] as const)
        : (["master", "large", "thumb"] as const)

  const candidates: string[] = []
  for (const variant of variantOrder) {
    for (const source of sources) {
      const candidate = inferVariantUrl(source, variant)
      if (candidate) candidates.push(candidate)
    }
  }

  return withPlaceholder(candidates)
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

function isBrokenLiteral(value: string) {
  return ["undefined", "null", "nan", "/undefined", "/null", "/nan"].includes(value.toLowerCase())
}

export function safeImages(images: string[]) {
  return uniqueNormalized(
    images
      .map((value) => getImageUrl(value))
      .map((value) => value.trim())
      .filter((value) => value.length > 0 && !isBrokenLiteral(value))
  )
}

function withPlaceholder(images: string[]) {
  const cleaned = safeImages(images)
  return cleaned.length > 0 ? cleaned : [PLACEHOLDER_IMAGE_URL]
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
  return getProductImageUrlCandidates(image, preferredVariant)[0] || PLACEHOLDER_IMAGE_URL
}

export function getProductImageUrlCandidates(
  image: ProductImageRecord | string | null | undefined,
  preferredVariant: "thumb" | "large" | "master" = "large"
) {
  if (!image) return [PLACEHOLDER_IMAGE_URL]
  if (typeof image === "string") {
    const normalized = inferVariantUrl(image, preferredVariant)
    return withPlaceholder(normalized ? [normalized] : [])
  }

  return buildVariantCandidates(image, preferredVariant)
}

export function parseProductImages(
  value: unknown,
  preferredVariant: "thumb" | "large" | "master" = "large"
): string[] {
  return safeImages(parseProductImageRecords(value).map((image) => getProductImageUrl(image, preferredVariant)))
}

export function pickPrimaryImage(
  featuredImage: string | null | undefined,
  imagesValue: unknown,
  preferredVariant: "thumb" | "large" | "master" = "large"
) {
  const featured = typeof featuredImage === "string" ? getProductImageUrl(featuredImage.trim(), preferredVariant) : ""
  if (featured.length > 0 && featured !== PLACEHOLDER_IMAGE_URL) return featured
  const parsed = parseProductImages(imagesValue, preferredVariant)
  return parsed[0] || PLACEHOLDER_IMAGE_URL
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
