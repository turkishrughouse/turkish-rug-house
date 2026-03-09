
import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { Metadata } from "next"
import { PageBanner } from "@/components/storefront/page-banner"
import { PageContentAlternating } from "@/components/storefront/page-content-alternating"
import { getSiteSettings } from "@/lib/site-settings"
import { MaintenanceScreen } from "@/components/public/maintenance-screen"
import { Header } from "@/components/storefront/navbar"
import { Footer } from "@/components/storefront/footer"
import { ActivityPing } from "@/components/storefront/activity-ping"

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
    const settings = await getSiteSettings()
    if (settings.maintenanceMode) {
        return (
            <MaintenanceScreen
                title={settings.maintenanceTitle}
                message={settings.maintenanceMessage}
                imageUrl={settings.maintenanceImageUrl}
                socialLinks={settings.footerSocialLinks}
            />
        )
    }

    const { slug } = await params
    const page = await prisma.page.findUnique({
        where: { slug, status: 'PUBLISHED' }
    })

    if (!page) notFound()

    return (
        <>
            <Header />
            <ActivityPing />
            <main className="min-h-screen bg-white pb-16">
                <PageBanner
                    title={page.title}
                    subtitle={page.excerpt || ""}
                    image={page.featuredImage}
                    imageClassName={slug === "origins" ? "object-[50%_55%]" : "object-center"}
                />
                <PageContentAlternating html={page.content || ""} fallbackImage={page.featuredImage} />
            </main>
            <Footer />
        </>
    )
}
