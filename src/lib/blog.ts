import { prisma } from "@/lib/db"

export type BlogCardItem = {
  id: string
  title: string
  slug: string
  excerpt: string
  featuredImage: string | null
  publishedAt: string
}

function normalizeExcerpt(value: string | null | undefined) {
  const clean = (value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
  if (!clean) return "Discover editorial stories and insights from the world of handmade Turkish rugs."
  return clean
}

export function formatBlogDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

export async function getPublishedBlogPosts(limit = 4): Promise<BlogCardItem[]> {
  const posts = await prisma.blogPost.findMany({
    where: {
      status: "PUBLISHED",
      publishedAt: { not: null, lte: new Date() },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      featuredImage: true,
      publishedAt: true,
    },
  })

  return posts.map((post) => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: normalizeExcerpt(post.excerpt),
    featuredImage: post.featuredImage || null,
    publishedAt: post.publishedAt?.toISOString() || post.id,
  }))
}
