"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Folder, FolderPlus, Image as ImageIcon, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { isManagedUploadUrl } from "@/lib/storage/url"

type Folder = { name: string; count: number }
type Asset = {
  id: string
  url: string
  name: string
  folder: string
  source: string
  usedIn: string
}

const ALL_TOP = "__all__"
const ALL_SUB = "__all_sub__"
const SKU_FOLDER_ROOTS = new Set(["by-type", "cushion-covers", "by-age", "by-area"])

const FOLDER_LABELS: Record<string, string> = {
  "by-type": "By Type",
  "by-style": "By Style",
  "by-size": "By Size",
  "by-color": "By Color",
  "by-age": "By Age",
  "by-area": "By Area",
  "cushion-covers": "Cushion Covers",
  categories: "Categories",
  pages: "Pages",
  profile: "Profile",
}

function folderLabel(value: string) {
  const raw = value.trim()
  if (!raw) return value
  const direct = FOLDER_LABELS[raw]
  if (direct) return direct
  return raw
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function prettifyAssetName(asset: Asset) {
  const productMatch = asset.usedIn.match(/^Product featured:\s*(.+)$/i)
  if (productMatch?.[1]) return productMatch[1].trim()

  const raw = asset.name
    .replace(/\.(avif|webp|png|jpe?g|gif)$/i, "")
    .replace(/-(thumb|large|master)$/i, "")
    .replace(/[-_]+/g, " ")
    .trim()

  return raw || asset.name
}

export function MediaBrowser() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTopFolder, setSelectedTopFolder] = useState(ALL_TOP)
  const [selectedSubfolder, setSelectedSubfolder] = useState(ALL_SUB)
  const [selectedChildFolder, setSelectedChildFolder] = useState("")
  const [selectedFolderCard, setSelectedFolderCard] = useState("")
  const [selectedUrls, setSelectedUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [moving, setMoving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const loadMedia = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/media", { cache: "no-store" })
      const json = await res.json().catch(() => null as null | { error?: string; folders?: Folder[]; assets?: Asset[] })
      if (!res.ok) throw new Error(json?.error || "Failed to fetch media")
      setFolders(json?.folders || [])
      setAssets(json?.assets || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch media")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMedia()
  }, [loadMedia])

  const topFolders = useMemo(() => {
    const names = new Set<string>()
    for (const folder of folders) {
      const top = folder.name.split("/")[0] || folder.name
      if (top) names.add(top)
    }
    return Array.from(names).sort((a, b) => folderLabel(a).localeCompare(folderLabel(b)))
  }, [folders])

  const subfolders = useMemo(() => {
    if (selectedTopFolder === ALL_TOP) return [] as string[]
    const prefix = `${selectedTopFolder}/`
    return folders
      .map((folder) => folder.name)
      .filter((name) => name.startsWith(prefix))
      .map((name) => name.slice(prefix.length))
      .filter((rest) => rest.length > 0 && !rest.includes("/"))
      .map((leaf) => `${selectedTopFolder}/${leaf}`)
      .sort((a, b) => folderLabel(a).localeCompare(folderLabel(b)))
  }, [folders, selectedTopFolder])

  useEffect(() => {
    setSelectedSubfolder(ALL_SUB)
    setSelectedChildFolder("")
    setSelectedFolderCard("")
    setSelectedUrls([])
  }, [selectedTopFolder])

  useEffect(() => {
    setSelectedChildFolder("")
    setSelectedFolderCard("")
    setSelectedUrls([])
  }, [selectedSubfolder])

  const activeFolder = selectedChildFolder || (selectedSubfolder !== ALL_SUB ? selectedSubfolder : selectedTopFolder !== ALL_TOP ? selectedTopFolder : "")

  const childFolders = useMemo(() => {
    if (selectedSubfolder === ALL_SUB) return [] as string[]
    const prefix = `${selectedSubfolder}/`
    return folders
      .map((folder) => folder.name)
      .filter((name) => name.startsWith(prefix))
      .map((name) => name.slice(prefix.length))
      .filter((rest) => rest.length > 0 && !rest.includes("/"))
      .map((leaf) => `${selectedSubfolder}/${leaf}`)
      .sort((a, b) => folderLabel(a.split("/").pop() || a).localeCompare(folderLabel(b.split("/").pop() || b)))
  }, [folders, selectedSubfolder])

  const usesSkuFolders = useMemo(() => {
    if (selectedSubfolder === ALL_SUB) return false
    const root = selectedTopFolder !== ALL_TOP ? selectedTopFolder : selectedSubfolder.split("/")[0] || ""
    return SKU_FOLDER_ROOTS.has(root)
  }, [selectedSubfolder, selectedTopFolder])

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (selectedChildFolder) {
        return asset.folder === selectedChildFolder || asset.folder.startsWith(`${selectedChildFolder}/`)
      }

      if (selectedSubfolder !== ALL_SUB) {
        if (usesSkuFolders) return false
        return asset.folder === selectedSubfolder
      }

      const inFolder =
        !activeFolder ||
        asset.folder === activeFolder ||
        asset.folder.startsWith(`${activeFolder}/`)
      return inFolder
    })
  }, [activeFolder, assets, selectedChildFolder, selectedSubfolder, usesSkuFolders])

  const renameSelectedFolder = async () => {
    if (!selectedFolderCard) return
    const currentName = selectedFolderCard.split("/").pop() || selectedFolderCard
    const nextName = window.prompt("Yeni klasör adı", currentName)
    if (!nextName) return
    const trimmed = nextName.trim()
    if (!trimmed) return

    const res = await fetch("/api/admin/media/folders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: selectedFolderCard, newName: trimmed }),
    })
    const json = await res.json().catch(() => null as null | { error?: string; folder?: string })
    if (!res.ok || !json?.folder) {
      toast.error(json?.error || "Folder rename failed")
      return
    }
    toast.success("Klasör güncellendi")
    setSelectedFolderCard(json.folder)
    await loadMedia()
  }

  const deleteSelectedFolder = async () => {
    if (!selectedFolderCard) return
    if (!window.confirm(`${selectedFolderCard} klasoru silinsin mi?`)) return
    const res = await fetch("/api/admin/media/folders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: selectedFolderCard }),
    })
    const json = await res.json().catch(() => null as null | { error?: string })
    if (!res.ok) {
      toast.error(json?.error || "Folder delete failed")
      return
    }
    toast.success("Klasör silindi")
    if (selectedChildFolder === selectedFolderCard) {
      setSelectedChildFolder("")
    }
    setSelectedFolderCard("")
    await loadMedia()
  }

  const allFilteredSelected = filteredAssets.length > 0 && filteredAssets.every((asset) => selectedUrls.includes(asset.url))

  const toggleSelectAll = () => {
    if (filteredAssets.length === 0) return
    if (allFilteredSelected) {
      const visibleUrls = new Set(filteredAssets.map((asset) => asset.url))
      setSelectedUrls((prev) => prev.filter((url) => !visibleUrls.has(url)))
      return
    }
    setSelectedUrls(Array.from(new Set(filteredAssets.map((asset) => asset.url))))
  }

  const openFilePicker = () => {
    if (selectedSubfolder === ALL_SUB && !selectedChildFolder) {
      toast.error("Once an alt kategori secin")
      return
    }
    fileInputRef.current?.click()
  }

  const handleUpload = async (files: FileList | File[]) => {
    const targetFolder = selectedChildFolder || selectedSubfolder
    if (targetFolder === ALL_SUB || !targetFolder) {
      toast.error("Once an alt kategori secin")
      return
    }
    const list = Array.from(files || [])
    if (list.length === 0) return

    setUploading(true)
    try {
      for (const file of list) {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("folder", targetFolder)
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })
        const json = await res.json().catch(() => null as null | { error?: string })
        if (!res.ok) throw new Error(json?.error || "Upload failed")
      }
      toast.success(`${list.length} dosya eklendi`)
      await loadMedia()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const moveSelectedToSubfolder = async () => {
    const targetFolder = selectedChildFolder || selectedSubfolder
    if (targetFolder === ALL_SUB || !targetFolder) {
      toast.error("Once bir alt kategori secin")
      return
    }
    if (selectedUrls.length === 0) {
      toast.error("Once fotograf secin")
      return
    }

    const uploadOnly = assets.filter((asset) => selectedUrls.includes(asset.url) && isManagedUploadUrl(asset.url))
    if (uploadOnly.length === 0) {
      toast.error("Secilen medya tasinamiyor")
      return
    }

    setMoving(true)
    try {
      for (const asset of uploadOnly) {
        const res = await fetch("/api/admin/media", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: asset.url, targetFolder }),
        })
        const json = await res.json().catch(() => null as null | { error?: string })
        if (!res.ok) throw new Error(json?.error || "Move failed")
      }
      toast.success(`${uploadOnly.length} fotograf eklendi`)
      setSelectedUrls([])
      await loadMedia()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Move failed")
    } finally {
      setMoving(false)
    }
  }

  const deleteSelected = async () => {
    if (!selectedChildFolder && selectedFolderCard) {
      await deleteSelectedFolder()
      return
    }
    if (selectedUrls.length === 0) return
    if (!window.confirm(`${selectedUrls.length} fotograf silinsin mi?`)) return

    setDeleting(true)
    try {
      for (const url of selectedUrls) {
        const res = await fetch("/api/admin/media", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        })
        const json = await res.json().catch(() => null as null | { error?: string })
        if (!res.ok) throw new Error(json?.error || "Delete failed")
      }
      toast.success(`${selectedUrls.length} fotograf silindi`)
      setSelectedUrls([])
      setPreviewAsset(null)
      await loadMedia()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Card className="border border-[#dce3ed] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <CardContent className="space-y-6 p-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center xl:justify-start">
            <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
              <div className="grid gap-3 sm:grid-cols-[260px_260px_auto]">
                <Select value={selectedTopFolder} onValueChange={setSelectedTopFolder}>
                  <SelectTrigger className="h-12 border-[#cfd9e4] bg-white text-[15px]">
                    <SelectValue placeholder="Ana sayfalar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_TOP}>All media items</SelectItem>
                    {topFolders.map((folder) => (
                      <SelectItem key={folder} value={folder}>
                        {folderLabel(folder)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                  <Select
                    value={selectedSubfolder}
                    onValueChange={(value) => {
                      setSelectedSubfolder(value)
                      setSelectedChildFolder("")
                    }}
                    disabled={selectedTopFolder === ALL_TOP}
                  >
                  <SelectTrigger className="h-12 border-[#cfd9e4] bg-white text-[15px]">
                    <SelectValue placeholder="Alt kategoriler" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_SUB}>All subcategories</SelectItem>
                    {subfolders.map((folder) => (
                      <SelectItem key={folder} value={folder}>
                        {folderLabel(folder.split("/").pop() || folder)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedSubfolder !== ALL_SUB ? (
                  <div className="flex gap-2">
                    <Button type="button" className="h-12 px-5" onClick={openFilePicker} disabled={uploading}>
                      {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderPlus className="mr-2 h-4 w-4" />}
                      Ekle
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-3 xl:ml-0">
              <Button type="button" variant="outline" className="h-12 px-5" onClick={toggleSelectAll} disabled={filteredAssets.length === 0}>
                {allFilteredSelected ? "Secimi Kaldir" : "Tumunu Sec"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={deleteSelected}
                disabled={deleting || (selectedUrls.length === 0 && (!selectedFolderCard || Boolean(selectedChildFolder)))}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Sil
              </Button>
            </div>
          </div>

          {selectedChildFolder ? (
            <div className="flex items-center justify-between rounded-xl border border-[#dce3ed] bg-[#f8fafc] px-4 py-3">
              <p className="text-sm text-slate-600">
                {folderLabel(selectedChildFolder.split("/").pop() || selectedChildFolder)}
              </p>
              <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setSelectedChildFolder("")}>
                Geri
              </Button>
            </div>
          ) : null}

          {!selectedChildFolder && childFolders.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {childFolders.map((folderPath) => (
                <button
                  key={folderPath}
                  type="button"
                  onClick={() => setSelectedFolderCard(folderPath)}
                  onDoubleClick={() => {
                    setSelectedFolderCard(folderPath)
                    setSelectedChildFolder(folderPath)
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    setSelectedFolderCard(folderPath)
                  }}
                  className={`flex min-h-[132px] flex-col items-start justify-between rounded-2xl border bg-white p-4 text-left transition hover:border-slate-300 ${
                    selectedFolderCard === folderPath ? "border-teal-500 ring-2 ring-teal-200" : "border-[#dce3ed]"
                  }`}
                >
                  <Folder className="h-8 w-8 text-amber-500" />
                  <div>
                    <p className="truncate text-sm font-medium text-slate-900">
                      {folderLabel(folderPath.split("/").pop() || folderPath)}
                    </p>
                    <p className="truncate text-xs text-slate-500">{folderPath}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*"
            multiple
            onChange={(event) => void handleUpload(event.target.files || [])}
          />

          {loading ? (
            <div className="flex h-[420px] items-center justify-center text-sm text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading media...
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="flex h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#d7dee8] bg-[#f8fafc] text-slate-500">
              <ImageIcon className="mb-3 h-10 w-10 text-slate-300" />
              No images found
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {filteredAssets.map((asset) => {
                const selected = selectedUrls.includes(asset.url)
                return (
                  <div
                    key={asset.id}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setSelectedUrls((prev) =>
                        prev.includes(asset.url) ? prev.filter((url) => url !== asset.url) : [...prev, asset.url]
                      )
                    }
                    onDoubleClick={() => setPreviewAsset(asset)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        setSelectedUrls((prev) =>
                          prev.includes(asset.url) ? prev.filter((url) => url !== asset.url) : [...prev, asset.url]
                        )
                      }
                    }}
                    className={`overflow-hidden rounded-2xl border bg-white text-left transition ${
                      selected ? "border-teal-500 ring-2 ring-teal-200" : "border-[#dce3ed] hover:border-slate-300"
                    }`}
                  >
                    <div className="relative aspect-square overflow-hidden bg-slate-100">
                      <div className="absolute left-3 top-3 z-10 rounded-md bg-white/95 p-1.5">
                        <Checkbox
                          checked={selected}
                          onClick={(event) => event.stopPropagation()}
                          onCheckedChange={() =>
                            setSelectedUrls((prev) =>
                              prev.includes(asset.url) ? prev.filter((url) => url !== asset.url) : [...prev, asset.url]
                            )
                          }
                        />
                      </div>
                      <img src={asset.url} alt={asset.name} className="h-full w-full object-cover" />
                    </div>
                    <div className="space-y-1 p-3">
                      <p className="truncate text-sm font-medium text-slate-900">{prettifyAssetName(asset)}</p>
                      <p className="truncate text-xs text-slate-500">{asset.folder}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(previewAsset)} onOpenChange={(open) => !open && setPreviewAsset(null)}>
        <DialogContent className="max-w-3xl border-[#dce3ed] bg-white">
          <DialogHeader>
            <DialogTitle>{previewAsset ? prettifyAssetName(previewAsset) : "Preview"}</DialogTitle>
          </DialogHeader>
          {previewAsset ? (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border border-[#dce3ed] bg-slate-50">
                <img src={previewAsset.url} alt={previewAsset.name} className="h-[520px] w-full object-contain bg-white" />
              </div>
              <div className="text-sm text-slate-600">
                <p>{previewAsset.folder}</p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
