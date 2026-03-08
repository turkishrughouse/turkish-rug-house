export type PageSideBlock = {
  description: string
  image: string
}

export type PageSectionImageItem = {
  url: string
  title: string
}

export type PageLayoutSection = {
  id: string
  enabled: boolean
  type: "content" | "title" | "description" | "image"
  title: string
  layout: "description-image" | "image-description"
  mediaType: "image" | "video"
  description: string
  image: string
  images: string[]
  imageItems: PageSectionImageItem[]
  videoUrl: string
}

export type PageDualLayout = {
  sections: PageLayoutSection[]
  youtubeUrl?: string
}

const MARKER_PREFIX = "<!--rughouse-sections:"
const MARKER_SUFFIX = "-->"

function createDefaultSection(partial?: Partial<PageLayoutSection>): PageLayoutSection {
  const normalizedImageItems = Array.isArray(partial?.imageItems)
    ? partial.imageItems
      .filter((item): item is PageSectionImageItem => {
        return Boolean(item && typeof item.url === "string" && item.url.trim().length > 0)
      })
      .map((item) => ({
        url: item.url.trim(),
        title: typeof item.title === "string" ? item.title : "",
      }))
    : []
  const normalizedImages = Array.isArray(partial?.images)
    ? partial.images.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : []
  const normalizedImage = typeof partial?.image === "string" ? partial.image : ""
  const images = normalizedImageItems.length > 0
    ? normalizedImageItems.map((item) => item.url)
    : normalizedImages.length > 0
      ? normalizedImages
      : (normalizedImage.trim().length > 0 ? [normalizedImage] : [])
  const imageItems = normalizedImageItems.length > 0
    ? normalizedImageItems
    : images.map((url, index) => ({
      url,
      title: index === 0 && typeof partial?.title === "string" ? partial.title : "",
    }))

  return {
    id: partial?.id && partial.id.trim().length > 0 ? partial.id : `section-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    enabled: partial?.enabled !== false,
    type:
      partial?.type === "title"
        ? "title"
        : partial?.type === "description"
          ? "description"
          : partial?.type === "image"
            ? "image"
            : "content",
    title: typeof partial?.title === "string" ? partial.title : "",
    layout: partial?.layout === "image-description" ? "image-description" : "description-image",
    mediaType: partial?.mediaType === "video" ? "video" : "image",
    description: typeof partial?.description === "string" ? partial.description : "",
    image: images[0] || "",
    images,
    imageItems,
    videoUrl: typeof partial?.videoUrl === "string" ? partial.videoUrl : "",
  }
}

export function parsePageLayout(content: string | null | undefined): { layout: PageDualLayout | null; content: string } {
  const source = (content || "").trim()
  if (!source.startsWith(MARKER_PREFIX)) {
    return { layout: null, content: content || "" }
  }

  const endIndex = source.indexOf(MARKER_SUFFIX)
  if (endIndex === -1) {
    return { layout: null, content: content || "" }
  }

  const encoded = source.slice(MARKER_PREFIX.length, endIndex).trim()
  const rest = source.slice(endIndex + MARKER_SUFFIX.length).trimStart()

  try {
    const parsed = JSON.parse(decodeURIComponent(encoded)) as Partial<PageDualLayout> & {
      left?: Partial<PageSideBlock>
      right?: Partial<PageSideBlock>
      enabled?: boolean
      layout?: "description-image" | "image-description"
      mediaType?: "image" | "video"
      type?: "content" | "title" | "description" | "image"
      title?: string
      description?: string
      image?: string
      images?: string[]
      imageItems?: Array<{ url?: string; title?: string }>
      videoUrl?: string
      youtubeUrl?: string
    }

    // Backward compatibility with old structure:
    // { left: { description, image }, right: { description, image } }
    if (parsed.left || parsed.right) {
      const oldLeft = parsed.left || {}
      return {
      layout: {
        sections: [
            createDefaultSection({
              enabled: true,
              type: "content",
              layout: "description-image",
              description: typeof oldLeft.description === "string" ? oldLeft.description : "",
              image: typeof oldLeft.image === "string" ? oldLeft.image : "",
              images: typeof oldLeft.image === "string" && oldLeft.image.trim().length > 0 ? [oldLeft.image] : [],
              imageItems: typeof oldLeft.image === "string" && oldLeft.image.trim().length > 0
                ? [{ url: oldLeft.image, title: "" }]
                : [],
              mediaType: "image",
              videoUrl: "",
            }),
        ],
        youtubeUrl: typeof parsed.youtubeUrl === "string" ? parsed.youtubeUrl : "",
      },
      content: rest,
      }
    }

    // Backward compatibility with single-section format:
    // { enabled, layout, description, image }
    if (!Array.isArray(parsed.sections)) {
      return {
        layout: {
          sections: [
            createDefaultSection({
              enabled: parsed.enabled !== false,
              type:
                parsed.type === "title"
                  ? "title"
                  : parsed.type === "description"
                    ? "description"
                    : parsed.type === "image"
                      ? "image"
                      : "content",
              title: typeof parsed.title === "string" ? parsed.title : "",
              layout: parsed.layout === "image-description" ? "image-description" : "description-image",
              description: typeof parsed.description === "string" ? parsed.description : "",
              image: typeof parsed.image === "string" ? parsed.image : "",
              images: Array.isArray(parsed.images) ? parsed.images : [],
              imageItems: Array.isArray(parsed.imageItems)
                ? parsed.imageItems
                    .filter((item): item is { url: string; title?: string } => Boolean(item && typeof item.url === "string"))
                    .map((item) => ({ url: item.url, title: typeof item.title === "string" ? item.title : "" }))
                : [],
              mediaType: parsed.mediaType === "video" ? "video" : "image",
              videoUrl: typeof parsed.videoUrl === "string" ? parsed.videoUrl : "",
            }),
          ],
          youtubeUrl: typeof parsed.youtubeUrl === "string" ? parsed.youtubeUrl : "",
        },
        content: rest,
      }
    }

    const sections = parsed.sections.map((item) => createDefaultSection(item)).filter(Boolean)
    return {
      layout: {
        sections,
        youtubeUrl: typeof parsed.youtubeUrl === "string" ? parsed.youtubeUrl : "",
      },
      content: rest,
    }
  } catch {
    return { layout: null, content: content || "" }
  }
}

export function composePageContent(content: string, layout: PageDualLayout): string {
  const encoded = encodeURIComponent(JSON.stringify(layout))
  const body = (content || "").trim()
  if (!body) return `${MARKER_PREFIX}${encoded}${MARKER_SUFFIX}`
  return `${MARKER_PREFIX}${encoded}${MARKER_SUFFIX}\n${body}`
}
