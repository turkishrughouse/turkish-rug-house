import Link from "next/link"
import { ArrowRight } from "lucide-react"
import type { BlogCardItem } from "@/lib/blog"
import { BlogCard } from "@/components/storefront/blog-card"

export function HomeBlogSection({ posts }: { posts: BlogCardItem[] }) {
  if (posts.length === 0) return null

  return (
    <section className="container mx-auto px-4 py-12">
      <div className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#0f766e]">Journal</p>
          <h2 className="mt-3 font-serif text-4xl leading-none text-slate-900">From Our Journal</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Insights, stories, and knowledge from the world of handmade Turkish rugs.
          </p>
        </div>
        <Link href="/blog" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 hover:text-[#0f766e]">
          View All Articles
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {posts.map((post) => (
          <BlogCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  )
}
