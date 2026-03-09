"use client"

import { ChangeEvent, useState } from "react"
import { Save, Upload } from "lucide-react"
import { toast } from "sonner"
import { SiteSettings } from "@/lib/site-settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { adminText, resolveAdminLanguage } from "@/lib/admin/i18n"

type SettingsFormProps = {
  initialSettings: SiteSettings
  initialAdminLocale: string
}

export function SettingsForm({ initialSettings, initialAdminLocale }: SettingsFormProps) {
  const [settings, setSettings] = useState<SiteSettings>(initialSettings)
  const [adminLocale, setAdminLocale] = useState<string>(initialAdminLocale)
  const [saving, setSaving] = useState(false)
  const [uploadingMaintenanceImage, setUploadingMaintenanceImage] = useState(false)
  const lang = resolveAdminLanguage(adminLocale)
  const t = adminText[lang]

  const cardSurface = "rounded-xl border border-[#dce3ed] bg-white"
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

  const handleMaintenanceImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadingMaintenanceImage(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("folder", "pages/maintenance")

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })
      const json = await res.json().catch(() => ({} as { error?: string; url?: string }))
      if (!res.ok || !json.url) throw new Error(json.error || "Image upload failed")

      update("maintenanceImageUrl", json.url)
      toast.success(lang === "tr" ? "Bakim gorseli yuklendi" : "Maintenance image uploaded")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setUploadingMaintenanceImage(false)
      event.target.value = ""
    }
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="h-auto w-full justify-start gap-2 rounded-xl border border-[#dce3ed] bg-white p-2">
          <TabsTrigger value="general">Genel</TabsTrigger>
          <TabsTrigger value="mail">Mail</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="maintenance">Bakim Modu</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-5">
          <div className={cardSurface}>
            <div className="p-5">
              <h3 className="text-lg font-semibold text-slate-900">Genel Ayarlar</h3>
              <p className="mt-1 text-sm text-slate-500">Marka, varsayilan dil/parabirimi ve destek bilgileri.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 border-t border-[#edf1f7] p-5 md:grid-cols-2">
              <Input value={settings.siteName} onChange={(e) => update("siteName", e.target.value)} placeholder="Site name" className={inputSurface} />
              <Input value={settings.siteTagline} onChange={(e) => update("siteTagline", e.target.value)} placeholder="Tagline" className={inputSurface} />
              <Input value={settings.brandPrimary} onChange={(e) => update("brandPrimary", e.target.value)} placeholder="Brand line 1" className={inputSurface} />
              <Input value={settings.brandSecondary} onChange={(e) => update("brandSecondary", e.target.value)} placeholder="Brand line 2" className={inputSurface} />
              <Input value={settings.defaultLanguage} onChange={(e) => update("defaultLanguage", e.target.value)} placeholder="Default language" className={inputSurface} />
              <Input value={settings.defaultCurrency} onChange={(e) => update("defaultCurrency", e.target.value)} placeholder="Default currency" className={inputSurface} />
              <Input value={settings.supportEmail} onChange={(e) => update("supportEmail", e.target.value)} placeholder="Support email" className={inputSurface} />
              <Input value={settings.supportPhone} onChange={(e) => update("supportPhone", e.target.value)} placeholder="Support phone" className={inputSurface} />
            </div>
          </div>

          <div className={cardSurface}>
            <div className="p-5">
              <h3 className="text-lg font-semibold text-slate-900">Admin Dil</h3>
              <p className="mt-1 text-sm text-slate-500">Panel dili secimi.</p>
            </div>
            <div className="grid gap-3 border-t border-[#edf1f7] p-5 sm:grid-cols-2">
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
          </div>
        </TabsContent>

        <TabsContent value="mail" className="space-y-5">
          <div className={cardSurface}>
            <div className="p-5">
              <h3 className="text-lg font-semibold text-slate-900">Outgoing Mail</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 border-t border-[#edf1f7] p-5 md:grid-cols-2">
              <Input value={settings.outgoingMailHost} onChange={(e) => update("outgoingMailHost", e.target.value)} placeholder="SMTP host" className={inputSurface} />
              <Input type="number" value={String(settings.outgoingMailPort)} onChange={(e) => update("outgoingMailPort", Number(e.target.value) || 465)} placeholder="Port" className={inputSurface} />
              <Input value={settings.outgoingMailUser} onChange={(e) => update("outgoingMailUser", e.target.value)} placeholder="SMTP user" className={inputSurface} />
              <Input value={settings.outgoingMailPassword} onChange={(e) => update("outgoingMailPassword", e.target.value)} placeholder="SMTP password" className={inputSurface} />
              <Input value={settings.outgoingMailFromName} onChange={(e) => update("outgoingMailFromName", e.target.value)} placeholder="From name" className={inputSurface} />
              <Input value={settings.outgoingMailFromEmail} onChange={(e) => update("outgoingMailFromEmail", e.target.value)} placeholder="From email" className={inputSurface} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="api" className="space-y-5">
          <div className={cardSurface}>
            <div className="p-5">
              <h3 className="text-lg font-semibold text-slate-900">API Credentials</h3>
              <p className="mt-1 text-sm text-slate-500">Entegrasyon anahtarlari burada yonetilir.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 border-t border-[#edf1f7] p-5 md:grid-cols-2">
              <Input value={settings.stripeWebhookSecret} onChange={(e) => update("stripeWebhookSecret", e.target.value)} placeholder="Stripe webhook secret" className={inputSurface} />
              <Input value={settings.stripeAllowedIps} onChange={(e) => update("stripeAllowedIps", e.target.value)} placeholder="Stripe allowed IPs" className={inputSurface} />
              <Input value={settings.paypalClientId} onChange={(e) => update("paypalClientId", e.target.value)} placeholder="PayPal client id" className={inputSurface} />
              <Input value={settings.paypalClientSecret} onChange={(e) => update("paypalClientSecret", e.target.value)} placeholder="PayPal client secret" className={inputSurface} />
              <Input value={settings.paytrMerchantId} onChange={(e) => update("paytrMerchantId", e.target.value)} placeholder="PayTR merchant id" className={inputSurface} />
              <Input value={settings.paytrMerchantKey} onChange={(e) => update("paytrMerchantKey", e.target.value)} placeholder="PayTR merchant key" className={inputSurface} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-5">
          <div className={cardSurface}>
            <div className="p-5">
              <h3 className="text-[40px] font-semibold leading-tight text-slate-900">Bakim Modu</h3>
              <p className="mt-2 text-3xl text-slate-500">Site durumunu aktif/pasif yonetebilirsiniz. Pasif durumda ziyaretciler bakim sayfasini gorur.</p>
            </div>
            <div className="border-t border-[#edf1f7] p-5">
              <div className="rounded-2xl border border-[#dce3ed] p-6">
                <div className="flex items-center gap-4">
                  <Switch
                    id="maintenance-mode"
                    checked={settings.maintenanceMode}
                    onCheckedChange={(value) => update("maintenanceMode", value)}
                  />
                  <Label htmlFor="maintenance-mode" className="text-4xl font-semibold text-slate-900">Bakim modu aktif</Label>
                </div>
                <p className="mt-4 text-2xl text-slate-500">Acik oldugunda tum public sayfalar yerine bakim ekrani gosterilir.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 border-t border-[#edf1f7] p-5">
              <div className="space-y-2">
                <Label className="text-2xl text-slate-900">Bakim Basligi</Label>
                <Input
                  value={settings.maintenanceTitle}
                  onChange={(e) => update("maintenanceTitle", e.target.value)}
                  placeholder="Web sitemiz yapim asamasindadir"
                  className={inputSurface}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-2xl text-slate-900">Bakim Mesaji</Label>
                <Input
                  value={settings.maintenanceMessage}
                  onChange={(e) => update("maintenanceMessage", e.target.value)}
                  placeholder="Daha guclu bir deneyim icin altyapimizi guncelliyoruz..."
                  className={inputSurface}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-2xl text-slate-900">Bakim Gorseli URL</Label>
                <Input
                  value={settings.maintenanceImageUrl}
                  onChange={(e) => update("maintenanceImageUrl", e.target.value)}
                  placeholder="/uploads/pages/maintenance-default.jpg"
                  className={inputSurface}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-2xl text-slate-900">Bakim Gorseli Yukle</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center rounded-full bg-amber-500 px-6 py-2.5 text-base font-semibold text-white hover:bg-amber-600">
                    <Upload className="mr-2 h-4 w-4" />
                    Gorsel Ekle
                    <input type="file" className="hidden" accept="image/*" onChange={handleMaintenanceImageUpload} disabled={uploadingMaintenanceImage} />
                  </label>
                  <p className="text-sm text-slate-500">{uploadingMaintenanceImage ? "Yukleniyor..." : "Yukleme sonrasi bakim sayfasina hemen yansir."}</p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="payments" className="space-y-5">
          <div className={cardSurface}>
            <div className="p-5">
              <h3 className="text-lg font-semibold text-slate-900">Payment Providers</h3>
            </div>
            <div className="grid grid-cols-1 gap-3 border-t border-[#edf1f7] p-5 md:grid-cols-2">
              <div className="flex items-center justify-between rounded-md border border-[#dce3ed] px-3 py-2"><Label>Stripe</Label><Switch checked={settings.stripeEnabled} onCheckedChange={(v) => update("stripeEnabled", v)} /></div>
              <div className="flex items-center justify-between rounded-md border border-[#dce3ed] px-3 py-2"><Label>PayPal</Label><Switch checked={settings.paypalEnabled} onCheckedChange={(v) => update("paypalEnabled", v)} /></div>
              <div className="flex items-center justify-between rounded-md border border-[#dce3ed] px-3 py-2"><Label>Google Pay</Label><Switch checked={settings.googlePayEnabled} onCheckedChange={(v) => update("googlePayEnabled", v)} /></div>
              <div className="flex items-center justify-between rounded-md border border-[#dce3ed] px-3 py-2"><Label>Apple Pay</Label><Switch checked={settings.applePayEnabled} onCheckedChange={(v) => update("applePayEnabled", v)} /></div>
              <div className="flex items-center justify-between rounded-md border border-[#dce3ed] px-3 py-2"><Label>PayTR</Label><Switch checked={settings.paytrEnabled} onCheckedChange={(v) => update("paytrEnabled", v)} /></div>
              <div className="rounded-md border border-[#dce3ed] px-3 py-2">
                <Label className="mb-2 block">Default Provider</Label>
                <select
                  className="h-9 w-full rounded-md border border-[#dce3ed] bg-white px-3 text-sm"
                  value={settings.paymentDefaultProvider}
                  onChange={(e) => update("paymentDefaultProvider", e.target.value as SiteSettings["paymentDefaultProvider"])}
                >
                  <option value="stripe">Stripe</option>
                  <option value="paypal">PayPal</option>
                  <option value="gpay">Google Pay</option>
                  <option value="applepay">Apple Pay</option>
                  <option value="paytr">PayTR</option>
                </select>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button type="button" onClick={save} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? t.settingsForm.savingButton : t.settingsForm.saveButton}
        </Button>
      </div>
    </div>
  )
}
