import { Header } from "@/components/storefront/navbar"
import { Footer } from "@/components/storefront/footer"
import { ActivityPing } from "@/components/storefront/activity-ping"
import { getSiteSettings } from "@/lib/site-settings"
import { MaintenanceScreen } from "@/components/public/maintenance-screen"

export const dynamic = "force-dynamic"

export default async function PublicLayout({
    children,
}: {
    children: React.ReactNode
}) {
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

    return (
        <>
            <Header />
            <ActivityPing />
            {/* Add top padding wrapper if Header is fixed? Header in page.tsx was checked. 
          MainHeader (Step 892) has no 'fixed' class, but 'relative z-40'.
          DiscoveryCapsule (Step 887) is inside it.
          TopBar (not checked) might be separate. 
          Step 911 page.tsx used 'min-h-screen bg-slate-50/30' on container.
          And main has 'pt-[176px]'. This implies header IS fixed (absolute/fixed).
          However the MainHeader code (Step 892) does not show 'fixed'.
          Maybe 'Header' component (Step 911 import) wraps them all and handles positioning?
          I checked 'MainHeader' (Step 892), not 'Header'.
          Step 911 imports 'Header' from '@/components/storefront/navbar'.
          Let's assume 'Header' handles the fixed positioning or the layout needs to match page.tsx structure. 
          I will preserve the structure.
      */}
            {/* Main Content - Padded top for fixed header (36px TopBar + ~138px MainHeader = ~174px) */}
            <main className="min-h-screen">
                {children}
            </main>
            <Footer />
        </>
    )
}
