import { Suspense } from "react"
import { BlogList } from "@/components/admin/blog/blog-list"
import { getAdminBlogPosts } from "@/lib/blog"

export default async function BlogDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const search = (params.search as string) || ""
  const status = (params.status as string) || "ALL"
  const limit = 20
  const { posts, metadata } = await getAdminBlogPosts({ page, limit, search, status })

  return (
    <div className="flex-1 space-y-8 p-4 pt-5 sm:p-6 xl:p-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Blog</h2>
        <p className="text-slate-600">
          Manage editorial articles for the storefront journal and homepage article preview.
        </p>
      </div>

      <div className="h-px bg-border-subtle" />

      <Suspense fallback={<div>Loading blog posts...</div>}>
        <BlogList initialPosts={posts} metadata={metadata} />
      </Suspense>
    </div>
  )
}
