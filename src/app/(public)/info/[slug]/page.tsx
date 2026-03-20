import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { getSiteSettings } from "@/lib/site-settings"
import { ContactForm } from "@/components/storefront/contact-form"
import { PageBanner } from "@/components/storefront/page-banner"
import { PageContentAlternating } from "@/components/storefront/page-content-alternating"

export const dynamic = 'force-dynamic'

interface Props {
    params: Promise<{ slug: string }>
}

function stripHtml(input: string | null | undefined) {
    if (!input) return ""
    return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function splitText(input: string, max = 220) {
    if (!input) return ""
    if (input.length <= max) return input
    return `${input.slice(0, max).trim()}...`
}

function parseAboutExcerpt(excerpt: string | null | undefined, fallbackTitle: string) {
    const parts = (excerpt || "")
        .split("||")
        .map((p) => p.trim())
        .filter(Boolean)

    return {
        topBadge: parts[0] || "Some Words About Us",
        heroTitle: parts[1] || fallbackTitle,
        cardOneTitle: parts[2] || "We love what we do",
        cardTwoTitle: parts[3] || "Our working process",
        sectionBadge: parts[4] || "Seemingly Elegant Design",
        sectionTitle: parts[5] || "About our online store",
        leadText: parts[6] || "",
    }
}

type AboutGalleryImage = {
    imageUrl: string
    alt: string
    width: number
    height: number
}

async function getAboutGalleryImages() {
    const rows = await prisma.$queryRaw<Array<{
        image_url: string
        alt: string | null
        width: number | null
        height: number | null
    }>>`
          SELECT "image_url", "alt", "width", "height"
          FROM "MediaAsset"
          WHERE "variant" = 'master'
            AND "image_url" IS NOT NULL
            AND "width" >= 1200
            AND "height" >= 900
          ORDER BY "created_at" DESC
          LIMIT 3
        `

    return rows
        .filter((row) => typeof row.image_url === "string" && row.image_url.trim())
        .map((row, index) => ({
            imageUrl: row.image_url.trim(),
            alt: row.alt?.trim() || `Turkish Rug House gallery image ${index + 1}`,
            width: Number(row.width || 1600),
            height: Number(row.height || 1200),
        })) satisfies AboutGalleryImage[]
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params
    const page = await prisma.page.findUnique({
        where: { slug }
    })

    if (!page || page.status !== 'PUBLISHED') {
        return {
            title: 'Page Not Found'
        }
    }

    return {
        title: page.metaTitle || page.title,
        description: page.metaDescription || page.excerpt,
    }
}

export default async function InfoPage({ params }: Props) {
    const { slug } = await params
    const page = await prisma.page.findUnique({
        where: { slug }
    })

    if (!page || page.status !== 'PUBLISHED') {
        notFound()
    }

    if (slug === "contact") {
        const settings = await getSiteSettings()
        return (
            <div className="bg-white min-h-screen">
                <PageBanner
                    title={page.title}
                    subtitle={page.excerpt || settings.contactHeroDescription || ""}
                    image={page.featuredImage || settings.contactTeamCardImage || null}
                    imageClassName="object-center"
                />
                <ContactForm
                    pageTitle={settings.contactHeroTitle || page.title}
                    pageDescription={settings.contactHeroDescription || page.excerpt || ""}
                    phone={settings.supportPhone}
                    email={settings.supportEmail}
                    locationLabel={settings.contactLocationLabel}
                    locationUrl={settings.contactLocationUrl}
                    teamCardTitle={settings.contactTeamCardTitle}
                    teamCardCtaLabel={settings.contactTeamCardCtaLabel}
                    teamCardCtaUrl={settings.contactTeamCardCtaUrl}
                    teamCardImage={settings.contactTeamCardImage || page.featuredImage || undefined}
                />
            </div>
        )
    }

    const isAboutTemplate = slug === "about" || slug === "about-us"
    const plainContent = stripHtml(page.content)
    const aboutMeta = parseAboutExcerpt(page.excerpt, page.title)
    const contentBlocks = (page.content || "")
        .split("<!--split-->")
        .map((p) => stripHtml(p))
        .filter(Boolean)
    const fallbackBlocks = plainContent
        .split(". ")
        .map((s) => s.trim())
        .filter(Boolean)
    const blockOne = splitText(contentBlocks[0] || fallbackBlocks.slice(0, 3).join(". "), 220)
    const blockTwo = splitText(contentBlocks[1] || fallbackBlocks.slice(3, 6).join(". "), 220)
    const longBody = contentBlocks[2] || plainContent
    const lead = splitText(aboutMeta.leadText || longBody, 320)

    if (isAboutTemplate) {
        const galleryImages = await getAboutGalleryImages()
        return (
            <div className="min-h-screen bg-[#f6f3ee] pb-20 text-slate-900">
                <section className="border-b border-[#e6dfd3] bg-gradient-to-b from-[#f7f2ea] to-[#f6f3ee]">
                    <div className="mx-auto grid w-full max-w-[1320px] gap-12 px-6 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
                        <div className="max-w-[640px]">
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f6f4f]">About Turkish Rug House</p>
                            <h1 className="mt-5 font-serif text-4xl leading-tight md:text-5xl lg:text-6xl">
                                Handmade Turkish rugs with lasting provenance, restraint, and character.
                            </h1>
                            <p className="mt-6 text-lg leading-8 text-slate-600">
                                Turkish Rug House curates one-of-a-kind handmade rugs shaped by Anatolian weaving culture. Our mission is direct:
                                present authentic pieces with clarity, respect for craftsmanship, and a level of trust suited to high-value interiors.
                            </p>
                            <div className="mt-8 grid gap-4 sm:grid-cols-3">
                                <div className="rounded-2xl border border-[#e3d7c7] bg-white/80 p-4">
                                    <div className="text-2xl font-semibold">Handmade</div>
                                    <div className="mt-1 text-sm text-slate-500">Every piece is individually woven, not factory replicated.</div>
                                </div>
                                <div className="rounded-2xl border border-[#e3d7c7] bg-white/80 p-4">
                                    <div className="text-2xl font-semibold">Direct</div>
                                    <div className="mt-1 text-sm text-slate-500">Curated with direct sourcing and close control over quality.</div>
                                </div>
                                <div className="rounded-2xl border border-[#e3d7c7] bg-white/80 p-4">
                                    <div className="text-2xl font-semibold">Global</div>
                                    <div className="mt-1 text-sm text-slate-500">Prepared for international delivery with insured shipping.</div>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-[32px] border border-[#e3d7c7] bg-white shadow-[0_30px_80px_rgba(22,30,45,0.08)]">
                            {page.featuredImage || galleryImages[0]?.imageUrl ? (
                                <div className="relative aspect-[4/5]">
                                    <Image
                                        src={page.featuredImage || galleryImages[0]?.imageUrl || "/placeholder.jpg"}
                                        alt={page.title}
                                        fill
                                        sizes="(max-width: 1024px) 100vw, 42vw"
                                        className="object-cover"
                                        priority
                                    />
                                </div>
                            ) : (
                                <div className="aspect-[4/5] bg-[#ebe4d8]" />
                            )}
                        </div>
                    </div>
                </section>

                <section className="mx-auto w-full max-w-[1320px] px-6 py-16">
                    <div className="grid gap-10 lg:grid-cols-2">
                        <div className="rounded-[28px] border border-[#e3d7c7] bg-white p-8 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f6f4f]">Craftsmanship</p>
                            <h2 className="mt-4 font-serif text-3xl md:text-4xl">A tradition of weaving that cannot be mass-produced</h2>
                            <p className="mt-5 text-base leading-8 text-slate-600">
                                Handmade rugs carry variation by nature: knot density, wool character, natural wear, and the rhythm of the loom.
                                That variation is the value. Anatolian weaving tradition is not decorative nostalgia here; it is the basis of how each rug is judged, sourced, and presented.
                            </p>
                            <p className="mt-4 text-base leading-8 text-slate-600">
                                Each piece remains singular. Size, dye movement, field balance, and patina give a rug its own presence in a room. That is why we treat every listing as a one-piece acquisition rather than interchangeable inventory.
                            </p>
                        </div>

                        <div className="rounded-[28px] border border-[#e3d7c7] bg-[#f1ebe1] p-8">
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f6f4f]">Story</p>
                            <h2 className="mt-4 font-serif text-3xl md:text-4xl">Heritage, authenticity, and timeless design</h2>
                            <p className="mt-5 text-base leading-8 text-slate-700">
                                The brand philosophy is straightforward: respect origin, avoid noise, and let material quality speak. We focus on rugs that hold historical character while still working inside contemporary homes, hospitality spaces, and designer projects.
                            </p>
                            <p className="mt-4 text-base leading-8 text-slate-700">
                                Authenticity matters more than volume. Timeless design matters more than trend. The goal is to help clients choose pieces with permanence, not short-term novelty.
                            </p>
                        </div>
                    </div>
                </section>

                <section className="mx-auto w-full max-w-[1320px] px-6 pb-16">
                    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f6f4f]">Gallery</p>
                            <h2 className="mt-3 font-serif text-3xl md:text-4xl">Three pieces from our media library</h2>
                        </div>
                        <p className="max-w-[560px] text-sm leading-7 text-slate-600">
                            High-resolution imagery is pulled directly from the media library to keep the page aligned with the actual catalog and visual quality of the brand.
                        </p>
                    </div>
                    <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                        {galleryImages.map((image) => (
                            <div key={image.imageUrl} className="overflow-hidden rounded-[26px] border border-[#e3d7c7] bg-white shadow-sm">
                                <div className="relative aspect-[4/5]">
                                    <Image
                                        src={image.imageUrl}
                                        alt={image.alt}
                                        fill
                                        sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw"
                                        className="object-cover"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="border-y border-[#e6dfd3] bg-white">
                    <div className="mx-auto grid w-full max-w-[1320px] gap-10 px-6 py-16 lg:grid-cols-[0.95fr_1.05fr]">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f6f4f]">Global Trust</p>
                            <h2 className="mt-4 font-serif text-3xl md:text-4xl">A global service model built for collectible rugs</h2>
                        </div>
                        <div className="grid gap-6 md:grid-cols-3">
                            <div>
                                <h3 className="text-lg font-semibold">Worldwide shipping</h3>
                                <p className="mt-2 text-sm leading-7 text-slate-600">Orders are prepared for insured international delivery with clear communication and careful packing.</p>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold">Curated selection</h3>
                                <p className="mt-2 text-sm leading-7 text-slate-600">The catalog is edited for character and quality rather than inflated with generic stock.</p>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold">Direct sourcing</h3>
                                <p className="mt-2 text-sm leading-7 text-slate-600">Direct sourcing protects provenance and keeps material quality visible at every step.</p>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        )
    }

    if (slug === "help") {
        const [publishedPages, rootCategories] = await Promise.all([
            prisma.page.findMany({
                where: { status: "PUBLISHED" },
                select: { slug: true, title: true },
                orderBy: { title: "asc" },
            }),
            prisma.category.findMany({
                where: { parentId: null },
                select: { slug: true, title: true },
                orderBy: { sortOrder: "asc" },
                take: 8,
            }),
        ])

        const infoPageLinks = publishedPages
            .filter((item) => item.slug !== "help")
            .slice(0, 12)

        return (
            <div className="bg-white min-h-screen pb-20">
                <PageBanner
                    title={page.title}
                    subtitle={page.excerpt || ""}
                    image={page.featuredImage}
                    size="tall"
                    imageClassName="object-center"
                />
                <PageContentAlternating html={page.content || ""} fallbackImage={page.featuredImage} />

                <section className="mx-auto mt-10 w-full max-w-[1200px] px-6">
                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
                            <h2 className="text-2xl font-semibold text-slate-900">Sitemap</h2>
                            <Link href="/sitemap.xml" className="text-sm font-medium text-teal-700 hover:underline">
                                View XML Sitemap
                            </Link>
                        </div>

                        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                            <div>
                                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-900">Store</h3>
                                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                                    <li><Link href="/" className="hover:text-teal-700">Home</Link></li>
                                    <li><Link href="/shop" className="hover:text-teal-700">Shop</Link></li>
                                    <li><Link href="/basket" className="hover:text-teal-700">Shopping Cart</Link></li>
                                    <li><Link href="/checkout" className="hover:text-teal-700">Checkout</Link></li>
                                    <li><Link href="/wishlist" className="hover:text-teal-700">Wishlist</Link></li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-900">Account</h3>
                                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                                    <li><Link href="/account" className="hover:text-teal-700">My Account</Link></li>
                                    <li><Link href="/orders" className="hover:text-teal-700">Orders</Link></li>
                                    <li><Link href="/saved-searches" className="hover:text-teal-700">Saved Searches</Link></li>
                                    <li><Link href="/compare" className="hover:text-teal-700">Compare</Link></li>
                                    <li><Link href="/faq" className="hover:text-teal-700">FAQ</Link></li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-900">Info Pages</h3>
                                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                                    {infoPageLinks.length > 0 ? infoPageLinks.map((item) => (
                                        <li key={item.slug}>
                                            <Link href={`/info/${item.slug}`} className="hover:text-teal-700">
                                                {item.title}
                                            </Link>
                                        </li>
                                    )) : (
                                        <li className="text-slate-500">No published pages yet.</li>
                                    )}
                                </ul>
                            </div>

                            <div>
                                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-900">Categories</h3>
                                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                                    {rootCategories.length > 0 ? rootCategories.map((cat) => (
                                        <li key={cat.slug}>
                                            <Link href={`/category/${cat.slug}`} className="hover:text-teal-700">
                                                {cat.title}
                                            </Link>
                                        </li>
                                    )) : (
                                        <li className="text-slate-500">No categories yet.</li>
                                    )}
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        )
    }

    return (
        <div className="bg-white min-h-screen pb-20">
            <PageBanner
                title={page.title}
                subtitle={page.excerpt || ""}
                image={page.featuredImage}
                imageClassName="object-center"
            />
            <PageContentAlternating html={page.content || ""} fallbackImage={page.featuredImage} />
        </div>
    )
}
