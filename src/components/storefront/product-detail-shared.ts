import { PLACEHOLDER_IMAGE_URL, buildProductImageAlt, getProductImageUrl, getProductImageUrlCandidates, parseProductImageRecords } from "@/lib/product-images"
import { normalizeRichTextHtml } from "@/lib/rich-text"

export type ProductCategory = {
  id: string
  title: string
  slug: string
  path?: string
}

export type ProductDetailData = {
  id: string
  slug: string
  sku: string | null
  customAttributes?: Array<{ name: string; values: string[]; visible: boolean }>
  title: string
  shortDescription: string | null
  description: string | null
  price: number
  compareAtPrice: number | null
  isStock: boolean
  stockCount: number
  images: string
  categories: ProductCategory[]
}

export type RelatedProduct = {
  id: string
  slug: string
  title: string
  description?: string | null
  price: number
  compareAtPrice: number | null
  images: string
  stockCount?: number
  isStock?: boolean
  categories?: Array<{ id: string; title: string; slug: string }>
}

export type NavProduct = {
  slug: string
  title: string
  price: number
  compareAtPrice: number | null
  images: string
}

export type ProductGalleryImage = {
  src: string
  srcCandidates: string[]
  zoomSrc: string
  zoomSrcCandidates: string[]
  thumbSrc: string
  thumbSrcCandidates: string[]
  alt: string
  width: number
  height: number
}

export const richContentClassName = [
  "max-w-full overflow-x-auto whitespace-normal break-words text-sm leading-6 text-slate-700 [overflow-wrap:anywhere] [writing-mode:horizontal-tb]",
  "[&_strong]:font-semibold [&_em]:italic",
  "[&_h1]:mb-4 [&_h1]:text-[clamp(1.75rem,4vw,2.25rem)] [&_h1]:font-semibold [&_h1]:leading-tight",
  "[&_h2]:mb-4 [&_h2]:text-[clamp(1.45rem,3vw,1.9rem)] [&_h2]:font-semibold [&_h2]:leading-tight",
  "[&_h3]:mb-3 [&_h3]:text-[clamp(1.2rem,2.5vw,1.5rem)] [&_h3]:font-semibold [&_h3]:leading-snug",
  "[&_h4]:mb-3 [&_h4]:text-[clamp(1.05rem,2vw,1.25rem)] [&_h4]:font-semibold [&_h4]:leading-snug",
  "[&_h5]:mb-2 [&_h5]:text-base [&_h5]:font-semibold [&_h5]:leading-snug",
  "[&_h6]:mb-2 [&_h6]:text-sm [&_h6]:font-semibold [&_h6]:leading-snug",
  "[&_p]:mb-3 [&_p]:max-w-full [&_p]:whitespace-normal [&_p]:break-words [&_p]:[overflow-wrap:anywhere] [&_p:last-child]:mb-0",
  "[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6",
  "[&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6",
  "[&_li]:mb-1",
  "[&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-4 [&_blockquote]:italic",
  "[&_a]:text-emerald-700 [&_a]:underline",
  "[&_hr]:my-4 [&_hr]:border-slate-200",
  "[&_table]:my-3 [&_table]:w-full [&_table]:max-w-full [&_table]:table-fixed [&_table]:border-collapse",
  "[&_th]:border [&_th]:border-[#d6dde7] [&_th]:bg-slate-100 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:whitespace-normal [&_th]:break-words [&_th]:[overflow-wrap:anywhere]",
  "[&_td]:border [&_td]:border-[#d6dde7] [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_td]:whitespace-normal [&_td]:break-words [&_td]:[overflow-wrap:anywhere]",
  "[&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-md",
  "[&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-slate-950 [&_pre]:p-4 [&_pre]:text-xs [&_pre]:text-slate-100",
  "[&_code]:break-words",
].join(" ")

export function parseImages(images: string): string[] {
  return parseProductImageRecords(images).map((image) => getProductImageUrl(image, "thumb"))
}

function withoutPlaceholder(candidates: string[]) {
  return candidates.filter((candidate) => candidate && candidate !== PLACEHOLDER_IMAGE_URL)
}

function uniqueCandidates(candidates: string[]) {
  return Array.from(new Set(candidates.filter(Boolean)))
}

export function buildProductGallery(product: ProductDetailData): ProductGalleryImage[] {
  const records = parseProductImageRecords(product.images)
  if (records.length === 0) {
    return [
      {
        src: "/placeholder.jpg",
        srcCandidates: ["/placeholder.jpg"],
        zoomSrc: "/placeholder.jpg",
        zoomSrcCandidates: ["/placeholder.jpg"],
        thumbSrc: "/placeholder.jpg",
        thumbSrcCandidates: ["/placeholder.jpg"],
        alt: buildProductImageAlt({
          title: product.title,
          categories: product.categories,
          customAttributes: product.customAttributes,
        }),
        width: 1200,
        height: 1200,
      },
    ]
  }

  const galleryItems = records
    .map((image, index) => {
      const largeCandidates = withoutPlaceholder(getProductImageUrlCandidates(image, "large"))
      const masterCandidates = withoutPlaceholder(getProductImageUrlCandidates(image, "master"))
      const thumbCandidates = withoutPlaceholder(getProductImageUrlCandidates(image, "thumb"))
      const srcCandidates = uniqueCandidates([...largeCandidates, ...masterCandidates, ...thumbCandidates])
      const zoomSrcCandidates = uniqueCandidates([...masterCandidates, ...largeCandidates, ...thumbCandidates])
      const thumbSrcCandidates = uniqueCandidates([...thumbCandidates, ...largeCandidates, ...masterCandidates])

      if (srcCandidates.length === 0 && zoomSrcCandidates.length === 0 && thumbSrcCandidates.length === 0) {
        return null
      }

      const selectedImageSrc = srcCandidates[0] || zoomSrcCandidates[0] || thumbSrcCandidates[0] || PLACEHOLDER_IMAGE_URL
      const zoomSrc = zoomSrcCandidates[0] || selectedImageSrc
      const thumbSrc = thumbSrcCandidates[0] || selectedImageSrc
      const masterImage = masterCandidates[0] || null

      if (masterImage && typeof image.width === "number" && image.width < 1800) {
        console.warn(
          "[PRODUCT_IMAGE_WARN]",
          JSON.stringify({
            productSlug: product.slug,
            imageSrc: masterImage,
            width: image.width,
            height: image.height ?? null,
          })
        )
      }

      console.info(
        "[ZOOM_DEBUG]",
        JSON.stringify({
          productSlug: product.slug,
          selectedImageSrc,
          candidateList: zoomSrcCandidates,
          finalZoomSrc: zoomSrc,
        })
      )

      return {
        src: selectedImageSrc,
        srcCandidates: srcCandidates.length > 0 ? srcCandidates : [PLACEHOLDER_IMAGE_URL],
        zoomSrc,
        zoomSrcCandidates: zoomSrcCandidates.length > 0 ? zoomSrcCandidates : [selectedImageSrc],
        thumbSrc,
        thumbSrcCandidates: thumbSrcCandidates.length > 0 ? thumbSrcCandidates : [selectedImageSrc],
        alt: buildProductImageAlt({
          title: product.title,
          fallbackAlt: image.alt,
          categories: product.categories,
          customAttributes: product.customAttributes,
          index,
        }),
        width: image.width ?? 1200,
        height: image.height ?? 1200,
      }
    })
    .filter((item): item is ProductGalleryImage => Boolean(item))

  if (galleryItems.length === 0) {
    return [
      {
        src: "/placeholder.jpg",
        srcCandidates: ["/placeholder.jpg"],
        zoomSrc: "/placeholder.jpg",
        zoomSrcCandidates: ["/placeholder.jpg"],
        thumbSrc: "/placeholder.jpg",
        thumbSrcCandidates: ["/placeholder.jpg"],
        alt: buildProductImageAlt({
          title: product.title,
          categories: product.categories,
          customAttributes: product.customAttributes,
        }),
        width: 1200,
        height: 1200,
      },
    ]
  }

  return galleryItems
}

export function getProductDescriptionState(product: ProductDetailData, shippingContent?: string | null) {
  const shortDescriptionHtml = normalizeRichTextHtml(product.shortDescription?.trim())
  const longDescriptionHtml = normalizeRichTextHtml(product.description)
  const bottomDescriptionHtml = longDescriptionHtml || "<p>Detailed product information is not available yet.</p>"
  const bottomDescriptionTextLength = bottomDescriptionHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().length
  const shippingHtml =
    normalizeRichTextHtml(shippingContent?.trim()) ||
    "<p>Delivery estimates and shipping details are shown at checkout.</p>"
  const shippingTextLength = shippingHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().length

  return {
    shortDescriptionHtml,
    bottomDescriptionHtml,
    canExpandBottomDescription: bottomDescriptionTextLength > 380,
    shippingHtml,
    canExpandShipping: shippingTextLength > 520,
  }
}
