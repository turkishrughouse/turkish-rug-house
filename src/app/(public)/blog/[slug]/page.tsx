import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { BlogCard } from "@/components/storefront/blog-card"
import { getLatestPublishedBlogPosts, getPublishedBlogPostBySlug } from "@/lib/blog"
import { getBlogHeroDimensions, getBlogSectionLabel } from "@/lib/blog-section"
import { formatBlogDate, stripBlogHtml } from "@/lib/blog-shared"
import { normalizeRichTextHtml } from "@/lib/rich-text"
import { getSiteUrl, toAbsoluteSiteUrl } from "@/lib/site-url"

type Props = {
  params: Promise<{ slug: string }>
}

function buildBlogMetaDescription(post: Awaited<ReturnType<typeof getPublishedBlogPostBySlug>>) {
  if (!post) return "Article not found."
  const clean = post.metaDescription?.trim() || stripBlogHtml(post.excerpt || post.content || "")
  return clean.slice(0, 160) || "Editorial insights from Turkish Rug House."
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = await getPublishedBlogPostBySlug(slug)
  if (!post) return { title: "Article Not Found" }

  const title = post.metaTitle?.trim() || `${post.title} | Turkish Rug House`
  const description = buildBlogMetaDescription(post)

  return {
    title,
    description,
    alternates: {
      canonical: `/blog/${slug}`,
    },
    openGraph: {
      title,
      description,
      type: "article",
      url: `/blog/${slug}`,
      publishedTime: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
      images: post.featuredImage ? [{ url: toAbsoluteSiteUrl(post.featuredImage), alt: post.title }] : [],
    },
    twitter: {
      card: post.featuredImage ? "summary_large_image" : "summary",
      title,
      description,
      images: post.featuredImage ? [toAbsoluteSiteUrl(post.featuredImage)] : [],
    },
  }
}

export default async function BlogDetailPage({ params }: Props) {
  const { slug } = await params
  const post = await getPublishedBlogPostBySlug(slug)
  if (!post) notFound()

  const [relatedPosts, sectionLabel, heroDimensions] = await Promise.all([
    getLatestPublishedBlogPosts(slug, 3),
    getBlogSectionLabel(slug),
    getBlogHeroDimensions(post.featuredImage),
  ])
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: buildBlogMetaDescription(post),
    datePublished: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
    dateModified: new Date(post.updatedAt).toISOString(),
    image: post.featuredImage ? [toAbsoluteSiteUrl(post.featuredImage)] : [],
    mainEntityOfPage: `${getSiteUrl()}/blog/${post.slug}`,
    author: {
      "@type": "Organization",
      name: "Turkish Rug House",
    },
    publisher: {
      "@type": "Organization",
      name: "Turkish Rug House",
    },
  }

  return (
    <div className="bg-[#fcfdff]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />

      <article className="container mx-auto px-4 py-10 md:py-14">
        <div className="mx-auto max-w-4xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#0f766e]">
            <Link href="/blog" className="transition-colors hover:text-slate-900">
              Journal
            </Link>
            {sectionLabel ? <span className="text-slate-400"> &middot; {sectionLabel}</span> : null}
          </p>
          <p className="mt-3 text-sm text-slate-500">
            {formatBlogDate(post.publishedAt || post.createdAt)}
          </p>
          <h1 className="mt-5 max-w-3xl text-balance font-serif text-4xl leading-[1.06] text-slate-900 md:text-6xl md:leading-[1.02]">
            {post.title}
          </h1>
          {post.excerpt ? (
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">{post.excerpt}</p>
          ) : null}
        </div>

        {post.featuredImage ? (
          <figure className="mt-6 md:mt-8">
            <div className="-mx-4 overflow-hidden bg-[#eef3f7] sm:mx-auto sm:max-w-6xl sm:rounded-[10px] sm:shadow-[0_20px_44px_-28px_rgba(15,23,42,0.32)]">
              <Image
                src={post.featuredImage}
                alt={post.title}
                width={heroDimensions.width}
                height={heroDimensions.height}
                sizes="(max-width: 640px) 100vw, (max-width: 1280px) 92vw, 1152px"
                priority
                className="h-auto w-full"
              />
            </div>
          </figure>
        ) : null}

        <div className="mx-auto mt-10 max-w-3xl rounded-[28px] border border-[#e2e8f0] bg-white px-5 py-8 shadow-[0_12px_34px_rgba(15,23,42,0.04)] md:px-10 md:py-12">
          <div
            className="prose prose-slate max-w-none prose-headings:font-serif prose-headings:text-slate-900 prose-h2:mt-10 prose-h2:text-3xl prose-h3:text-2xl prose-p:text-[1.03rem] prose-p:leading-8 prose-a:text-[#0f766e] prose-img:rounded-2xl prose-table:block prose-table:w-full prose-table:overflow-x-auto prose-td:break-words prose-th:break-words"
            dangerouslySetInnerHTML={{ __html: normalizeRichTextHtml(post.content || "") }}
          />
        </div>
      </article>

      {relatedPosts.length > 0 ? (
        <section className="container mx-auto px-4 pb-16">
          <div className="mb-8 border-b border-slate-200 pb-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#0f766e]">More Reading</p>
            <h2 className="mt-3 font-serif text-3xl text-slate-900">Latest from the Journal</h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {relatedPosts.map((relatedPost) => (
              <BlogCard
                key={relatedPost.id}
                post={{
                  id: relatedPost.id,
                  title: relatedPost.title,
                  slug: relatedPost.slug,
                  excerpt: relatedPost.excerpt,
                  featuredImage: relatedPost.featuredImage,
                  publishedAt: new Date(relatedPost.publishedAt ?? relatedPost.createdAt).toISOString(),
                }}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
