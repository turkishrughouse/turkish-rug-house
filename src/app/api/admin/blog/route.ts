import { NextRequest, NextResponse } from "next/server"
import { revalidatePath, revalidateTag } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { BLOG_STATUSES, buildPublishedAt, ensureUniqueBlogSlug, getAdminBlogPosts } from "@/lib/blog"
import { getSessionUser } from "@/lib/auth-server"
import { isAdminRole } from "@/lib/rbac"

const blogCreateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().optional().nullable(),
  excerpt: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
  featuredImage: z.string().optional().nullable(),
  status: z.enum(BLOG_STATUSES).default("DRAFT"),
  publishedAt: z.string().optional().nullable(),
  metaTitle: z.string().optional().nullable(),
  metaDescription: z.string().optional().nullable(),
})

function revalidateBlogPaths(slug?: string | null) {
  revalidateTag("blog-posts", "default")
  revalidatePath("/")
  revalidatePath("/blog")
  if (slug) revalidatePath(`/blog/${slug}`)
  revalidatePath("/dashboard/blog")
}

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser("admin")
    if (!user || !isAdminRole(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { searchParams } = new URL(req.url)
    const page = Number(searchParams.get("page") || "1")
    const limit = Number(searchParams.get("limit") || "20")
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status") || "ALL"
    const result = await getAdminBlogPosts({ page, limit, search, status })
    return NextResponse.json({ data: result.posts, meta: result.metadata })
  } catch (error) {
    console.error("[admin-blog] failed to fetch posts", error)
    return NextResponse.json({ error: "Failed to fetch blog posts" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser("admin")
    if (!user || !isAdminRole(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const body = await req.json()
    const parsed = blogCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid blog post data", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data
    const slug = await ensureUniqueBlogSlug(data.slug?.trim() || data.title)
    const publishedAt = buildPublishedAt(
      data.status,
      data.publishedAt ? new Date(data.publishedAt) : null
    )

    const created = await prisma.blogPost.create({
      data: {
        title: data.title.trim(),
        slug,
        excerpt: data.excerpt?.trim() || null,
        content: data.content || null,
        featuredImage: data.featuredImage?.trim() || null,
        status: data.status,
        publishedAt,
        metaTitle: data.metaTitle?.trim() || null,
        metaDescription: data.metaDescription?.trim() || null,
      },
    })

    revalidateBlogPaths(created.slug)
    return NextResponse.json({ id: created.id, slug: created.slug }, { status: 201 })
  } catch (error) {
    console.error("[admin-blog] failed to create post", error)
    return NextResponse.json({ error: "Failed to create blog post" }, { status: 500 })
  }
}
