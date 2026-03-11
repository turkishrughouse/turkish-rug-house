import { Header } from "@/components/storefront/navbar"
import { Footer } from "@/components/storefront/footer"
import { ActivityPing } from "@/components/storefront/activity-ping"
import { getSiteSettings } from "@/lib/site-settings"
import { MaintenanceScreen } from "@/components/public/maintenance-screen"
import { getSessionUser } from "@/lib/auth"

export const dynamic = "force-dynamic"

export default async function PublicLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const settings = await getSiteSettings()
    const adminUser = await getSessionUser("admin")

    if (settings.maintenanceMode && !adminUser) {
        return (
            <MaintenanceScreen
                title={settings.maintenanceTitle}
                message={settings.maintenanceMessage}
                imageUrl={settings.maintenanceImageUrl}
                socialLinks={settings.maintenanceSocialLinks}
            />
        )
    }

    return (
        <>
            <Header />
            <ActivityPing />
            <main className="min-h-screen">
                {children}
            </main>
            <Footer />
        </>
    )
}
