
import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { Metadata } from "next"
import { PageBanner } from "@/components/storefront/page-banner"
import { PageContentAlternating } from "@/components/storefront/page-content-alternating"

interface PageProps {
    params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params
    const page = await prisma.page.findUnique({
        where: { slug }
    })

    if (!page || page.status !== 'PUBLISHED') return {}

    return {
        title: page.metaTitle || page.title,
        description: page.metaDescription || page.excerpt,
    }
}

export default async function DynamicPage({ params }: PageProps) {
    const { slug } = await params
    const page = await prisma.page.findUnique({
        where: { slug, status: 'PUBLISHED' }
    })

    if (!page) notFound()

    return (
        <div className="min-h-screen bg-white pb-16">
            <PageBanner
                title={page.title}
                subtitle={page.excerpt || ""}
                image={page.featuredImage}
                imageClassName={slug === "origins" ? "object-[50%_55%]" : "object-center"}
            />
            <PageContentAlternating html={page.content || ""} fallbackImage={page.featuredImage} />
        </div>
    )
}
