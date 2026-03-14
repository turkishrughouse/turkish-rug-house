export type BlogCardItem = {
  id: string
  title: string
  slug: string
  excerpt: string
  featuredImage: string | null
  publishedAt: string
}

export type BlogStatus = "DRAFT" | "PUBLISHED"

export type BlogListItem = {
  id: string
  title: string
  slug: string
  excerpt: string
  content: string
  featuredImage: string | null
  status: BlogStatus
  publishedAt: Date | null
  createdAt: Date
  updatedAt: Date
  metaTitle: string | null
  metaDescription: string | null
}

export function normalizeBlogExcerpt(value: string | null | undefined) {
  const clean = (value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
  if (!clean) return "Discover editorial stories and insights from the world of handmade Turkish rugs."
  return clean
}

export function stripBlogHtml(input: string | null | undefined) {
  return (input || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

export function formatBlogDate(value: string | Date | null | undefined) {
  if (!value) return ""
  const date = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}
