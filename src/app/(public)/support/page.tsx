import { SupportRequestPage } from "@/components/storefront/support/support-request-page"
import { getSiteSettings } from "@/lib/site-settings"

export default async function SupportPage() {
  const settings = await getSiteSettings()
  return <SupportRequestPage supportEmail={settings.supportEmail} supportPhone={settings.supportPhone} />
}
