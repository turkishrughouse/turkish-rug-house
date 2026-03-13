import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { BlogCard } from "@/components/storefront/blog-card"
import { getAllPublishedBlogPosts } from "@/lib/blog"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Journal | Turkish Rug House",
  description: "Editorial insights, stories, and knowledge from the world of handmade Turkish rugs.",
  alternates: {
    canonical: "/blog",
  },
  openGraph: {
    title: "Journal | Turkish Rug House",
    description: "Editorial insights, stories, and knowledge from the world of handmade Turkish rugs.",
    url: "/blog",
    type: "website",
  },
}

export default async function BlogIndexPage() {
  const posts = await getAllPublishedBlogPosts()

  return (
    <div className="bg-[#fcfdff]">
      <section className="border-b border-slate-200/80 bg-[linear-gradient(180deg,#f8fbfd_0%,#f5f8fb_100%)]">
        <div className="container mx-auto grid gap-10 px-4 py-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)] lg:items-center lg:py-20">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#0f766e]">Journal</p>
            <h1 className="mt-4 max-w-3xl font-serif text-4xl leading-[0.98] text-slate-900 md:text-5xl">
              Stories, guidance, and collecting insight from the world of handmade Turkish rugs.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
              Explore editorial notes on Oushak rugs, Anatolian craft, care, styling, and the details that make one-of-a-kind pieces worth collecting.
            </p>
          </div>

          <div className="overflow-hidden rounded-[30px] border border-[#dde6ef] bg-[radial-gradient(circle_at_top,#e7efe7,transparent_52%),linear-gradient(135deg,#f8fafc,#eef3f7)] p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <div className="grid gap-4 sm:grid-cols-3">
              {posts.slice(0, 3).map((post, index) => (
                <div
                  key={post.id}
                  className={`rounded-[22px] border border-white/70 bg-white/80 p-4 backdrop-blur ${index === 0 ? "sm:col-span-2" : ""}`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0f766e]">
                    {new Date(post.publishedAt || post.createdAt).getFullYear()}
                  </p>
                  <h2 className="mt-3 font-serif text-2xl leading-tight text-slate-900">{post.title}</h2>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{post.excerpt}</p>
                </div>
              ))}
              {posts.length === 0 ? (
                <div className="sm:col-span-3 rounded-[22px] border border-white/70 bg-white/80 p-6 text-sm text-slate-600">
                  Published articles will appear here as soon as the editorial team adds them from the admin panel.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-12 md:py-16">
        <div className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#0f766e]">From Our Journal</p>
            <h2 className="mt-3 font-serif text-3xl text-slate-900 md:text-4xl">Latest Articles</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Newest first, always grounded in the handmade history and design culture behind each piece.
            </p>
          </div>
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 hover:text-[#0f766e]">
            Continue Shopping
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {posts.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-[#dce3ed] bg-white px-6 py-16 text-center shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <h3 className="font-serif text-3xl text-slate-900">No journal articles published yet</h3>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
              Once articles are published from the admin panel, they will appear here automatically and the latest four will also appear on the homepage.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {posts.map((post) => (
              <BlogCard
                key={post.id}
                post={{
                  id: post.id,
                  title: post.title,
                  slug: post.slug,
                  excerpt: post.excerpt,
                  featuredImage: post.featuredImage,
                  publishedAt: (post.publishedAt || post.createdAt).toISOString(),
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
