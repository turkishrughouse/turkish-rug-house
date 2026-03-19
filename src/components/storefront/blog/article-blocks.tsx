import Link from "next/link"
import Image from "next/image"
import { prisma } from "@/lib/db"
import { normalizeRichTextHtml } from "@/lib/rich-text"
import { ShopProductCard } from "@/components/storefront/shop-product-card"
import type { BlogContentBlock, BlogFeaturedProducts } from "@/lib/blog-model"
import { cn } from "@/lib/utils"

type FeaturedProductCard = {
  id: string
  slug: string
  title: string
  price: number
  compareAtPrice: number | null
  images: string
  stockCount?: number
  isStock?: boolean
}

async function fetchFeaturedProducts(config: BlogFeaturedProducts) {
  const ids = (config.productIds || []).filter(Boolean)
  if (ids.length === 0) return []

  const products = await prisma.product.findMany({
    where: { id: { in: ids }, isPublished: true },
    select: {
      id: true,
      slug: true,
      title: true,
      price: true,
      compareAtPrice: true,
      images: true,
      stockCount: true,
      isStock: true,
    },
  })

  const byId = new Map(products.map((p) => [p.id, p]))
  const ordered = ids.map((id) => byId.get(id)).filter((p): p is (typeof products)[number] => Boolean(p))

  return ordered.map<FeaturedProductCard>((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    price: Number(p.price),
    compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice) : null,
    images: p.images,
    stockCount: p.stockCount,
    isStock: p.isStock,
  }))
}

function Spacer({ size }: { size?: "sm" | "md" | "lg" }) {
  const height = size === "sm" ? "h-6" : size === "lg" ? "h-16" : "h-10"
  return <div className={height} aria-hidden="true" />
}

function CtaBlock({
  title,
  text,
  buttonLabel,
  buttonUrl,
  variant = "primary",
}: {
  title: string
  text?: string | null
  buttonLabel: string
  buttonUrl: string
  variant?: "primary" | "secondary" | "subtle"
}) {
  const styles =
    variant === "secondary"
      ? "border-slate-200 bg-white"
      : variant === "subtle"
        ? "border-slate-200 bg-slate-50"
        : "border-[#0f766e]/20 bg-[radial-gradient(circle_at_top,#e7efe7,transparent_58%),linear-gradient(135deg,#ffffff,#f0f6f7)]"

  const button =
    variant === "primary"
      ? "bg-[#0f766e] text-white hover:bg-[#0b5c56]"
      : "bg-slate-900 text-white hover:bg-slate-800"

  return (
    <div className={cn("not-prose rounded-2xl border p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]", styles)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#0f766e]">Continue exploring</p>
      <h3 className="mt-3 font-serif text-2xl leading-tight text-slate-900">{title}</h3>
      {text ? <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{text}</p> : null}
      <div className="mt-5">
        <Link href={buttonUrl} className={cn("inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors", button)}>
          {buttonLabel}
        </Link>
      </div>
    </div>
  )
}

export async function BlogArticleBlocks({
  blocks,
}: {
  blocks: BlogContentBlock[]
}) {
  return (
    <div className="space-y-8">
      {blocks.map(async (block) => {
        if (block.type === "divider") {
          return <hr key={block.id} className="border-slate-200" />
        }

        if (block.type === "spacer") {
          return <Spacer key={block.id} size={block.size} />
        }

        if (block.type === "heading") {
          const Tag = block.level === 2 ? "h2" : "h3"
          return (
            <Tag
              key={block.id}
              id={block.anchor || undefined}
              className={cn(
                "scroll-mt-28 font-serif text-slate-900",
                block.level === 2 ? "text-3xl leading-tight" : "text-2xl leading-tight"
              )}
            >
              {block.text}
            </Tag>
          )
        }

        if (block.type === "richText") {
          return (
            <div
              key={block.id}
              className="prose prose-slate max-w-none prose-headings:font-serif prose-headings:text-slate-900 prose-p:text-[1.03rem] prose-p:leading-8 prose-a:text-[#0f766e] prose-img:rounded-2xl prose-quote:border-l-[#0f766e] prose-table:block prose-table:w-full prose-table:overflow-x-auto prose-td:break-words prose-th:break-words"
              dangerouslySetInnerHTML={{ __html: normalizeRichTextHtml(block.html) }}
            />
          )
        }

        if (block.type === "image") {
          return (
            <figure key={block.id} className="not-prose">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <Image
                  src={block.url}
                  alt={block.alt}
                  width={1600}
                  height={1000}
                  sizes="(max-width: 1024px) 100vw, 900px"
                  className="h-auto w-full object-cover"
                />
              </div>
              {block.caption ? (
                <figcaption className="mt-3 text-xs leading-5 text-slate-500">{block.caption}</figcaption>
              ) : null}
            </figure>
          )
        }

        if (block.type === "quote") {
          return (
            <figure key={block.id} className="not-prose rounded-2xl border border-slate-200 bg-slate-50 px-6 py-6">
              <blockquote className="font-serif text-xl leading-relaxed text-slate-900">“{block.quote}”</blockquote>
              {block.attribution ? (
                <figcaption className="mt-3 text-sm text-slate-600">— {block.attribution}</figcaption>
              ) : null}
            </figure>
          )
        }

        if (block.type === "cta") {
          return (
            <div key={block.id}>
              <CtaBlock
                title={block.cta.title}
                text={block.cta.text}
                buttonLabel={block.cta.buttonLabel}
                buttonUrl={block.cta.buttonUrl}
                variant={block.cta.variant}
              />
            </div>
          )
        }

        if (block.type === "relatedCategories") {
          return (
            <div key={block.id} className="not-prose rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="font-serif text-2xl text-slate-900">{block.title || "Explore collections"}</h3>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {block.links.map((link) => (
                  <Link key={link.url} href={link.url} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 hover:bg-slate-100">
                    <p className="text-sm font-semibold text-slate-900">{link.title}</p>
                    {link.description ? <p className="mt-1 text-xs leading-5 text-slate-600">{link.description}</p> : null}
                  </Link>
                ))}
              </div>
            </div>
          )
        }

        if (block.type === "faq") {
          return (
            <div key={block.id} className="not-prose rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="font-serif text-2xl text-slate-900">{block.title || "Frequently asked"}</h3>
              <div className="mt-5 space-y-4">
                {block.items.map((item) => (
                  <div key={item.question} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-sm font-semibold text-slate-900">{item.question}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          )
        }

        if (block.type === "featuredProducts") {
          const products = await fetchFeaturedProducts(block.config)
          if (products.length === 0) return null
          return (
            <section key={block.id} className="not-prose rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex items-end justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#0f766e]">Featured rugs</p>
                  <h3 className="mt-2 font-serif text-2xl text-slate-900">
                    {block.config.title || "Pieces referenced in this story"}
                  </h3>
                </div>
                <Link href="/shop" className="text-sm font-semibold text-slate-900 hover:text-[#0f766e]">
                  Shop all
                </Link>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {products.slice(0, 8).map((product) => (
                  <ShopProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          )
        }

        // relatedPosts are rendered by the page (needs query + ranking)
        if (block.type === "relatedPosts") return null

        return null
      })}
    </div>
  )
}

