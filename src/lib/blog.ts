import { unstable_cache } from "next/cache"
import { Prisma, type BlogPost } from "@prisma/client"
import { prisma } from "@/lib/db"
import type { BlogCardItem, BlogListItem, BlogStatus } from "@/lib/blog-shared"
import { normalizeBlogExcerpt, stripBlogHtml } from "@/lib/blog-shared"
import type { BlogContentBlock, BlogIndexData, BlogPostCard, BlogPostPublic } from "@/lib/blog-model"
import { blogSlugifyAnchor } from "@/lib/blog-model"
import { MOCK_BLOG_POSTS } from "@/lib/blog-mock"

export const BLOG_STATUSES = ["DRAFT", "PUBLISHED"] as const

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

type BlogExtraColumns = {
  featuredImageAlt: string | null
  author: string | null
  category: string | null
  tagsJson: string | null
  readTimeMinutes: number | null
  isFeatured: number | null
  contentBlocksJson: string | null
}

async function getBlogTableColumns() {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("BlogPost")`)
    return new Set(rows.map((row) => row.name))
  } catch {
    return new Set<string>()
  }
}

async function readBlogExtrasById(id: string): Promise<BlogExtraColumns> {
  const columns = await getBlogTableColumns()
  const selectParts = [
    columns.has("featuredImageAlt") ? `"featuredImageAlt"` : `NULL AS "featuredImageAlt"`,
    columns.has("author") ? `"author"` : `NULL AS "author"`,
    columns.has("category") ? `"category"` : `NULL AS "category"`,
    columns.has("tags") ? `"tags"` : `NULL AS "tagsJson"`,
    columns.has("readTimeMinutes") ? `"readTimeMinutes"` : `NULL AS "readTimeMinutes"`,
    columns.has("isFeatured") ? `"isFeatured"` : `NULL AS "isFeatured"`,
    columns.has("contentBlocks") ? `"contentBlocks"` : `NULL AS "contentBlocksJson"`,
  ]

  try {
    const rows = await prisma.$queryRawUnsafe<Array<BlogExtraColumns>>(
      `SELECT ${selectParts.join(", ")} FROM "BlogPost" WHERE "id" = ? LIMIT 1`,
      id
    )
    return (
      rows[0] || {
        featuredImageAlt: null,
        author: null,
        category: null,
        tagsJson: null,
        readTimeMinutes: null,
        isFeatured: null,
        contentBlocksJson: null,
      }
    )
  } catch {
    return {
      featuredImageAlt: null,
      author: null,
      category: null,
      tagsJson: null,
      readTimeMinutes: null,
      isFeatured: null,
      contentBlocksJson: null,
    }
  }
}

function safeParseJsonArray<T>(raw: string | null | undefined): T[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function normalizeBlocks(input: unknown, fallbackHtml: string) {
  const blocks = Array.isArray(input) ? (input as BlogContentBlock[]) : []
  const normalized = blocks.filter((block) => Boolean(block && typeof block === "object" && "type" in (block as any)))
  if (normalized.length > 0) return normalized

  const html = (fallbackHtml || "").trim()
  if (!html) return []
  return [{ id: "legacy-richtext", type: "richText", html }] satisfies BlogContentBlock[]
}

function buildReadTimeMinutes(excerpt: string, html: string, explicit: number | null) {
  if (explicit && Number.isFinite(explicit) && explicit > 0) return Math.round(explicit)
  const plain = stripBlogHtml(`${excerpt || ""} ${html || ""}`)
  const words = plain.split(/\s+/).filter(Boolean).length
  if (words <= 0) return null
  return Math.max(3, Math.round(words / 220))
}

function toPublicFromLegacy(post: BlogListItem, extras: BlogExtraColumns): BlogPostPublic {
  const tags = safeParseJsonArray<string>(extras.tagsJson).filter((t) => typeof t === "string").map((t) => t.trim()).filter(Boolean)
  const coverAlt = (extras.featuredImageAlt || post.title).trim()
  const blocks = normalizeBlocks(safeParseJsonArray(extras.contentBlocksJson), post.content || "")

  const readTimeMinutes = buildReadTimeMinutes(post.excerpt, post.content || "", extras.readTimeMinutes)

  // Ensure heading anchors exist for TOC + in-page links.
  const anchoredBlocks = blocks.map((block) => {
    if (block.type !== "heading") return block
    const anchor = (block.anchor || blogSlugifyAnchor(block.text)).trim()
    return { ...block, anchor }
  })

  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    coverImage: post.featuredImage ? { url: post.featuredImage, alt: coverAlt } : null,
    author: extras.author ? { name: extras.author.trim() } : null,
    publishDate: post.publishedAt || post.createdAt,
    readTimeMinutes,
    category: extras.category ? { slug: slugifyBlogTitle(extras.category), title: extras.category.trim() } : null,
    tags,
    isFeatured: Boolean(extras.isFeatured ?? 0),
    seo: { metaTitle: post.metaTitle, metaDescription: post.metaDescription },
    blocks: anchoredBlocks,
    updatedAt: post.updatedAt,
  }
}

async function readPublishedBlogPosts(limit: number): Promise<BlogCardItem[]> {
  const posts = await prisma.blogPost.findMany({
    where: publishedWhere(),
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
  })

  return posts.map((post) => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: normalizeBlogExcerpt(post.excerpt),
    featuredImage: post.featuredImage || null,
    publishedAt: post.publishedAt?.toISOString() || post.createdAt.toISOString(),
  }))
}

export const stripHtml = stripBlogHtml

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
    excerpt: normalizeBlogExcerpt(post.excerpt),
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
  const getCachedPosts = unstable_cache(() => readPublishedBlogPosts(limit), [`blog-published-${limit}`], {
    revalidate: 300,
    tags: ["blog-posts"],
  })
  return getCachedPosts()
}

export async function getAllPublishedBlogPosts() {
  const getCachedPosts = unstable_cache(async () => {
    const posts = await prisma.blogPost.findMany({
      where: publishedWhere(),
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    })
    return posts.map(toListItem)
  }, ["blog-all-published"], {
    revalidate: 300,
    tags: ["blog-posts"],
  })
  return getCachedPosts()
}

export async function getPublishedBlogPostBySlug(slug: string) {
  const getCachedPost = unstable_cache(async () => {
    const post = await prisma.blogPost.findFirst({
      where: {
        slug,
        ...publishedWhere(),
      },
    })
    return post ? toListItem(post) : null
  }, [`blog-post-${slug}`], {
    revalidate: 300,
    tags: ["blog-posts", `blog-post-${slug}`],
  })
  return getCachedPost()
}

export async function getPublishedBlogPostPublicBySlug(slug: string) {
  const getCachedPost = unstable_cache(async () => {
    const post = await prisma.blogPost.findFirst({
      where: { slug, ...publishedWhere() },
    })
    if (!post) {
      const mock = MOCK_BLOG_POSTS.find((p) => p.slug === slug)
      return mock || null
    }
    const listItem = toListItem(post)
    const extras = await readBlogExtrasById(post.id)
    return toPublicFromLegacy(listItem, extras)
  }, [`blog-public-${slug}`], {
    revalidate: 300,
    tags: ["blog-posts", `blog-post-${slug}`],
  })
  return getCachedPost()
}

export async function getBlogIndexData(input?: { query?: string; category?: string; tag?: string }): Promise<BlogIndexData> {
  const query = (input?.query || "").trim()
  const category = (input?.category || "").trim()
  const tag = (input?.tag || "").trim()

  const cacheKey = `blog-index-${query || "all"}-${category || "all"}-${tag || "all"}`
  const getCached = unstable_cache(async () => {
    const posts = await prisma.blogPost.findMany({
      where: {
        ...publishedWhere(),
        ...(query
          ? {
              OR: [
                { title: { contains: query } },
                { excerpt: { contains: query } },
                { content: { contains: query } },
              ],
            }
          : {}),
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    })

    if (posts.length === 0) {
      const querySlug = slugifyBlogTitle(query)
      const categorySlug = slugifyBlogTitle(category)
      const mockFiltered = MOCK_BLOG_POSTS.filter((p) => {
        if (querySlug && !`${p.title} ${p.excerpt}`.toLowerCase().includes(query.toLowerCase())) return false
        if (categorySlug && p.category?.slug !== categorySlug) return false
        if (tag && !p.tags.includes(tag)) return false
        return true
      })

      const featured = mockFiltered.find((p) => p.isFeatured) || mockFiltered[0] || null
      const categories = new Map<string, { slug: string; title: string }>()
      const tagSet = new Set<string>()
      for (const p of MOCK_BLOG_POSTS) {
        if (p.category) categories.set(p.category.slug, p.category)
        p.tags.forEach((t) => tagSet.add(t))
      }

      const toCard = (p: BlogPostPublic): BlogPostCard => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        coverImage: p.coverImage,
        publishDate: p.publishDate,
        readTimeMinutes: p.readTimeMinutes,
        category: p.category,
      })

      return {
        posts: mockFiltered.map(toCard),
        featured: featured ? toCard(featured) : null,
        categories: Array.from(categories.values()).sort((a, b) => a.title.localeCompare(b.title)),
        tags: Array.from(tagSet.values()).sort((a, b) => a.localeCompare(b)),
      } satisfies BlogIndexData
    }

    const list = posts.map(toListItem)
    const extras = await Promise.all(list.map((p) => readBlogExtrasById(p.id)))
    const publicPosts = list.map((p, idx) => toPublicFromLegacy(p, extras[idx]))

    const categories = new Map<string, { slug: string; title: string }>()
    const tagSet = new Set<string>()

    for (const p of publicPosts) {
      if (p.category) categories.set(p.category.slug, p.category)
      p.tags.forEach((t) => tagSet.add(t))
    }

    const filtered = publicPosts.filter((p) => {
      if (category && (!p.category || p.category.slug !== slugifyBlogTitle(category))) return false
      if (tag && !p.tags.includes(tag)) return false
      return true
    })

    const featured = filtered.find((p) => p.isFeatured) || filtered[0] || null

    const toCard = (p: BlogPostPublic): BlogPostCard => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      coverImage: p.coverImage,
      publishDate: p.publishDate,
      readTimeMinutes: p.readTimeMinutes,
      category: p.category,
    })

    return {
      posts: filtered.map(toCard),
      featured: featured ? toCard(featured) : null,
      categories: Array.from(categories.values()).sort((a, b) => a.title.localeCompare(b.title)),
      tags: Array.from(tagSet.values()).sort((a, b) => a.localeCompare(b)),
    } satisfies BlogIndexData
  }, [cacheKey], { revalidate: 300, tags: ["blog-posts"] })

  return getCached()
}

export async function getLatestPublishedBlogPosts(excludeSlug?: string, limit = 3) {
  const cacheKey = excludeSlug ? `blog-latest-${excludeSlug}-${limit}` : `blog-latest-${limit}`
  const getCachedPosts = unstable_cache(async () => {
    const posts = await prisma.blogPost.findMany({
      where: {
        ...publishedWhere(),
        ...(excludeSlug ? { slug: { not: excludeSlug } } : {}),
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: limit,
    })
    return posts.map(toListItem)
  }, [cacheKey], {
    revalidate: 300,
    tags: ["blog-posts"],
  })
  return getCachedPosts()
}

export async function getRelatedPublishedBlogPosts(input: {
  currentSlug: string
  categorySlug?: string | null
  tags?: string[]
  limit?: number
  manualIds?: string[] | null
}) {
  const limit = Math.max(1, Math.min(6, input.limit ?? 3))
  const manualIds = (input.manualIds || []).filter(Boolean)

  if (manualIds.length > 0) {
    const posts = await prisma.blogPost.findMany({
      where: { id: { in: manualIds }, ...publishedWhere() },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: limit,
    })
    return posts.map(toListItem)
  }

  // “Auto” related: rank by category + tag overlap, then fallback.
  const candidates = await prisma.blogPost.findMany({
    where: {
      ...publishedWhere(),
      slug: { not: input.currentSlug },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 40,
  })
  const list = candidates.map(toListItem)
  const extras = await Promise.all(list.map((p) => readBlogExtrasById(p.id)))
  const publicPosts = list.map((p, idx) => toPublicFromLegacy(p, extras[idx]))

  const ranked = publicPosts
    .map((p) => {
      let score = 0
      if (input.categorySlug && p.category?.slug === input.categorySlug) score += 5
      const tagOverlap = (input.tags || []).filter((t) => p.tags.includes(t)).length
      score += Math.min(4, tagOverlap)
      return { p, score }
    })
    .sort((a, b) => b.score - a.score)
    .filter((row) => row.score > 0)
    .slice(0, limit)
    .map((row) => row.p.id)

  if (ranked.length > 0) {
    const posts = await prisma.blogPost.findMany({
      where: { id: { in: ranked }, ...publishedWhere() },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: limit,
    })
    return posts.map(toListItem)
  }

  // Fallback: latest posts.
  return await getLatestPublishedBlogPosts(input.currentSlug, limit)
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
