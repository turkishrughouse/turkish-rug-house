import { ContactForm } from "@/components/storefront/contact-form"
import { getSiteSettings } from "@/lib/site-settings"
import { prisma } from "@/lib/db"
import { PageBanner } from "@/components/storefront/page-banner"

export const dynamic = "force-dynamic"

export default async function ContactInfoPage() {
  const settings = await getSiteSettings()
  const contactPage = await prisma.page.findUnique({ where: { slug: "contact" } })

  return (
    <div className="bg-white min-h-screen">
      <PageBanner
        title={contactPage?.title || "Contact"}
        subtitle={contactPage?.excerpt || settings.contactHeroDescription}
        image={contactPage?.featuredImage || settings.contactTeamCardImage || null}
      />
      <ContactForm
        pageTitle={settings.contactHeroTitle}
        pageDescription={settings.contactHeroDescription}
        phone={settings.supportPhone}
        email={settings.supportEmail}
        locationLabel={settings.contactLocationLabel}
        locationUrl={settings.contactLocationUrl}
        teamCardTitle={settings.contactTeamCardTitle}
        teamCardCtaLabel={settings.contactTeamCardCtaLabel}
        teamCardCtaUrl={settings.contactTeamCardCtaUrl}
        teamCardImage={settings.contactTeamCardImage || undefined}
      />
    </div>
  )
}
