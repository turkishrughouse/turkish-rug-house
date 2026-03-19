export type BlogCategory = {
  slug: string
  title: string
}

export type BlogAuthor = {
  name: string
  title?: string | null
  avatarUrl?: string | null
}

export type BlogCta = {
  title: string
  text?: string | null
  buttonLabel: string
  buttonUrl: string
  variant?: "primary" | "secondary" | "subtle"
}

export type BlogFeaturedProducts = {
  title?: string | null
  productIds?: string[] | null
  collectionHandle?: string | null
}

export type BlogRelatedPosts = {
  title?: string | null
  postIds?: string[] | null
  mode?: "manual" | "auto"
}

export type BlogRelatedCategoryLink = {
  title: string
  url: string
  description?: string | null
}

export type BlogFaqItem = {
  question: string
  answer: string
}

export type BlogContentBlock =
  | { id: string; type: "heading"; level: 2 | 3; text: string; anchor?: string | null }
  | { id: string; type: "richText"; html: string }
  | { id: string; type: "image"; url: string; alt: string; caption?: string | null }
  | { id: string; type: "quote"; quote: string; attribution?: string | null }
  | { id: string; type: "cta"; cta: BlogCta }
  | { id: string; type: "featuredProducts"; config: BlogFeaturedProducts }
  | { id: string; type: "relatedCategories"; title?: string | null; links: BlogRelatedCategoryLink[] }
  | { id: string; type: "relatedPosts"; config: BlogRelatedPosts }
  | { id: string; type: "faq"; title?: string | null; items: BlogFaqItem[] }
  | { id: string; type: "divider" }
  | { id: string; type: "spacer"; size?: "sm" | "md" | "lg" }

export type BlogPostSeo = {
  metaTitle?: string | null
  metaDescription?: string | null
}

export type BlogPostPublic = {
  id: string
  slug: string
  title: string
  excerpt: string
  coverImage: { url: string; alt: string } | null
  author: BlogAuthor | null
  publishDate: Date
  readTimeMinutes: number | null
  category: BlogCategory | null
  tags: string[]
  isFeatured: boolean
  seo: BlogPostSeo
  blocks: BlogContentBlock[]
  updatedAt: Date
}

export type BlogPostCard = Pick<
  BlogPostPublic,
  "id" | "slug" | "title" | "excerpt" | "coverImage" | "publishDate" | "readTimeMinutes" | "category"
>

export type BlogIndexData = {
  posts: BlogPostCard[]
  featured: BlogPostCard | null
  categories: BlogCategory[]
  tags: string[]
}

export function blogSlugifyAnchor(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function extractToc(blocks: BlogContentBlock[]) {
  const items: Array<{ id: string; text: string; level: 2 | 3; anchor: string }> = []
  for (const block of blocks) {
    if (block.type !== "heading") continue
    const anchor = (block.anchor || blogSlugifyAnchor(block.text)).trim()
    if (!anchor) continue
    items.push({ id: block.id, text: block.text, level: block.level, anchor })
  }
  return items
}

