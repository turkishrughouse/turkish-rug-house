import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import type { BlogCardItem } from "@/lib/blog-shared"
import { formatBlogDate } from "@/lib/blog-shared"

export function BlogCard({ post }: { post: BlogCardItem }) {
  return (
    <article className="group overflow-hidden rounded-[26px] border border-[#dde6ef] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition-transform duration-300 hover:-translate-y-1">
      <Link href={`/blog/${post.slug}`} className="block">
        <div className="aspect-[4/3] overflow-hidden bg-[#eef3f7]">
          {post.featuredImage ? (
            <Image
              src={post.featuredImage}
              alt={post.title}
              width={800}
              height={600}
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,#e7efe7,transparent_55%),linear-gradient(135deg,#f7fafc,#eef2f7)] text-sm font-medium text-slate-400">
              Turkish Rug House Journal
            </div>
          )}
        </div>
      </Link>

      <div className="space-y-4 p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0f766e]">
          {formatBlogDate(post.publishedAt)}
        </p>
        <div>
          <Link href={`/blog/${post.slug}`}>
            <h3 className="font-serif text-[1.4rem] leading-[1.15] text-slate-900 transition-colors group-hover:text-[#0f766e]">
              {post.title}
            </h3>
          </Link>
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
            {post.excerpt}
          </p>
        </div>
        <Link href={`/blog/${post.slug}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 transition-colors hover:text-[#0f766e]">
          Read More
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  )
}
