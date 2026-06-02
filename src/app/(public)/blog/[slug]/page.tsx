import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { BlogCard } from "@/components/storefront/blog-card"
import { getLatestPublishedBlogPosts, getPublishedBlogPostBySlug } from "@/lib/blog"
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

  const relatedPosts = await getLatestPublishedBlogPosts(slug, 3)
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
          <Link href="/blog" className="text-sm font-medium text-slate-500 hover:text-[#0f766e]">
            Journal
          </Link>
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.26em] text-[#0f766e]">
            {formatBlogDate(post.publishedAt || post.createdAt)}
          </p>
          <h1 className="mt-4 font-serif text-4xl leading-[1.02] text-slate-900 md:text-6xl">
            {post.title}
          </h1>
          {post.excerpt ? (
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">{post.excerpt}</p>
          ) : null}
        </div>

        {post.featuredImage ? (
          <div className="mx-auto mt-10 max-w-5xl overflow-hidden rounded-[30px] border border-[#dde6ef] bg-white shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
            <Image
              src={post.featuredImage}
              alt={post.title}
              width={1600}
              height={960}
              sizes="(max-width: 1024px) 100vw, 1200px"
              className="h-auto w-full object-cover"
            />
          </div>
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
