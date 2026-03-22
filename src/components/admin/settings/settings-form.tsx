"use client"

import { ChangeEvent, useEffect, useState } from "react"
import { CreditCard, Save, ShieldCheck, Upload, Wallet } from "lucide-react"
import { toast } from "sonner"
import { SiteSettings } from "@/lib/site-settings"
import type { CurrencyRateDiagnostics } from "@/lib/storefront/currency-rate-policy"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { adminText, resolveAdminLanguage } from "@/lib/admin/i18n"
import type { MailDeliverabilityReport } from "@/lib/email-deliverability"

type SettingsFormProps = {
  initialSettings: SiteSettings
  initialAdminLocale: string
  currencyDiagnostics: CurrencyRateDiagnostics
}

type SupplierSummary = {
  name: string
  number: string
  company: string
  phone: string
  note: string
  quantity: number
  soldOut: number
}

type SocialPlatform = "facebook" | "x" | "instagram" | "youtube" | "tiktok" | "linkedin" | "pinterest"

function isMailDeliverabilityReport(value: unknown): value is MailDeliverabilityReport {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as MailDeliverabilityReport).canonicalDomain === "string" &&
      Array.isArray((value as MailDeliverabilityReport).warnings) &&
      Array.isArray((value as MailDeliverabilityReport).dnsRecords)
  )
}

const maintenancePlatforms: Array<{ platform: SocialPlatform; label: string; placeholder: string }> = [
  { platform: "instagram", label: "Instagram", placeholder: "https://instagram.com/your-page" },
  { platform: "facebook", label: "Facebook", placeholder: "https://facebook.com/your-page" },
  { platform: "x", label: "X", placeholder: "https://x.com/your-page" },
  { platform: "youtube", label: "YouTube", placeholder: "https://youtube.com/@your-page" },
  { platform: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@your-page" },
  { platform: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/company/your-page" },
  { platform: "pinterest", label: "Pinterest", placeholder: "https://pinterest.com/your-page" },
]

export function SettingsForm({ initialSettings, initialAdminLocale, currencyDiagnostics }: SettingsFormProps) {
  const [settings, setSettings] = useState<SiteSettings>(initialSettings)
  const [adminLocale, setAdminLocale] = useState<string>(initialAdminLocale)
  const [saving, setSaving] = useState(false)
  const [uploadingMaintenanceImage, setUploadingMaintenanceImage] = useState(false)
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(true)
  const [editingSupplier, setEditingSupplier] = useState<SupplierSummary | null>(null)
  const [supplierDraft, setSupplierDraft] = useState<SupplierSummary | null>(null)
  const [savingSupplier, setSavingSupplier] = useState(false)
  const [mailReport, setMailReport] = useState<MailDeliverabilityReport | null>(null)
  const [loadingMailReport, setLoadingMailReport] = useState(true)
  const lang = resolveAdminLanguage(adminLocale)
  const t = adminText[lang]

  const cardSurface = "rounded-xl border border-[#dce3ed] bg-white"
  const inputSurface = "bg-white border-[#dce3ed] text-slate-900 placeholder:text-slate-400"
  const paymentCard = "rounded-2xl border border-[#dce3ed] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]"
  const diagnosticsTone =
    currencyDiagnostics.rateSource === "fallback"
      ? "border-amber-200 bg-amber-50"
      : currencyDiagnostics.freshness === "expired"
        ? "border-rose-200 bg-rose-50"
        : currencyDiagnostics.freshness === "stale"
          ? "border-orange-200 bg-orange-50"
          : "border-emerald-200 bg-emerald-50"

  const update = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const updateMaintenanceSocialLink = (platform: SocialPlatform, url: string) => {
    setSettings((prev) => {
      const current = Array.isArray(prev.maintenanceSocialLinks) ? prev.maintenanceSocialLinks : []
      const nextUrl = url.trim()
      const withoutPlatform = current.filter((item) => item.platform !== platform)
      if (!nextUrl) {
        return { ...prev, maintenanceSocialLinks: withoutPlatform }
      }
      return {
        ...prev,
        maintenanceSocialLinks: [
          ...withoutPlatform,
          { platform, label: maintenancePlatforms.find((item) => item.platform === platform)?.label || platform, url: nextUrl },
        ],
      }
    })
  }

  const getMaintenanceSocialValue = (platform: SocialPlatform) =>
    settings.maintenanceSocialLinks.find((item) => item.platform === platform)?.url || ""

  const loadSuppliers = async () => {
    setLoadingSuppliers(true)
    try {
      const res = await fetch("/api/admin/suppliers", { cache: "no-store" })
      const json = await res.json().catch(() => ({ suppliers: [] as SupplierSummary[] }))
      if (!res.ok) throw new Error(json.error || "Failed to load suppliers")
      setSuppliers(Array.isArray(json.suppliers) ? json.suppliers : [])
    } catch (error) {
      setSuppliers([])
      toast.error(error instanceof Error ? error.message : "Failed to load suppliers")
    } finally {
      setLoadingSuppliers(false)
    }
  }

  const loadMailReport = async () => {
    setLoadingMailReport(true)
    try {
      const res = await fetch("/api/admin/settings/mail-deliverability", { cache: "no-store" })
      const json = (await res.json().catch(() => null)) as unknown
      if (!res.ok || !json || (typeof json === "object" && json !== null && "error" in json)) {
        const errorMessage =
          typeof json === "object" && json !== null && "error" in json && typeof json.error === "string"
            ? json.error
            : "Failed to load mail diagnostics"
        throw new Error(errorMessage)
      }
      if (!isMailDeliverabilityReport(json)) {
        throw new Error("Mail diagnostics response is invalid")
      }
      setMailReport(json)
    } catch (error) {
      setMailReport(null)
      toast.error(error instanceof Error ? error.message : "Failed to load mail diagnostics")
    } finally {
      setLoadingMailReport(false)
    }
  }

  const openSupplierEditor = (supplier: SupplierSummary) => {
    setEditingSupplier(supplier)
    setSupplierDraft({ ...supplier })
  }

  const openCreateSupplier = () => {
    setEditingSupplier(null)
    setSupplierDraft({
      name: "",
      number: "",
      company: "",
      phone: "",
      note: "",
      quantity: 0,
      soldOut: 0,
    })
  }

  const closeSupplierEditor = () => {
    setEditingSupplier(null)
    setSupplierDraft(null)
  }

  const saveSupplierEdit = async () => {
    if (!supplierDraft) return

    const normalizedDraft = {
      ...supplierDraft,
      name: supplierDraft.name.trim(),
      number: supplierDraft.number.trim().toUpperCase(),
      company: supplierDraft.company.trim(),
      phone: supplierDraft.phone.trim(),
      note: supplierDraft.note.trim(),
    }

    if (!normalizedDraft.number) {
      toast.error("Supplier number/prefix zorunlu")
      return
    }

    setSavingSupplier(true)
    try {
      const res = await fetch("/api/admin/suppliers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ original: editingSupplier, updated: normalizedDraft }),
      })
      const json = await res.json().catch(() => ({} as { error?: string }))
      if (!res.ok) throw new Error(json.error || "Failed to update supplier")
      toast.success(editingSupplier ? "Supplier guncellendi" : "Supplier eklendi")
      closeSupplierEditor()
      await loadSuppliers()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update supplier")
    } finally {
      setSavingSupplier(false)
    }
  }

  useEffect(() => {
    void loadSuppliers().catch(() => null)
    void loadMailReport().catch(() => null)
  }, [])

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
          <TabsTrigger value="supplier">Supplier</TabsTrigger>
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
              <Input value={settings.defaultMetaTitle} onChange={(e) => update("defaultMetaTitle", e.target.value)} placeholder="Default meta title" className={inputSurface} />
              <Input value={settings.defaultMetaDescription} onChange={(e) => update("defaultMetaDescription", e.target.value)} placeholder="Default meta description" className={inputSurface} />
              <Input value={settings.defaultLanguage} onChange={(e) => update("defaultLanguage", e.target.value)} placeholder="Default language" className={inputSurface} />
              <Input value={settings.defaultCurrency} onChange={(e) => update("defaultCurrency", e.target.value)} placeholder="Default currency" className={inputSurface} />
              <Input value={settings.supportEmail} onChange={(e) => update("supportEmail", e.target.value)} placeholder="Support email" className={inputSurface} />
              <Input value={settings.supportPhone} onChange={(e) => update("supportPhone", e.target.value)} placeholder="Support phone" className={inputSurface} />
            </div>
          </div>

          <div className={cardSurface}>
            <div className="p-5">
              <h3 className="text-lg font-semibold text-slate-900">Currency Rate Status</h3>
              <p className="mt-1 text-sm text-slate-500">USD to EUR conversion diagnostics for the storefront.</p>
            </div>
            <div className={`grid gap-4 border-t border-[#edf1f7] p-5 md:grid-cols-4 ${diagnosticsTone}`}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current rate</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{currencyDiagnostics.usdToEurRate.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Source</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {currencyDiagnostics.rateSource.toUpperCase()} • {currencyDiagnostics.rateProvider}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Freshness</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{currencyDiagnostics.freshness.toUpperCase()}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last successful fetch</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {currencyDiagnostics.rateFetchedAt && currencyDiagnostics.rateFetchedAt !== new Date(0).toISOString()
                    ? new Date(currencyDiagnostics.rateFetchedAt).toLocaleString("en-US")
                    : "No live fetch yet"}
                </p>
              </div>
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

          <div className={cardSurface}>
            <div className="p-5">
              <h3 className="text-lg font-semibold text-slate-900">Deliverability Checks</h3>
              <p className="mt-1 text-sm text-slate-500">
                Password reset emails should be sent from the same domain used in the reset link and authenticated with SPF, DKIM, and DMARC.
              </p>
            </div>
            <div className="space-y-5 border-t border-[#edf1f7] p-5">
              {loadingMailReport ? (
                <p className="text-sm text-slate-500">Loading mail diagnostics...</p>
              ) : mailReport ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-[#dce3ed] bg-[#f8fafc] p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Canonical reset URL</p>
                      <p className="mt-2 break-all text-sm font-medium text-slate-900">{mailReport.canonicalResetUrl}</p>
                    </div>
                    <div className="rounded-xl border border-[#dce3ed] bg-[#f8fafc] p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active provider</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">{mailReport.providerLabel}</p>
                      <p className="mt-1 text-xs text-slate-500">{mailReport.smtpHost || "No SMTP host configured"}</p>
                    </div>
                    <div className="rounded-xl border border-[#dce3ed] bg-[#f8fafc] p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">From identity</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        {mailReport.fromName} &lt;{mailReport.fromEmail}&gt;
                      </p>
                      <p className="mt-1 text-xs text-slate-500">Reply-To: {mailReport.replyTo || "-"}</p>
                    </div>
                    <div className="rounded-xl border border-[#dce3ed] bg-[#f8fafc] p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">SMTP login</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">{mailReport.smtpUser || "-"}</p>
                    </div>
                  </div>

                  {mailReport.warnings.length > 0 ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-sm font-semibold text-amber-900">Issues to fix</p>
                      <div className="mt-3 space-y-2">
                        {mailReport.warnings.map((warning) => (
                          <p key={warning} className="text-sm text-amber-900">
                            {warning}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                      Sender identity is aligned with the current domain configuration.
                    </div>
                  )}

                  <div className="rounded-xl border border-[#dce3ed] bg-white p-4">
                    <p className="text-sm font-semibold text-slate-900">Recommended DNS records</p>
                    <div className="mt-3 space-y-3">
                      {mailReport.dnsRecords.map((record) => (
                        <div key={`${record.type}-${record.host}`} className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {record.type} {record.host}
                          </p>
                          <p className="mt-2 break-all font-mono text-xs text-slate-900">{record.value}</p>
                          <p className="mt-2 text-xs text-slate-500">{record.purpose}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#dce3ed] bg-white p-4">
                    <p className="text-sm font-semibold text-slate-900">Recommended actions</p>
                    <div className="mt-3 space-y-2">
                      {mailReport.recommendations.map((recommendation) => (
                        <p key={recommendation} className="text-sm text-slate-600">
                          {recommendation}
                        </p>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500">Mail diagnostics are unavailable right now.</p>
              )}
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

        <TabsContent value="supplier" className="space-y-5">
          <div className={cardSurface}>
            <div className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Supplier</h3>
                <p className="mt-1 text-sm text-slate-500">Supplier kayitlari burada merkezi olarak yonetilir. Frontend&apos;e yansimaz, urun eslesmesi ve quantity SKU prefix&apos;ine gore otomatik hesaplanir.</p>
              </div>
              <Button
                type="button"
                className="rounded-md bg-[#2271b1] px-4 text-sm font-medium text-white hover:bg-[#135e96]"
                onClick={openCreateSupplier}
              >
                Supplier Ekle
              </Button>
            </div>
            <div className="border-t border-[#edf1f7] p-5">
              {loadingSuppliers ? (
                <div className="rounded-xl border border-dashed border-[#dce3ed] bg-[#f8fafc] px-4 py-6 text-sm text-slate-500">
                  Supplier kayitlari yukleniyor...
                </div>
              ) : suppliers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#dce3ed] bg-[#f8fafc] px-4 py-6 text-sm text-slate-500">
                  Henuz merkezi supplier kaydi bulunmuyor.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {suppliers.map((supplier) => (
                    <div
                      key={[supplier.name, supplier.number, supplier.company, supplier.phone, supplier.note].join("||")}
                      className="rounded-xl border border-[#dce3ed] bg-[#f8fafc] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900">{supplier.name || supplier.company || supplier.number}</h4>
                          <p className="mt-1 text-xs text-slate-500">{supplier.company || "Sirket belirtilmedi"}</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 rounded-md border-[#dce3ed] bg-white px-3 text-xs font-medium text-slate-600 shadow-sm transition-all hover:border-[#cbd5e1] hover:bg-[#f8fafc] hover:text-slate-900 hover:shadow-md"
                          onClick={() => openSupplierEditor(supplier)}
                        >
                          Duzenle
                        </Button>
                      </div>
                      <div className="mt-3 grid gap-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-md border border-[#e5e7eb] bg-white px-3 py-2">
                            <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Number</span>
                            <span className="text-sm text-slate-800">{supplier.number || "-"}</span>
                          </div>
                          <div className="rounded-md border border-[#e5e7eb] bg-white px-3 py-2">
                            <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Quantity</span>
                            <span className="text-sm text-slate-800">{supplier.quantity}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-md border border-[#e5e7eb] bg-white px-3 py-2">
                            <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Phone</span>
                            <span className="text-xs text-slate-700">{supplier.phone || "-"}</span>
                          </div>
                          <div className="rounded-md border border-[#e5e7eb] bg-white px-3 py-2">
                            <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Sold out</span>
                            <span className="text-xs text-slate-700">{supplier.soldOut}</span>
                          </div>
                        </div>
                        <div className="rounded-md border border-[#e5e7eb] bg-white px-3 py-2">
                          <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Note</span>
                          <span className="whitespace-pre-wrap text-sm text-slate-800">{supplier.note || "-"}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-5">
          <div className={cardSurface}>
            <div className="p-5">
              <h3 className="text-lg font-semibold text-slate-900">Bakim Modu</h3>
              <p className="mt-1 text-sm text-slate-500">Site durumunu aktif/pasif yonetebilirsiniz. Acik oldugunda ziyaretciler bakim sayfasini gorur.</p>
            </div>
            <div className="border-t border-[#edf1f7] p-5">
              <div className="rounded-xl border border-[#dce3ed] p-5">
                <div className="flex items-center gap-4">
                  <Switch
                    id="maintenance-mode"
                    checked={settings.maintenanceMode}
                    onCheckedChange={(value) => update("maintenanceMode", value)}
                  />
                  <Label htmlFor="maintenance-mode" className="text-base font-semibold text-slate-900">Bakim modu aktif</Label>
                </div>
                <p className="mt-3 text-sm text-slate-500">Admin girisi olan kullanicilar siteyi gormeye devam eder, diger ziyaretciler bakim ekranini gorur.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 border-t border-[#edf1f7] p-5">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-900">Bakim Basligi</Label>
                <Input
                  value={settings.maintenanceTitle}
                  onChange={(e) => update("maintenanceTitle", e.target.value)}
                  placeholder="Web sitemiz yapim asamasindadir"
                  className={inputSurface}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-900">Bakim Mesaji</Label>
                <Input
                  value={settings.maintenanceMessage}
                  onChange={(e) => update("maintenanceMessage", e.target.value)}
                  placeholder="Daha guclu bir deneyim icin altyapimizi guncelliyoruz..."
                  className={inputSurface}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-900">Bakim Gorseli URL</Label>
                <Input
                  value={settings.maintenanceImageUrl}
                  onChange={(e) => update("maintenanceImageUrl", e.target.value)}
                  placeholder="/uploads/pages/maintenance-default.jpg"
                  className={inputSurface}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-900">Bakim Gorseli Yukle</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center rounded-full bg-amber-500 px-6 py-2.5 text-base font-semibold text-white hover:bg-amber-600">
                    <Upload className="mr-2 h-4 w-4" />
                    Gorsel Ekle
                    <input type="file" className="hidden" accept="image/*" onChange={handleMaintenanceImageUpload} disabled={uploadingMaintenanceImage} />
                  </label>
                  <p className="text-sm text-slate-500">{uploadingMaintenanceImage ? "Yukleniyor..." : "Yukleme sonrasi bakim sayfasina hemen yansir."}</p>
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-sm font-medium text-slate-900">Bakim Modu Sosyal Medya Linkleri</Label>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {maintenancePlatforms.map((item) => (
                    <div key={item.platform} className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</Label>
                      <Input
                        value={getMaintenanceSocialValue(item.platform)}
                        onChange={(e) => updateMaintenanceSocialLink(item.platform, e.target.value)}
                        placeholder={item.placeholder}
                        className={inputSurface}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-sm text-slate-500">Buraya eklenen linkler sadece bakim modu ekranindaki sosyal medya butonlarini gunceller.</p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="payments" className="space-y-5">
          <div className={cardSurface}>
            <div className="flex flex-col gap-4 border-b border-[#edf1f7] p-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-2xl font-semibold text-slate-900">Odeme Platformlari</h3>
                <p className="mt-1 text-sm text-slate-500">API girisleri, kimlik bilgileri ve guvenlik ayarlari tek ekranda yonetilir.</p>
              </div>
              <div className="rounded-xl border border-[#dce3ed] bg-[#f8fafc] px-4 py-3">
                <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Varsayilan Platform</Label>
                <select
                  className="h-10 min-w-[220px] rounded-xl border border-[#dce3ed] bg-white px-3 text-sm text-slate-900"
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

            <div className="grid grid-cols-1 gap-5 p-5 xl:grid-cols-3">
              <div className={paymentCard}>
                <div className="flex items-start justify-between border-b border-[#edf1f7] p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-[#eef6ff] p-3 text-[#2271b1]"><CreditCard className="h-5 w-5" /></div>
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900">Stripe</h4>
                      <p className="mt-1 text-sm text-slate-500">Kart odemeleri ve webhook guvenligi.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-[#f3f4f6] px-3 py-1 text-xs font-semibold text-slate-600">Duzenle</span>
                    <Switch checked={settings.stripeEnabled} onCheckedChange={(v) => update("stripeEnabled", v)} />
                  </div>
                </div>
                <div className="space-y-4 p-5">
                  <Input value={settings.stripePublishableKey} onChange={(e) => update("stripePublishableKey", e.target.value)} placeholder="Publishable key" className={inputSurface} />
                  <Input value={settings.stripeSecretKey} onChange={(e) => update("stripeSecretKey", e.target.value)} placeholder="Secret key" className={inputSurface} />
                  <Input value={settings.stripeWebhookSecret} onChange={(e) => update("stripeWebhookSecret", e.target.value)} placeholder="Webhook secret" className={inputSurface} />
                  <Input value={settings.stripeAllowedIps} onChange={(e) => update("stripeAllowedIps", e.target.value)} placeholder="Allowed IPs" className={inputSurface} />
                </div>
              </div>

              <div className={paymentCard}>
                <div className="flex items-start justify-between border-b border-[#edf1f7] p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-[#fff4eb] p-3 text-[#f97316]"><Wallet className="h-5 w-5" /></div>
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900">PayPal</h4>
                      <p className="mt-1 text-sm text-slate-500">Client kimligi ve canli/sandbox secimi.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-[#f3f4f6] px-3 py-1 text-xs font-semibold text-slate-600">Duzenle</span>
                    <Switch checked={settings.paypalEnabled} onCheckedChange={(v) => update("paypalEnabled", v)} />
                  </div>
                </div>
                <div className="space-y-4 p-5">
                  <Input value={settings.paypalClientId} onChange={(e) => update("paypalClientId", e.target.value)} placeholder="Client ID" className={inputSurface} />
                  <Input value={settings.paypalClientSecret} onChange={(e) => update("paypalClientSecret", e.target.value)} placeholder="Client Secret" className={inputSurface} />
                  <select
                    className="h-10 w-full rounded-xl border border-[#dce3ed] bg-white px-3 text-sm text-slate-900"
                    value={settings.paypalMode}
                    onChange={(e) => update("paypalMode", e.target.value as SiteSettings["paypalMode"])}
                  >
                    <option value="sandbox">Sandbox</option>
                    <option value="live">Live</option>
                  </select>
                  <Input value={settings.paypalAllowedIps} onChange={(e) => update("paypalAllowedIps", e.target.value)} placeholder="Allowed IPs" className={inputSurface} />
                </div>
              </div>

              <div className={paymentCard}>
                <div className="flex items-start justify-between border-b border-[#edf1f7] p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-[#eefcf6] p-3 text-[#059669]"><ShieldCheck className="h-5 w-5" /></div>
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900">PayTR</h4>
                      <p className="mt-1 text-sm text-slate-500">Merchant bilgileri ve donus URL ayarlari.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-[#f3f4f6] px-3 py-1 text-xs font-semibold text-slate-600">Duzenle</span>
                    <Switch checked={settings.paytrEnabled} onCheckedChange={(v) => update("paytrEnabled", v)} />
                  </div>
                </div>
                <div className="space-y-4 p-5">
                  <Input value={settings.paytrMerchantId} onChange={(e) => update("paytrMerchantId", e.target.value)} placeholder="Merchant ID" className={inputSurface} />
                  <Input value={settings.paytrMerchantKey} onChange={(e) => update("paytrMerchantKey", e.target.value)} placeholder="Merchant key" className={inputSurface} />
                  <Input value={settings.paytrMerchantSalt} onChange={(e) => update("paytrMerchantSalt", e.target.value)} placeholder="Merchant salt" className={inputSurface} />
                  <Input value={settings.paytrMerchantOkUrl} onChange={(e) => update("paytrMerchantOkUrl", e.target.value)} placeholder="Success URL" className={inputSurface} />
                  <Input value={settings.paytrMerchantFailUrl} onChange={(e) => update("paytrMerchantFailUrl", e.target.value)} placeholder="Fail URL" className={inputSurface} />
                </div>
              </div>

              <div className={paymentCard}>
                <div className="flex items-start justify-between border-b border-[#edf1f7] p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-[#eef6ff] p-3 text-[#2563eb]"><Wallet className="h-5 w-5" /></div>
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900">Google Pay</h4>
                      <p className="mt-1 text-sm text-slate-500">Merchant tanimi ve API kimlikleri.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-[#f3f4f6] px-3 py-1 text-xs font-semibold text-slate-600">Duzenle</span>
                    <Switch checked={settings.googlePayEnabled} onCheckedChange={(v) => update("googlePayEnabled", v)} />
                  </div>
                </div>
                <div className="space-y-4 p-5">
                  <Input value={settings.googlePayMerchantId} onChange={(e) => update("googlePayMerchantId", e.target.value)} placeholder="Merchant ID" className={inputSurface} />
                  <Input value={settings.googlePayMerchantName} onChange={(e) => update("googlePayMerchantName", e.target.value)} placeholder="Merchant name" className={inputSurface} />
                  <Input value={settings.googlePayApiKey} onChange={(e) => update("googlePayApiKey", e.target.value)} placeholder="API key" className={inputSurface} />
                  <Input value={settings.googlePayApiSecret} onChange={(e) => update("googlePayApiSecret", e.target.value)} placeholder="API secret" className={inputSurface} />
                  <Input value={settings.googlePayAllowedIps} onChange={(e) => update("googlePayAllowedIps", e.target.value)} placeholder="Allowed IPs" className={inputSurface} />
                </div>
              </div>

              <div className={paymentCard}>
                <div className="flex items-start justify-between border-b border-[#edf1f7] p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-[#f5f3ff] p-3 text-[#7c3aed]"><Wallet className="h-5 w-5" /></div>
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900">Apple Pay</h4>
                      <p className="mt-1 text-sm text-slate-500">Merchant, domain ve guvenlik alanlari.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-[#f3f4f6] px-3 py-1 text-xs font-semibold text-slate-600">Duzenle</span>
                    <Switch checked={settings.applePayEnabled} onCheckedChange={(v) => update("applePayEnabled", v)} />
                  </div>
                </div>
                <div className="space-y-4 p-5">
                  <Input value={settings.applePayMerchantId} onChange={(e) => update("applePayMerchantId", e.target.value)} placeholder="Merchant ID" className={inputSurface} />
                  <Input value={settings.applePayMerchantName} onChange={(e) => update("applePayMerchantName", e.target.value)} placeholder="Merchant name" className={inputSurface} />
                  <Input value={settings.applePayApiKey} onChange={(e) => update("applePayApiKey", e.target.value)} placeholder="API key" className={inputSurface} />
                  <Input value={settings.applePayApiSecret} onChange={(e) => update("applePayApiSecret", e.target.value)} placeholder="API secret" className={inputSurface} />
                  <Input value={settings.applePayDomain} onChange={(e) => update("applePayDomain", e.target.value)} placeholder="Verified domain" className={inputSurface} />
                  <Input value={settings.applePayAllowedIps} onChange={(e) => update("applePayAllowedIps", e.target.value)} placeholder="Allowed IPs" className={inputSurface} />
                </div>
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

      <Dialog open={Boolean(supplierDraft)} onOpenChange={(open) => !open && closeSupplierEditor()}>
        <DialogContent className="border-[#dce3ed] bg-white sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{editingSupplier ? "Supplier Duzenle" : "Supplier Ekle"}</DialogTitle>
            <DialogDescription>Supplier prefix kayitlari burada merkezi olarak tutulur ve urunlere SKU prefix&apos;ine gore otomatik baglanir.</DialogDescription>
          </DialogHeader>
          {supplierDraft ? (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input value={supplierDraft.name} onChange={(e) => setSupplierDraft((prev) => prev ? { ...prev, name: e.target.value } : prev)} className={inputSurface} />
              </div>
              <div className="grid gap-2">
                <Label>Company</Label>
                <Input value={supplierDraft.company} onChange={(e) => setSupplierDraft((prev) => prev ? { ...prev, company: e.target.value } : prev)} className={inputSurface} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Number / Prefix</Label>
                  <Input value={supplierDraft.number} onChange={(e) => setSupplierDraft((prev) => prev ? { ...prev, number: e.target.value.toUpperCase() } : prev)} className={inputSurface} />
                </div>
                <div className="grid gap-2">
                  <Label>Phone</Label>
                  <Input value={supplierDraft.phone} onChange={(e) => setSupplierDraft((prev) => prev ? { ...prev, phone: e.target.value } : prev)} className={inputSurface} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Note</Label>
                <Input value={supplierDraft.note} onChange={(e) => setSupplierDraft((prev) => prev ? { ...prev, note: e.target.value } : prev)} className={inputSurface} />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeSupplierEditor}>Vazgec</Button>
            <Button type="button" onClick={saveSupplierEdit} disabled={savingSupplier}>
              {savingSupplier ? "Kaydediliyor..." : editingSupplier ? "Kaydet" : "Supplier Ekle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
