import { notFound } from "next/navigation"
import { BlogForm } from "@/components/admin/blog/blog-form"
import { getBlogPostById } from "@/lib/blog"

export default async function EditBlogPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const post = await getBlogPostById(id)

  if (!post) notFound()

  return (
    <div className="flex-1 space-y-4 p-4 pt-5 sm:p-6 xl:p-8">
      <BlogForm initialData={post} />
    </div>
  )
}
