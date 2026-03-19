import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Clock, Calendar } from "lucide-react"
import { getBlogIndexData } from "@/lib/blog"
import { formatBlogDate } from "@/lib/blog-shared"
import type { BlogPostCard } from "@/lib/blog-model"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Journal | Turkish Rug House",
  description: "Editorial insights, stories, and knowledge from the world of handmade Turkish rugs.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Journal | Turkish Rug House",
    description: "Editorial insights, stories, and knowledge from the world of handmade Turkish rugs.",
    url: "/blog",
    type: "website",
  },
}

type Props = {
  searchParams?: Promise<{ q?: string; category?: string; tag?: string }>
}

function FeaturedPostCard({ post }: { post: BlogPostCard }) {
  const pubDate = new Date(post.publishDate as unknown as string | number | Date)
  return (
    <Link href={`/blog/${post.slug}`} className="group block">
      <article className="relative grid overflow-hidden rounded-[2rem] border border-[#dde6ef] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.07)] lg:grid-cols-[1.1fr_0.9fr] lg:min-h-[460px]">
        {/* Image */}
        <div className="relative min-h-[260px] overflow-hidden bg-[#eef3f7] lg:min-h-0">
          {post.coverImage ? (
            <Image
              src={post.coverImage.url}
              alt={post.coverImage.alt || post.title}
              fill
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              priority
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#e7efe7,transparent_55%),linear-gradient(135deg,#f7fafc,#eef2f7)]" />
          )}
          {post.category && (
            <div className="absolute left-5 top-5">
              <span className="inline-flex items-center rounded-full bg-white/95 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-[#0f766e] shadow-sm">
                {post.category.title}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-col justify-center p-8 md:p-10 lg:p-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#0f766e]">Featured Story</p>
          <h2 className="mt-4 font-serif text-3xl leading-[1.1] text-slate-900 group-hover:text-[#0f766e] transition-colors md:text-4xl">
            {post.title}
          </h2>
          {post.excerpt && (
            <p className="mt-4 line-clamp-4 text-[0.925rem] leading-7 text-slate-600">{post.excerpt}</p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {formatBlogDate(pubDate)}
            </span>
            {post.readTimeMinutes && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {post.readTimeMinutes} min read
              </span>
            )}
          </div>

          <div className="mt-7">
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors group-hover:bg-[#0f766e]">
              Read Article
              <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </article>
    </Link>
  )
}

function PostCard({ post }: { post: BlogPostCard }) {
  const pubDate = new Date(post.publishDate as unknown as string | number | Date)
  return (
    <Link href={`/blog/${post.slug}`} className="group block h-full">
      <article className="flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-[#dde6ef] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_16px_40px_rgba(15,23,42,0.1)]">
        <div className="relative aspect-[4/3] overflow-hidden bg-[#eef3f7]">
          {post.coverImage ? (
            <Image
              src={post.coverImage.url}
              alt={post.coverImage.alt || post.title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_top,#e7efe7,transparent_55%),linear-gradient(135deg,#f7fafc,#eef2f7)]">
              <span className="text-xs font-medium text-slate-400">Turkish Rug House Journal</span>
            </div>
          )}
          {post.category && (
            <div className="absolute left-4 top-4">
              <span className="inline-flex items-center rounded-full bg-white/95 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.25em] text-[#0f766e] shadow-sm">
                {post.category.title}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col p-6">
          <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            <span>{formatBlogDate(pubDate)}</span>
            {post.readTimeMinutes && (
              <>
                <span aria-hidden="true">·</span>
                <span>{post.readTimeMinutes} min</span>
              </>
            )}
          </div>

          <h3 className="mt-3 font-serif text-[1.3rem] leading-[1.2] text-slate-900 transition-colors group-hover:text-[#0f766e]">
            {post.title}
          </h3>
          {post.excerpt && (
            <p className="mt-3 line-clamp-2 flex-1 text-sm leading-6 text-slate-600">{post.excerpt}</p>
          )}

          <div className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-slate-900 group-hover:text-[#0f766e] transition-colors">
            Read More
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </article>
    </Link>
  )
}

export default async function BlogIndexPage({ searchParams }: Props) {
  const params = (await searchParams) || {}
  const q = (params.q || "").trim()
  const category = (params.category || "").trim()
  const tag = (params.tag || "").trim()

  const data = await getBlogIndexData({ query: q, category, tag })
  const { posts, featured, categories } = data

  // The featured post is not duplicated in the grid
  const gridPosts = featured ? posts.filter((p) => p.id !== featured.id) : posts

  return (
    <div className="bg-[#fcfdff]">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-slate-200/80">
        {/* Background texture */}
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#f8fbfd_0%,#f2f6fa_100%)]" />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, #e7f0ec 0%, transparent 50%),
                              radial-gradient(circle at 80% 20%, #e2edf6 0%, transparent 50%)`,
          }}
        />

        <div className="container relative mx-auto px-4 py-16 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-[#0f766e]">The Journal</p>
            <h1 className="mt-5 font-serif text-5xl leading-[1.0] text-slate-900 md:text-6xl lg:text-7xl">
              Stories of Craft,<br />
              <span className="text-[#0f766e]">Culture &amp; Colour</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-[1.0625rem] leading-7 text-slate-600">
              Editorial notes on Oushak rugs, Anatolian heritage, care &amp; styling from the world of handcrafted Turkish rugs.
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-12 md:py-16">
        {/* ── Featured Post ─────────────────────────────────────── */}
        {featured && !q && !category && !tag && (
          <div className="mb-14">
            <FeaturedPostCard post={featured} />
          </div>
        )}

        {/* ── Filter Bar ───────────────────────────────────────── */}
        <div className="mb-10 flex flex-col gap-4 rounded-2xl border border-[#dde6ef] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] md:flex-row md:items-center md:gap-6">
          <form method="get" action="/blog" className="flex flex-1 items-center gap-3">
            <input
              name="q"
              defaultValue={q}
              placeholder="Search articles…"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#0f766e]/50 focus:bg-white transition-colors"
            />
            {category && <input type="hidden" name="category" value={category} />}
            {tag && <input type="hidden" name="tag" value={tag} />}
            <button type="submit" className="h-10 shrink-0 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors">
              Search
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/blog"
              className={`rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] transition-colors ${
                !category && !q && !tag
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              All
            </Link>
            {categories.slice(0, 8).map((c) => (
              <Link
                key={c.slug}
                href={`/blog?${new URLSearchParams({ ...(q ? { q } : {}), category: c.slug }).toString()}`}
                className={`rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] transition-colors ${
                  category === c.slug
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {c.title}
              </Link>
            ))}
          </div>
        </div>

        {/* ── Active filter header ──────────────────────────────── */}
        {(q || category || tag) && (
          <div className="mb-8 flex items-center gap-3">
            <p className="text-sm text-slate-600">
              {gridPosts.length === 0 ? "No articles found" : `${gridPosts.length} article${gridPosts.length !== 1 ? "s" : ""} found`}
              {q ? ` for "${q}"` : ""}
              {category ? ` in ${category}` : ""}
            </p>
            <Link href="/blog" className="text-sm font-semibold text-[#0f766e] hover:underline">
              Clear filters
            </Link>
          </div>
        )}

        {/* ── Grid ─────────────────────────────────────────────── */}
        {gridPosts.length === 0 && !featured ? (
          <div className="rounded-[2rem] border border-dashed border-[#dce3ed] bg-white px-6 py-20 text-center shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#f0f6f7]">
              <span className="font-serif text-2xl text-[#0f766e]">𝕵</span>
            </div>
            <h3 className="font-serif text-3xl text-slate-900">
              {q || category || tag ? "No Articles Found" : "Journal Coming Soon"}
            </h3>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">
              {q || category || tag
                ? "Try a different search or browse all articles."
                : "Our editorial team is crafting the first stories. Check back soon."}
            </p>
            {(q || category || tag) && (
              <Link href="/blog" className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
                View all articles
              </Link>
            )}
          </div>
        ) : (
          <>
            {gridPosts.length > 0 && (
              <>
                <div className="mb-7 flex items-end justify-between gap-4 border-b border-slate-200 pb-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#0f766e]">From The Journal</p>
                    <h2 className="mt-2 font-serif text-3xl text-slate-900 md:text-4xl">Latest Articles</h2>
                  </div>
                  <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 hover:text-[#0f766e] transition-colors">
                    Shop Rugs
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {gridPosts.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* ── Collection CTA ───────────────────────────────────── */}
        <div className="mt-16 overflow-hidden rounded-[2rem] border border-[#dde6ef] bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="grid lg:grid-cols-[1fr_auto]">
            <div className="p-8 md:p-10">
              <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#0f766e]">Curated Collections</p>
              <h3 className="mt-3 font-serif text-3xl text-slate-900 md:text-4xl">
                Explore our most collected rugs
              </h3>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                Editorial stories lead to real pieces. Browse curated collections and find a rug that feels unmistakably yours.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/collections/vintage-rugs" className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e] transition-colors">
                  Vintage Rugs
                </Link>
                <Link href="/collections/oushak-rugs" className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition-colors">
                  Oushak Rugs
                </Link>
                <Link href="/collections/turkish-rugs" className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition-colors">
                  Turkish Rugs
                </Link>
              </div>
            </div>
            <div className="hidden lg:flex lg:items-center lg:pr-10">
              <div className="grid gap-3">
                {[2, 3, 4].map((n) => (
                  <div key={n} className="h-2 rounded-full bg-[#e7f0ec]" style={{ width: `${60 + n * 12}px` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
