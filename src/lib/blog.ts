import { Prisma, type BlogPost } from "@prisma/client"
import { prisma } from "@/lib/db"

export const BLOG_STATUSES = ["DRAFT", "PUBLISHED"] as const
export type BlogStatus = (typeof BLOG_STATUSES)[number]

export type BlogCardItem = {
  id: string
  title: string
  slug: string
  excerpt: string
  featuredImage: string | null
  publishedAt: string
}

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

export type BlogPostDetail = BlogListItem

export type AdminBlogListResult = {
  posts: BlogListItem[]
  metadata: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export type BlogInput = {
  title: string
  slug?: string | null
  excerpt?: string | null
  content?: string | null
  featuredImage?: string | null
  status: BlogStatus
  publishedAt?: Date | null
  metaTitle?: string | null
  metaDescription?: string | null
}

function normalizeExcerpt(value: string | null | undefined) {
  const clean = (value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
  if (!clean) return "Discover editorial stories and insights from the world of handmade Turkish rugs."
  return clean
}

export function stripHtml(input: string | null | undefined) {
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

export function slugifyBlogTitle(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export async function ensureUniqueBlogSlug(baseInput: string, excludeId?: string) {
  const base = slugifyBlogTitle(baseInput) || "journal-entry"
  let candidate = base
  let attempt = 1

  while (true) {
    const existing = await prisma.blogPost.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })
    if (!existing || existing.id === excludeId) return candidate
    attempt += 1
    candidate = `${base}-${attempt}`
  }
}

function toListItem(post: BlogPost): BlogListItem {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: normalizeExcerpt(post.excerpt),
    content: post.content || "",
    featuredImage: post.featuredImage || null,
    status: post.status as BlogStatus,
    publishedAt: post.publishedAt,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    metaTitle: post.metaTitle || null,
    metaDescription: post.metaDescription || null,
  }
}

function publishedWhere(): Prisma.BlogPostWhereInput {
  return {
    status: "PUBLISHED",
    publishedAt: { not: null, lte: new Date() },
  }
}

export async function getPublishedBlogPosts(limit = 4): Promise<BlogCardItem[]> {
  const posts = await prisma.blogPost.findMany({
    where: publishedWhere(),
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
  })

  return posts.map((post) => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: normalizeExcerpt(post.excerpt),
    featuredImage: post.featuredImage || null,
    publishedAt: post.publishedAt?.toISOString() || post.createdAt.toISOString(),
  }))
}

export async function getAllPublishedBlogPosts() {
  const posts = await prisma.blogPost.findMany({
    where: publishedWhere(),
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  })
  return posts.map(toListItem)
}

export async function getPublishedBlogPostBySlug(slug: string) {
  const post = await prisma.blogPost.findFirst({
    where: {
      slug,
      ...publishedWhere(),
    },
  })
  return post ? toListItem(post) : null
}

export async function getLatestPublishedBlogPosts(excludeSlug?: string, limit = 3) {
  const posts = await prisma.blogPost.findMany({
    where: {
      ...publishedWhere(),
      ...(excludeSlug ? { slug: { not: excludeSlug } } : {}),
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
  })
  return posts.map(toListItem)
}

export async function getAdminBlogPosts(input: {
  page: number
  limit: number
  search?: string
  status?: string
}): Promise<AdminBlogListResult> {
  const skip = (input.page - 1) * input.limit
  const where: Prisma.BlogPostWhereInput = {}

  if (input.status && input.status !== "ALL") {
    where.status = input.status
  }

  const search = (input.search || "").trim()
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { slug: { contains: search } },
      { excerpt: { contains: search } },
    ]
  }

  const [posts, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      skip,
      take: input.limit,
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.blogPost.count({ where }),
  ])

  return {
    posts: posts.map(toListItem),
    metadata: {
      total,
      page: input.page,
      limit: input.limit,
      totalPages: Math.max(1, Math.ceil(total / input.limit)),
    },
  }
}

export async function getBlogPostById(id: string) {
  const post = await prisma.blogPost.findUnique({ where: { id } })
  return post ? toListItem(post) : null
}

export function buildPublishedAt(status: BlogStatus, raw: Date | null | undefined, fallback?: Date | null) {
  if (status !== "PUBLISHED") return null
  return raw || fallback || new Date()
}
