import { SettingsForm } from "@/components/admin/settings/settings-form"
import { getSiteSettings } from "@/lib/site-settings"
import { getSessionUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { adminText, resolveAdminLanguage } from "@/lib/admin/i18n"
import { getCurrencyRateDiagnostics } from "@/lib/storefront/currency-server"

export default async function SettingsPage() {
  const user = await getSessionUser("admin")
  const [settings, currencyDiagnostics] = await Promise.all([
    getSiteSettings(),
    getCurrencyRateDiagnostics(),
  ])
  const profile = user
    ? await prisma.customerProfile.findUnique({
        where: { userId: user.id },
        select: { locale: true },
      })
    : null
  const lang = resolveAdminLanguage(profile?.locale)
  const t = adminText[lang]

  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">{t.settingsPage.title}</h2>
        <p className="text-slate-600">{t.settingsPage.description}</p>
      </div>

      <div className="h-px bg-border-subtle" />

      <SettingsForm
        initialSettings={settings}
        initialAdminLocale={profile?.locale || "en_US"}
        currencyDiagnostics={currencyDiagnostics}
      />
    </div>
  )
}
