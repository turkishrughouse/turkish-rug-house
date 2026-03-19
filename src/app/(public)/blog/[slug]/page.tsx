import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowRight, Calendar, Clock, User } from "lucide-react"
import { getPublishedBlogPostPublicBySlug, getRelatedPublishedBlogPosts } from "@/lib/blog"
import { formatBlogDate, stripBlogHtml } from "@/lib/blog-shared"
import { getSiteUrl, toAbsoluteSiteUrl } from "@/lib/site-url"
import { extractToc } from "@/lib/blog-model"
import { BlogTableOfContents } from "@/components/storefront/blog/toc"
import { BlogArticleBlocks } from "@/components/storefront/blog/article-blocks"

type Props = {
  params: Promise<{ slug: string }>
}

function buildBlogMetaDescription(
  post: NonNullable<Awaited<ReturnType<typeof getPublishedBlogPostPublicBySlug>>>
) {
  const fallbackBody = post.blocks.map((b) => ("html" in b ? (b as { html?: string }).html ?? "" : "")).join(" ")
  const clean = post.seo.metaDescription?.trim() || stripBlogHtml(post.excerpt || fallbackBody || "")
  return clean.slice(0, 160) || "Editorial insights from Turkish Rug House."
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = await getPublishedBlogPostPublicBySlug(slug)
  if (!post) return { title: "Article Not Found" }

  const title = post.seo.metaTitle?.trim() || `${post.title} | Turkish Rug House`
  const description = buildBlogMetaDescription(post)

  return {
    title,
    description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      title,
      description,
      type: "article",
      url: `/blog/${slug}`,
      publishedTime: new Date(post.publishDate as unknown as string | number | Date).toISOString(),
      images: post.coverImage ? [{ url: toAbsoluteSiteUrl(post.coverImage.url), alt: post.coverImage.alt }] : [],
    },
    twitter: {
      card: post.coverImage ? "summary_large_image" : "summary",
      title,
      description,
      images: post.coverImage ? [toAbsoluteSiteUrl(post.coverImage.url)] : [],
    },
  }
}

export default async function BlogDetailPage({ params }: Props) {
  const { slug } = await params
  const post = await getPublishedBlogPostPublicBySlug(slug)
  if (!post) notFound()

  const toc = extractToc(post.blocks)
  const relatedRaw = await getRelatedPublishedBlogPosts({
    currentSlug: slug,
    categorySlug: post.category?.slug ?? null,
    tags: post.tags,
    limit: 3,
  })


  const related = relatedRaw.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt,
    featuredImage: p.featuredImage,
    publishedAt: (p.publishedAt || p.createdAt).toISOString(),
    category: (p as { category?: string | null }).category ?? null,
    readTimeMinutes: (p as { readTimeMinutes?: number | null }).readTimeMinutes ?? null,
  }))

  const pubDate = new Date(post.publishDate as unknown as string | number | Date)

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: buildBlogMetaDescription(post),
    datePublished: pubDate.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    image: post.coverImage ? [toAbsoluteSiteUrl(post.coverImage.url)] : [],
    mainEntityOfPage: `${getSiteUrl()}/blog/${post.slug}`,
    author: { "@type": "Organization", name: post.author?.name || "Turkish Rug House" },
    publisher: { "@type": "Organization", name: "Turkish Rug House" },
  }

  return (
    <div className="bg-[#fcfdff]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />

      {/* ── Article Header / Hero ───────────────────────────────────── */}
      <header className="relative overflow-hidden border-b border-slate-200/60">
        <div className="absolute inset-0 bg-[linear-gradient(160deg,#f8fbfd_0%,#f2f6fa_100%)]" />
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage: "radial-gradient(circle at 15% 50%, #e7f0ec 0%, transparent 45%), radial-gradient(circle at 85% 20%, #e2edf6 0%, transparent 45%)",
          }}
        />

        <div className="container relative mx-auto px-4 py-12 md:py-16">
          {/* Breadcrumb */}
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-[#0f766e]"
          >
            <ArrowLeft className="h-4 w-4" />
            Journal
          </Link>

          <div className="mx-auto mt-6 max-w-3xl">
            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-bold uppercase tracking-[0.3em]">
              {post.category && (
                <Link
                  href={`/blog?${new URLSearchParams({ category: post.category.slug }).toString()}`}
                  className="text-[#0f766e] hover:underline"
                >
                  {post.category.title}
                </Link>
              )}
              {post.category && <span className="text-slate-300" aria-hidden="true">/</span>}
              <span className="inline-flex items-center gap-1.5 text-slate-500 font-semibold">
                <Calendar className="h-3.5 w-3.5" />
                {formatBlogDate(pubDate)}
              </span>
              {post.readTimeMinutes && (
                <>
                  <span className="text-slate-300" aria-hidden="true">/</span>
                  <span className="inline-flex items-center gap-1.5 text-slate-500 font-semibold">
                    <Clock className="h-3.5 w-3.5" />
                    {post.readTimeMinutes} min read
                  </span>
                </>
              )}
              {post.author?.name && (
                <>
                  <span className="text-slate-300" aria-hidden="true">/</span>
                  <span className="inline-flex items-center gap-1.5 text-slate-500 font-semibold">
                    <User className="h-3.5 w-3.5" />
                    {post.author.name}
                  </span>
                </>
              )}
            </div>

            {/* Title */}
            <h1 className="mt-5 font-serif text-4xl leading-[1.05] text-slate-900 md:text-5xl lg:text-6xl">
              {post.title}
            </h1>

            {/* Excerpt */}
            {post.excerpt && (
              <p className="mt-5 text-lg leading-8 text-slate-600 md:text-[1.15rem]">{post.excerpt}</p>
            )}

            {/* Tags */}
            {post.tags.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {post.tags.slice(0, 8).map((t) => (
                  <Link
                    key={t}
                    href={`/blog?${new URLSearchParams({ tag: t }).toString()}`}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition-colors hover:border-[#0f766e]/40 hover:bg-[#f0f6f6] hover:text-[#0f766e]"
                  >
                    {t}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Featured Image ──────────────────────────────────────────── */}
      {post.coverImage && (
        <div className="container mx-auto px-4 pt-10">
          <div className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-[#dde6ef] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.09)]">
            <Image
              src={post.coverImage.url}
              alt={post.coverImage.alt}
              width={1600}
              height={960}
              sizes="(max-width: 1024px) 100vw, 1200px"
              className="h-auto w-full object-cover"
              priority
            />
          </div>
        </div>
      )}

      {/* ── Article Body ────────────────────────────────────────────── */}
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">

          {/* Main Content Column */}
          <div className="min-w-0">
            {/* Article blocks — inline images appear exactly where authored */}
            <div className="rounded-[1.75rem] border border-[#e2e8f0] bg-white px-6 py-10 shadow-[0_12px_34px_rgba(15,23,42,0.05)] md:px-10 md:py-14">
              <BlogArticleBlocks blocks={post.blocks} />
            </div>

            {/* End-of-article CTA */}
            <div className="mt-8 overflow-hidden rounded-[1.75rem] border border-[#0f766e]/20 bg-[radial-gradient(circle_at_top,#e7efe7,transparent_55%),linear-gradient(135deg,#ffffff,#f0f6f7)] p-8 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#0f766e]">Explore Collections</p>
              <h3 className="mt-3 font-serif text-2xl text-slate-900 md:text-3xl">
                Find the rug that matches this story
              </h3>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                Our journal is designed for discovery. Browse curated collections and bring the details home.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/collections/vintage-rugs"
                  className="rounded-full bg-[#0f766e] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0b5c56]"
                >
                  Vintage Rugs
                </Link>
                <Link
                  href="/collections/oushak-rugs"
                  className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50"
                >
                  Oushak Rugs
                </Link>
                <Link
                  href="/collections/turkish-rugs"
                  className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50"
                >
                  Turkish Rugs
                </Link>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-5 lg:sticky lg:top-28">
            {/* Table of Contents */}
            {toc.length > 0 && <BlogTableOfContents items={toc} />}

            {/* Category card */}
            {post.category && (
              <div className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-[0_6px_20px_rgba(15,23,42,0.04)]">
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#0f766e]">Category</p>
                <p className="mt-3 font-serif text-xl text-slate-900">{post.category.title}</p>
                <Link
                  href={`/blog?${new URLSearchParams({ category: post.category.slug }).toString()}`}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 transition-colors hover:text-[#0f766e]"
                >
                  More in this category
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}

            {/* Author card */}
            {post.author?.name && (
              <div className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-[0_6px_20px_rgba(15,23,42,0.04)]">
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#0f766e]">Written by</p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e7f0ec] font-serif text-lg text-[#0f766e]">
                    {post.author.name[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{post.author.name}</p>
                    {post.author.title && (
                      <p className="text-xs text-slate-500">{post.author.title}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Back to Journal */}
            <div className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-[0_6px_20px_rgba(15,23,42,0.04)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#0f766e]">The Journal</p>
              <p className="mt-2 text-sm leading-5 text-slate-600">Explore more editorial stories and collecting insights.</p>
              <Link
                href="/blog"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 transition-colors hover:text-[#0f766e]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Journal
              </Link>
            </div>
          </aside>
        </div>
      </div>

      {/* ── Related Posts ───────────────────────────────────────────── */}
      {related.length > 0 && (
        <section className="border-t border-slate-200 bg-[#f8fbfd]">
          <div className="container mx-auto px-4 py-14 md:py-16">
            <div className="mb-10 flex items-end justify-between gap-4 border-b border-slate-200 pb-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#0f766e]">More Reading</p>
                <h2 className="mt-2 font-serif text-3xl text-slate-900 md:text-4xl">You might also enjoy</h2>
              </div>
              <Link
                href="/blog"
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 transition-colors hover:text-[#0f766e]"
              >
                All articles
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {related.map((relatedPost) => {
                const rDate = new Date(relatedPost.publishedAt)
                return (
                  <Link key={relatedPost.id} href={`/blog/${relatedPost.slug}`} className="group block">
                    <article className="h-full overflow-hidden rounded-[1.5rem] border border-[#dde6ef] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_16px_40px_rgba(15,23,42,0.1)]">
                      <div className="relative aspect-[4/3] overflow-hidden bg-[#eef3f7]">
                        {relatedPost.featuredImage ? (
                          <Image
                            src={relatedPost.featuredImage}
                            alt={relatedPost.title}
                            fill
                            sizes="(max-width: 768px) 100vw, 33vw"
                            className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#e7efe7,transparent_55%),linear-gradient(135deg,#f7fafc,#eef2f7)]" />
                        )}
                        {relatedPost.category && (
                          <div className="absolute left-4 top-4">
                            <span className="inline-flex items-center rounded-full bg-white/95 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[#0f766e] shadow-sm">
                              {relatedPost.category}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="p-6">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                          {formatBlogDate(rDate)}
                          {relatedPost.readTimeMinutes ? ` · ${relatedPost.readTimeMinutes} min` : ""}
                        </p>
                        <h3 className="mt-2 font-serif text-xl leading-[1.2] text-slate-900 transition-colors group-hover:text-[#0f766e]">
                          {relatedPost.title}
                        </h3>
                        {relatedPost.excerpt && (
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{relatedPost.excerpt}</p>
                        )}
                        <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 transition-colors group-hover:text-[#0f766e]">
                          Read Article
                          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </div>
                    </article>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
