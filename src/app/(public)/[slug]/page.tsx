import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { Metadata } from "next"
import { PageBanner } from "@/components/storefront/page-banner"
import { PageContentAlternating } from "@/components/storefront/page-content-alternating"
import { generateCategoryMetadataByPath, renderCategoryPage } from "@/components/storefront/category-page-content"
import { resolveCategoryByPath } from "@/lib/category-paths"

interface PageProps {
    params: Promise<{ slug: string }>
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params
    const page = await prisma.page.findUnique({ where: { slug } })

    if (page && page.status === "PUBLISHED") {
        return {
            title: page.metaTitle || page.title,
            description: page.metaDescription || page.excerpt,
        }
    }

    return generateCategoryMetadataByPath([slug])
}

export default async function DynamicPage({ params, searchParams }: PageProps) {
    const { slug } = await params
    const resolvedSearchParams = searchParams ? await searchParams : {}
    const page = await prisma.page.findUnique({ where: { slug, status: "PUBLISHED" } })

    if (page) {
        return (
            <main className="min-h-screen bg-white pb-16">
                <PageBanner
                    title={page.title}
                    subtitle={page.excerpt || ""}
                    image={page.featuredImage}
                    imageClassName={slug === "origins" ? "object-[50%_55%]" : "object-center"}
                />
                <PageContentAlternating html={page.content || ""} fallbackImage={page.featuredImage} />
            </main>
        )
    }

    const category = await resolveCategoryByPath([slug])
    if (!category) notFound()

    return renderCategoryPage({
        slugPath: [slug],
        searchParams: resolvedSearchParams,
    })
}
