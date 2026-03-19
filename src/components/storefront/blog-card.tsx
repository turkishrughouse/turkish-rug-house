import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import type { BlogCardItem } from "@/lib/blog-shared"
import { formatBlogDate } from "@/lib/blog-shared"

export function BlogCard({
  post,
}: {
  post: BlogCardItem & { category?: string | null; readTimeMinutes?: number | null }
}) {
  return (
    <Link href={`/blog/${post.slug}`} className="group block h-full">
      <article className="flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-[#dde6ef] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_16px_40px_rgba(15,23,42,0.1)]">
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden bg-[#eef3f7]">
          {post.featuredImage ? (
            <Image
              src={post.featuredImage}
              alt={post.title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_top,#e7efe7,transparent_55%),linear-gradient(135deg,#f7fafc,#eef2f7)]">
              <span className="font-serif text-sm text-slate-400">Turkish Rug House</span>
            </div>
          )}
          {post.category && (
            <div className="absolute left-4 top-4">
              <span className="inline-flex items-center rounded-full bg-white/95 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.25em] text-[#0f766e] shadow-sm">
                {post.category}
              </span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col p-6">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            {formatBlogDate(post.publishedAt)}
            {post.readTimeMinutes ? (
              <span> &middot; {post.readTimeMinutes} min read</span>
            ) : null}
          </div>

          <h3 className="mt-3 font-serif text-[1.3rem] leading-[1.2] text-slate-900 transition-colors group-hover:text-[#0f766e]">
            {post.title}
          </h3>

          {post.excerpt && (
            <p className="mt-3 line-clamp-2 flex-1 text-sm leading-6 text-slate-600">{post.excerpt}</p>
          )}

          <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 transition-colors group-hover:text-[#0f766e]">
            Read More
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </article>
    </Link>
  )
}
