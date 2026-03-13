import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { BLOG_STATUSES, buildPublishedAt, ensureUniqueBlogSlug } from "@/lib/blog"
import { getSessionUser } from "@/lib/auth"
import { isAdminRole } from "@/lib/rbac"

const blogUpdateSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  slug: z.string().min(1, "Slug is required").optional().nullable(),
  excerpt: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
  featuredImage: z.string().optional().nullable(),
  status: z.enum(BLOG_STATUSES).optional(),
  publishedAt: z.string().optional().nullable(),
  metaTitle: z.string().optional().nullable(),
  metaDescription: z.string().optional().nullable(),
})

function revalidateBlogPaths(slug?: string | null) {
  revalidatePath("/")
  revalidatePath("/blog")
  if (slug) revalidatePath(`/blog/${slug}`)
  revalidatePath("/dashboard/blog")
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser("admin")
    if (!user || !isAdminRole(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { id } = await params
    const post = await prisma.blogPost.findUnique({ where: { id } })
    if (!post) {
      return NextResponse.json({ error: "Blog post not found" }, { status: 404 })
    }
    return NextResponse.json(post)
  } catch (error) {
    console.error("[admin-blog] failed to fetch post", error)
    return NextResponse.json({ error: "Failed to fetch blog post" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser("admin")
    if (!user || !isAdminRole(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { id } = await params
    const existing = await prisma.blogPost.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Blog post not found" }, { status: 404 })
    }

    const body = await req.json()
    const parsed = blogUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid blog post data", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data
    const status = data.status || (existing.status as "DRAFT" | "PUBLISHED")
    const slug = data.slug || data.title ? await ensureUniqueBlogSlug((data.slug || data.title || existing.title)!, id) : existing.slug
    const publishedAt = buildPublishedAt(
      status,
      data.publishedAt ? new Date(data.publishedAt) : existing.publishedAt,
      existing.publishedAt
    )

    const updated = await prisma.blogPost.update({
      where: { id },
      data: {
        title: data.title?.trim(),
        slug,
        excerpt: data.excerpt === undefined ? undefined : data.excerpt?.trim() || null,
        content: data.content === undefined ? undefined : data.content || null,
        featuredImage: data.featuredImage === undefined ? undefined : data.featuredImage?.trim() || null,
        status,
        publishedAt,
        metaTitle: data.metaTitle === undefined ? undefined : data.metaTitle?.trim() || null,
        metaDescription: data.metaDescription === undefined ? undefined : data.metaDescription?.trim() || null,
      },
    })

    revalidateBlogPaths(existing.slug)
    if (updated.slug !== existing.slug) revalidateBlogPaths(updated.slug)
    return NextResponse.json(updated)
  } catch (error) {
    console.error("[admin-blog] failed to update post", error)
    return NextResponse.json({ error: "Failed to update blog post" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser("admin")
    if (!user || !isAdminRole(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { id } = await params
    const existing = await prisma.blogPost.findUnique({ where: { id }, select: { slug: true } })
    if (!existing) {
      return NextResponse.json({ success: true, deleted: 0 })
    }

    await prisma.blogPost.delete({ where: { id } })
    revalidateBlogPaths(existing.slug)
    return NextResponse.json({ success: true, deleted: 1 })
  } catch (error) {
    console.error("[admin-blog] failed to delete post", error)
    return NextResponse.json({ error: "Failed to delete blog post" }, { status: 500 })
  }
}
