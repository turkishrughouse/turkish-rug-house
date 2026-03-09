"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { VpsSite } from "@/lib/vps/types"

type Props = {
  initialSites: VpsSite[]
}

type NewSiteForm = {
  name: string
  domain: string
  rootPath: string
  uploadsPath: string
  dbPath: string
  processName: string
  stagingBranch: string
  liveBranch: string
}

const defaultForm: NewSiteForm = {
  name: "",
  domain: "",
  rootPath: "",
  uploadsPath: "",
  dbPath: "",
  processName: "",
  stagingBranch: "develop",
  liveBranch: "main",
}

export function VpsControlPanel({ initialSites }: Props) {
  const [sites, setSites] = useState<VpsSite[]>(initialSites)
  const [form, setForm] = useState<NewSiteForm>(defaultForm)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)

  const sortedSites = useMemo(() => [...sites].sort((a, b) => a.name.localeCompare(b.name)), [sites])

  async function refreshSites() {
    const res = await fetch("/api/admin/vps/sites", { cache: "no-store" })
    const json = await res.json()
    if (res.ok && Array.isArray(json.sites)) setSites(json.sites)
  }

  async function addSite() {
    if (!form.name || !form.domain || !form.rootPath || !form.uploadsPath) {
      toast.error("Zorunlu alanlari doldurun")
      return
    }

    const payload = {
      ...form,
      dbPath: form.dbPath || undefined,
      processName: form.processName || undefined,
      sslEnabled: false,
      notes: "",
    }

    const res = await fetch("/api/admin/vps/sites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(json.error || "Site eklenemedi")
      return
    }
    toast.success("Site eklendi")
    setForm(defaultForm)
    await refreshSites()
  }

  async function runAction(siteId: string, action: string, successMessage: string) {
    setBusyId(siteId + action)
    try {
      const res = await fetch(`/api/admin/vps/sites/${siteId}/actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.result?.message || json?.error || "Islem basarisiz")
      toast.success(successMessage)
      if (json?.result?.output) {
        console.log("vps action output", json.result.output)
      }
      await refreshSites()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Islem basarisiz")
    } finally {
      setBusyId(null)
    }
  }

  async function removeSite(site: VpsSite) {
    if (!confirm(`${site.name} silinsin mi?`)) return
    const res = await fetch(`/api/admin/vps/sites/${site.id}`, { method: "DELETE" })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(json.error || "Silinemedi")
      return
    }
    toast.success("Site silindi")
    await refreshSites()
  }

  async function uploadWithPipeline(site: VpsSite, file: File) {
    setUploadingId(site.id)
    try {
      const data = new FormData()
      data.append("file", file)
      data.append("folder", "manual")
      const res = await fetch(`/api/admin/vps/sites/${site.id}/upload`, {
        method: "POST",
        body: data,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Upload basarisiz")
      toast.success("Gorsel pipeline ile islenip kaydedildi")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload hatasi")
    } finally {
      setUploadingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>VPS Test & Deployment Panel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Bu panel ile VPS sitelerini test ortamina deploy edip onaydan sonra canliya alabilirsiniz.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <Input placeholder="Site adi" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            <Input placeholder="Domain" value={form.domain} onChange={(e) => setForm((p) => ({ ...p, domain: e.target.value }))} />
            <Input placeholder="Root path" value={form.rootPath} onChange={(e) => setForm((p) => ({ ...p, rootPath: e.target.value }))} />
            <Input placeholder="Uploads path" value={form.uploadsPath} onChange={(e) => setForm((p) => ({ ...p, uploadsPath: e.target.value }))} />
            <Input placeholder="DB path (opsiyonel)" value={form.dbPath} onChange={(e) => setForm((p) => ({ ...p, dbPath: e.target.value }))} />
            <Input placeholder="PM2 process adi (opsiyonel)" value={form.processName} onChange={(e) => setForm((p) => ({ ...p, processName: e.target.value }))} />
            <Input placeholder="Staging branch" value={form.stagingBranch} onChange={(e) => setForm((p) => ({ ...p, stagingBranch: e.target.value }))} />
            <Input placeholder="Live branch" value={form.liveBranch} onChange={(e) => setForm((p) => ({ ...p, liveBranch: e.target.value }))} />
          </div>
          <Button onClick={addSite}>VPS&apos;e Yeni Site Ekle</Button>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {sortedSites.map((site) => (
          <Card key={site.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span>{site.name} ({site.domain})</span>
                <span className={`text-xs ${site.sslEnabled ? "text-emerald-600" : "text-amber-600"}`}>
                  {site.sslEnabled ? "SSL aktif" : "SSL bekliyor"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-slate-500">Root: {site.rootPath}</p>
              <p className="text-xs text-slate-500">Uploads: {site.uploadsPath}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={busyId === site.id + "enable_ssl"} onClick={() => runAction(site.id, "enable_ssl", "SSL islemi tetiklendi")}>SSL Tanimla</Button>
                <Button size="sm" variant="outline" disabled={busyId === site.id + "backup_site"} onClick={() => runAction(site.id, "backup_site", "Yedekleme tetiklendi")}>Yedek Al (Kod + DB zip)</Button>
                <Button size="sm" variant="outline" disabled={busyId === site.id + "scan_media"} onClick={() => runAction(site.id, "scan_media", "Medya tarama/sikistirma bitti")}>Tarama + Sikistir</Button>
                <Button size="sm" variant="outline" disabled={busyId === site.id + "optimize_media"} onClick={() => runAction(site.id, "optimize_media", "Tek tik pipeline islemi bitti")}>Tek Tik Pipeline</Button>
                <Button size="sm" disabled={busyId === site.id + "deploy_staging"} onClick={() => runAction(site.id, "deploy_staging", "Staging deploy tetiklendi")}>Teste Al</Button>
                <Button size="sm" disabled={busyId === site.id + "promote_live"} onClick={() => runAction(site.id, "promote_live", "Canliya alma tetiklendi")}>Canliya Al</Button>
                <Button size="sm" variant="destructive" onClick={() => removeSite(site)}>Siteyi Sil</Button>
              </div>

              <div className="rounded border p-3">
                <p className="mb-2 text-sm font-medium">Resim Yukle (otomatik optimize + thumb/large/master)</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    void uploadWithPipeline(site, file)
                    e.currentTarget.value = ""
                  }}
                  disabled={uploadingId === site.id}
                />
              </div>
            </CardContent>
          </Card>
        ))}

        {sortedSites.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-slate-500">Kayitli site yok.</CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
