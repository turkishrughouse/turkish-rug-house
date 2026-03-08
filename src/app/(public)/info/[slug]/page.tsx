import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { Metadata } from "next"
import Link from "next/link"
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
        return (
            <div className="bg-[#f7f7f7] min-h-screen pb-20">
                <PageBanner
                    title={page.title}
                    subtitle={page.excerpt || ""}
                    image={page.featuredImage}
                    imageClassName="object-center"
                />
                <section className="border-y border-slate-200 bg-[#f5f5f5]">
                    <div className="container mx-auto px-6 py-14">
                        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
                            <div className="lg:col-span-5">
                                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">{aboutMeta.topBadge}</p>
                                <h1 className="mt-4 max-w-[520px] font-serif text-4xl font-bold leading-tight text-slate-900">
                                    {aboutMeta.heroTitle}
                                </h1>
                            </div>
                            <div className="lg:col-span-3">
                                <h3 className="text-3xl font-semibold text-slate-900">{aboutMeta.cardOneTitle}</h3>
                                <p className="mt-4 text-lg leading-8 text-slate-600">{blockOne}</p>
                                <Link href="#about-story" className="mt-6 inline-block border-b-2 border-emerald-700 text-sm font-semibold uppercase tracking-wide text-slate-800 hover:text-emerald-700">
                                    Read More
                                </Link>
                            </div>
                            <div className="lg:col-span-4">
                                <h3 className="text-3xl font-semibold text-slate-900">{aboutMeta.cardTwoTitle}</h3>
                                <p className="mt-4 text-lg leading-8 text-slate-600">{blockTwo}</p>
                                <Link href="#about-story" className="mt-6 inline-block border-b-2 border-emerald-700 text-sm font-semibold uppercase tracking-wide text-slate-800 hover:text-emerald-700">
                                    Read More
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="about-story" className="container mx-auto px-6 py-14">
                    <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-center">
                        <div className="lg:col-span-6">
                            <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
                                {page.featuredImage ? (
                                    <img
                                        src={page.featuredImage}
                                        alt={page.title}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="aspect-[16/10] bg-slate-200" />
                                )}
                            </div>
                        </div>

                        <div className="lg:col-span-6">
                            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">{aboutMeta.sectionBadge}</p>
                            <h2 className="mt-4 font-serif text-5xl font-bold text-slate-900">{aboutMeta.sectionTitle}</h2>
                            <p className="mt-6 text-xl italic leading-9 text-slate-500">
                                {lead || "Rug House blends Anatolian heritage with modern interiors for unique, hand-crafted living spaces."}
                            </p>
                            <p className="mt-6 text-lg leading-9 text-slate-600">
                                {longBody || "Our team curates authentic, hand-made pieces and shares the stories behind each one. We focus on quality, provenance, and timeless style for every home."}
                            </p>
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
