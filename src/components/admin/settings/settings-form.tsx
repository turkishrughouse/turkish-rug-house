"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Save } from "lucide-react"
import { SiteSettings } from "@/lib/site-settings"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { adminText, resolveAdminLanguage } from "@/lib/admin/i18n"

type SettingsFormProps = {
  initialSettings: SiteSettings
  initialAdminLocale: string
}

export function SettingsForm({ initialSettings, initialAdminLocale }: SettingsFormProps) {
  const [settings, setSettings] = useState<SiteSettings>(initialSettings)
  const [adminLocale, setAdminLocale] = useState<string>(initialAdminLocale)
  const [saving, setSaving] = useState(false)
  const lang = resolveAdminLanguage(adminLocale)
  const t = adminText[lang]

  const cardSurface =
    "bg-white border border-[#dce3ed] shadow-[0_8px_24px_rgba(15,23,42,0.05)]"
  const inputSurface = "bg-white border-[#dce3ed] text-slate-900 placeholder:text-slate-400"

  const update = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to save settings")

      const profileRes = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: adminLocale }),
      })
      const profileJson = await profileRes.json().catch(() => null as { error?: string } | null)
      if (!profileRes.ok) throw new Error(profileJson?.error || "Failed to update admin language")

      setSettings(json)
      toast.success(t.settingsForm.saveSuccess)
      window.location.reload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.settingsForm.saveError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className={cardSurface}>
          <CardHeader>
            <CardTitle className="text-slate-900">{lang === "tr" ? "Marka" : "Brand"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={settings.siteName}
              onChange={(e) => update("siteName", e.target.value)}
              placeholder="Site name"
              className={inputSurface}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                value={settings.brandPrimary}
                onChange={(e) => update("brandPrimary", e.target.value)}
                placeholder="Brand line 1"
                className={inputSurface}
              />
              <Input
                value={settings.brandSecondary}
                onChange={(e) => update("brandSecondary", e.target.value)}
                placeholder="Brand line 2"
                className={inputSurface}
              />
            </div>
            <Input
              value={settings.siteTagline}
              onChange={(e) => update("siteTagline", e.target.value)}
              placeholder="Tagline"
              className={inputSurface}
            />
          </CardContent>
        </Card>

        <Card className={cardSurface}>
          <CardHeader>
            <CardTitle className="text-slate-900">{lang === "tr" ? "Magaza Varsayilanlari" : "Store Defaults"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                value={settings.defaultLanguage}
                onChange={(e) => update("defaultLanguage", e.target.value)}
                placeholder="Default language"
                className={inputSurface}
              />
              <Input
                value={settings.defaultCurrency}
                onChange={(e) => update("defaultCurrency", e.target.value)}
                placeholder="Default currency"
                className={inputSurface}
              />
            </div>

            <Input
              value={settings.supportEmail}
              onChange={(e) => update("supportEmail", e.target.value)}
              placeholder="Support email"
              className={inputSurface}
            />
            <Input
              value={settings.supportPhone}
              onChange={(e) => update("supportPhone", e.target.value)}
              placeholder="Support phone"
              className={inputSurface}
            />

            <div className="flex items-center justify-between rounded-md border border-[#dce3ed] px-3 py-2">
              <div className="space-y-0.5">
                <Label htmlFor="maintenance-mode" className="text-slate-900">Maintenance Mode</Label>
                <p className="text-xs text-slate-600">{lang === "tr" ? "Magaza tarafinda alisverisi gecici olarak durdurur." : "Temporarily disable storefront shopping behavior."}</p>
              </div>
              <Switch
                id="maintenance-mode"
                checked={settings.maintenanceMode}
                onCheckedChange={(value) => update("maintenanceMode", value)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className={cardSurface}>
        <CardHeader>
          <CardTitle className="text-slate-900">{lang === "tr" ? "Iletisim Sayfasi" : "Contact Page"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={settings.contactHeroTitle}
            onChange={(e) => update("contactHeroTitle", e.target.value)}
            placeholder="Hero title"
            className={inputSurface}
          />
          <Input
            value={settings.contactHeroDescription}
            onChange={(e) => update("contactHeroDescription", e.target.value)}
            placeholder="Hero description"
            className={inputSurface}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              value={settings.contactLocationLabel}
              onChange={(e) => update("contactLocationLabel", e.target.value)}
              placeholder="Location label"
              className={inputSurface}
            />
            <Input
              value={settings.contactLocationUrl}
              onChange={(e) => update("contactLocationUrl", e.target.value)}
              placeholder="Location URL"
              className={inputSurface}
            />
          </div>
          <Input
            value={settings.contactTeamCardTitle}
            onChange={(e) => update("contactTeamCardTitle", e.target.value)}
            placeholder="Team card title"
            className={inputSurface}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              value={settings.contactTeamCardCtaLabel}
              onChange={(e) => update("contactTeamCardCtaLabel", e.target.value)}
              placeholder="Team card CTA text"
              className={inputSurface}
            />
            <Input
              value={settings.contactTeamCardCtaUrl}
              onChange={(e) => update("contactTeamCardCtaUrl", e.target.value)}
              placeholder="Team card CTA URL"
              className={inputSurface}
            />
          </div>
          <Input
            value={settings.contactTeamCardImage}
            onChange={(e) => update("contactTeamCardImage", e.target.value)}
            placeholder="Team card image URL"
            className={inputSurface}
          />
        </CardContent>
      </Card>

      <Card className={cardSurface}>
        <CardHeader>
          <CardTitle className="text-slate-900">{t.settingsForm.languageTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">{t.settingsForm.languageDesc}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setAdminLocale("tr_TR")}
              className={`rounded-md border px-4 py-3 text-left text-sm font-medium transition-colors ${
                adminLocale.toLowerCase().startsWith("tr")
                  ? "border-teal-500 bg-teal-50 text-teal-900"
                  : "border-[#dce3ed] bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {t.settingsForm.turkish}
            </button>
            <button
              type="button"
              onClick={() => setAdminLocale("en_US")}
              className={`rounded-md border px-4 py-3 text-left text-sm font-medium transition-colors ${
                !adminLocale.toLowerCase().startsWith("tr")
                  ? "border-teal-500 bg-teal-50 text-teal-900"
                  : "border-[#dce3ed] bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {t.settingsForm.english}
            </button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="button" onClick={save} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? t.settingsForm.savingButton : t.settingsForm.saveButton}
        </Button>
      </div>
    </div>
  )
}
