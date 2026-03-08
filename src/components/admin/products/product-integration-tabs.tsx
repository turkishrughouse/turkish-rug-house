"use client"

import { useEffect, useMemo, useState } from "react"
import { Globe, Link2, Store, Webhook } from "lucide-react"
import { adminText, type AdminLanguage } from "@/lib/admin/i18n"

type TabKey = "shopify" | "etsy" | "wordpress" | "generic" | "turkishRugHouse"

const tabOrder: TabKey[] = ["shopify", "etsy", "wordpress", "generic", "turkishRugHouse"]

const tabIcons = {
  shopify: Store,
  etsy: Link2,
  wordpress: Webhook,
  generic: Globe,
  turkishRugHouse: Globe,
} as const

export function ProductIntegrationTabs({ lang }: { lang: AdminLanguage }) {
  const t = adminText[lang].integrationPage
  const [activeTab, setActiveTab] = useState<TabKey>("shopify")

  const [endpoint, setEndpoint] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [imageBaseUrl, setImageBaseUrl] = useState("")
  const [timeoutMs, setTimeoutMs] = useState("10000")
  const [enabled, setEnabled] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")

  useEffect(() => {
    let cancelled = false
    const loadConfig = async () => {
      setIsLoading(true)
      try {
        const res = await fetch("/api/admin/integrations/inventory", { cache: "no-store" })
        if (!res.ok) throw new Error("load failed")
        const data = await res.json()
        if (cancelled) return
        setEnabled(Boolean(data.enabled))
        setEndpoint(String(data.endpoint || ""))
        setApiKey(String(data.apiKey || ""))
        setImageBaseUrl(String(data.imageBaseUrl || ""))
        setTimeoutMs(String(data.timeoutMs || "10000"))
      } catch {
        if (!cancelled) setStatusMessage(t.trh.loadError)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void loadConfig()
    return () => {
      cancelled = true
    }
  }, [t.trh.loadError])

  const handleSave = async () => {
    setIsSaving(true)
    setStatusMessage("")
    try {
      const res = await fetch("/api/admin/integrations/inventory", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enabled,
          endpoint: endpoint.trim(),
          apiKey: apiKey.trim(),
          imageBaseUrl: imageBaseUrl.trim(),
          timeoutMs: Number(timeoutMs || "10000"),
        }),
      })
      if (!res.ok) throw new Error("save failed")
      setStatusMessage(t.trh.saveSuccess)
    } catch {
      setStatusMessage(t.trh.saveError)
    } finally {
      setIsSaving(false)
    }
  }

  const envPreview = useMemo(() => {
    return [
      `INVENTORY_SYNC_ENABLED=${enabled ? "true" : "false"}`,
      `INVENTORY_SYNC_ENDPOINT=${endpoint || "https://inventory.example.com/api/inventory/products/upsert"}`,
      `INVENTORY_SYNC_API_KEY=${apiKey || "your_api_key"}`,
      `INVENTORY_SYNC_TIMEOUT_MS=${timeoutMs || "10000"}`,
      `INVENTORY_SYNC_IMAGE_BASE_URL=${imageBaseUrl || "https://your-store-domain.com"}`,
    ].join("\n")
  }, [apiKey, enabled, endpoint, imageBaseUrl, timeoutMs])

  const activeText = t.providers[activeTab]

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{t.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{t.description}</p>
      </div>

      <section className="rounded-xl border border-[#dce3ed] bg-white p-4">
        <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {tabOrder.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold transition-colors ${
                activeTab === tab
                  ? "border-slate-800 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {(() => {
                const Icon = tabIcons[tab]
                return <Icon className="h-3.5 w-3.5" />
              })()}
              {t.providers[tab].name}
            </button>
          ))}
        </div>

        {activeTab !== "turkishRugHouse" ? (
          <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3">
              <p className="text-sm font-semibold text-slate-900">{activeText.name}</p>
              <p className="text-xs text-slate-600">{activeText.hint}</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-[11px] font-medium text-slate-600">{t.fields.storeUrl}</label>
              <input disabled className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-500 sm:col-span-2" placeholder="https://example.com" />
              <label className="text-[11px] font-medium text-slate-600">{t.fields.apiKey}</label>
              <input disabled className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-500 sm:col-span-2" placeholder="••••••••••••" />
              <label className="text-[11px] font-medium text-slate-600">{t.fields.apiSecret}</label>
              <input disabled className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-500 sm:col-span-2" placeholder="••••••••••••" />
              <label className="text-[11px] font-medium text-slate-600">{t.fields.endpoint}</label>
              <input disabled className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-500 sm:col-span-2" placeholder="/products" />
              <label className="text-[11px] font-medium text-slate-600">{t.fields.collection}</label>
              <input disabled className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-500 sm:col-span-2" placeholder="all" />
            </div>
          </article>
        ) : (
          <article className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">{activeText.name}</p>
              <p className="text-xs text-slate-600">{activeText.hint}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[11px] font-medium text-slate-600">{t.trh.fields.endpoint}</label>
                <input
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-700"
                  placeholder="https://inventory.yoursite.com/api/inventory/products/upsert"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[11px] font-medium text-slate-600">{t.trh.fields.apiKey}</label>
                <input
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-700"
                  placeholder="inventory_api_key"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600">{t.trh.fields.imageBaseUrl}</label>
                <input
                  value={imageBaseUrl}
                  onChange={(e) => setImageBaseUrl(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-700"
                  placeholder="https://your-store-domain.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600">{t.trh.fields.timeoutMs}</label>
                <input
                  value={timeoutMs}
                  onChange={(e) => setTimeoutMs(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-700"
                  placeholder="10000"
                />
              </div>
              <label className="sm:col-span-2 inline-flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                {t.trh.fields.enabled}
              </label>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || isLoading}
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? t.trh.saving : t.trh.save}
              </button>
              {statusMessage ? <span className="text-xs text-slate-600">{statusMessage}</span> : null}
            </div>

            <div>
              <p className="mb-1 text-[11px] font-medium text-slate-600">{t.trh.envPreview}</p>
              <pre className="overflow-x-auto rounded-md border border-slate-200 bg-white p-3 text-[11px] leading-5 text-slate-700">
                {envPreview}
              </pre>
            </div>
          </article>
        )}
      </section>
    </div>
  )
}
