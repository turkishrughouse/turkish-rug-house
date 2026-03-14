import { Header } from "@/components/storefront/navbar"
import { Footer } from "@/components/storefront/footer"
import { ActivityPing } from "@/components/storefront/activity-ping"
import { getSiteSettings } from "@/lib/site-settings"
import { MaintenanceScreen } from "@/components/public/maintenance-screen"
import { getSessionUser } from "@/lib/auth"
import { getStorefrontCurrencySnapshot } from "@/lib/storefront/currency-server"
import { StorefrontCurrencyProvider } from "@/components/storefront/currency-provider"

export const dynamic = "force-dynamic"

export default async function PublicLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const settings = await getSiteSettings()
    const adminUser = await getSessionUser("admin")
    const currencySnapshot = await getStorefrontCurrencySnapshot()

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
        <StorefrontCurrencyProvider initialSnapshot={currencySnapshot}>
            <Header />
            <ActivityPing />
            <main className="min-h-screen">
                {children}
            </main>
            <Footer />
        </StorefrontCurrencyProvider>
    )
}
