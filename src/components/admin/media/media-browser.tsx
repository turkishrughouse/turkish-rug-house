"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { FolderPlus, Image as ImageIcon, Loader2, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { isManagedUploadUrl } from "@/lib/storage/url"
import { prettifyAdminMediaLabel } from "@/lib/admin/media-labels"
import { looksLikeProductSkuSegment } from "@/lib/media-sku-roots"

type Folder = { name: string; count: number }
type Asset = {
  id: string
  url: string
  name: string
  folder: string
  source: string
  usedIn: string
  createdAt?: number
}

type PaginationState = {
  page: number
  limit: number
  totalItems: number
  totalPages: number
}

const ALL_TOP = "__all__"
const ALL_SUB = "__all_sub__"
const MEDIA_PAGE_SIZE = 30
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

const INTERNAL_MEDIA_ROOTS = new Set(["cache", ".cache", "categories", "collections", "pages", "profile", "learn"])

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
  return prettifyAdminMediaLabel(asset)
}

function buildCategoryTree(folderNames: string[]) {
  const subfoldersByTop = new Map<string, Set<string>>()

  for (const folderName of folderNames) {
    const parts = folderName.split("/").filter(Boolean)
    const top = parts[0] || ""
    const directChild = parts[1] || ""
    if (!top || INTERNAL_MEDIA_ROOTS.has(top)) continue

    if (!subfoldersByTop.has(top)) subfoldersByTop.set(top, new Set())
    if (!directChild || looksLikeProductSkuSegment(directChild)) continue
    subfoldersByTop.get(top)?.add(`${top}/${directChild}`)
  }

  return {
    topFolders: Array.from(subfoldersByTop.keys()),
    subfoldersByTop: new Map(
      Array.from(subfoldersByTop.entries()).map(([top, children]) => [top, Array.from(children)])
    ),
  }
}

export function MediaBrowser() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTopFolder, setSelectedTopFolder] = useState(ALL_TOP)
  const [selectedSubfolder, setSelectedSubfolder] = useState(ALL_SUB)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedUrls, setSelectedUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [moving, setMoving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null)
  const [assetPage, setAssetPage] = useState(1)
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: MEDIA_PAGE_SIZE,
    totalItems: 0,
    totalPages: 1,
  })
  const [foldersLoaded, setFoldersLoaded] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const normalizedSearchTerm = searchTerm.trim().toLowerCase()
  const categoryTree = useMemo(() => buildCategoryTree(folders.map((folder) => folder.name)), [folders])

  const assetQuery = useMemo(() => {
    const params = new URLSearchParams()
    params.set("page", String(assetPage))
    params.set("limit", String(MEDIA_PAGE_SIZE))
    if (normalizedSearchTerm) params.set("search", normalizedSearchTerm)

    if (selectedSubfolder !== ALL_SUB) {
      params.set("folder", selectedSubfolder)
      params.set("folderMode", "prefix")
    } else if (selectedTopFolder !== ALL_TOP) {
      params.set("folder", selectedTopFolder)
      params.set("folderMode", "prefix")
    }

    return params.toString()
  }, [assetPage, normalizedSearchTerm, selectedSubfolder, selectedTopFolder])

  const loadFolders = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/media/folders", { cache: "no-store" })
      const json = await res.json().catch(() => null as null | { error?: string; folders?: Folder[] })
      if (!res.ok) throw new Error(json?.error || "Failed to fetch folders")
      setFolders(json?.folders || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch folders")
    }
  }, [])

  useEffect(() => {
    void loadFolders().finally(() => setFoldersLoaded(true))
  }, [loadFolders])

  const topFolders = useMemo(
    () => [...categoryTree.topFolders].sort((a, b) => folderLabel(a).localeCompare(folderLabel(b))),
    [categoryTree.topFolders]
  )

  const loadAssets = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/media?${assetQuery}`, { cache: "no-store" })
      const json = await res.json().catch(() => null as null | { error?: string; assets?: Asset[]; pagination?: PaginationState })
      if (!res.ok) throw new Error(json?.error || "Failed to fetch media")
      setAssets(json?.assets || [])
      setPagination(json?.pagination || { page: 1, limit: MEDIA_PAGE_SIZE, totalItems: 0, totalPages: 1 })
      if (json?.pagination?.page && json.pagination.page !== assetPage) {
        setAssetPage(json.pagination.page)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch media")
    } finally {
      setLoading(false)
    }
  }, [assetPage, assetQuery])

  useEffect(() => {
    if (!foldersLoaded) return
    void loadAssets()
  }, [foldersLoaded, loadAssets, selectedSubfolder, selectedTopFolder])

  const subfolders = useMemo(() => {
    if (selectedTopFolder === ALL_TOP) return [] as string[]
    return (categoryTree.subfoldersByTop.get(selectedTopFolder) || [])
      .slice()
      .sort((a, b) => folderLabel(a).localeCompare(folderLabel(b)))
  }, [categoryTree.subfoldersByTop, selectedTopFolder])

  useEffect(() => {
    setSelectedSubfolder(ALL_SUB)
    setSearchTerm("")
    setSelectedUrls([])
  }, [selectedTopFolder])

  useEffect(() => {
    setAssetPage(1)
    setSearchTerm("")
    setSelectedUrls([])
  }, [selectedSubfolder])

  useEffect(() => {
    if (selectedTopFolder === ALL_TOP) return
    if (topFolders.includes(selectedTopFolder)) return
    setSelectedTopFolder(ALL_TOP)
    setSelectedSubfolder(ALL_SUB)
  }, [selectedTopFolder, topFolders])

  useEffect(() => {
    if (selectedSubfolder === ALL_SUB) return
    if (subfolders.includes(selectedSubfolder)) return
    setSelectedSubfolder(ALL_SUB)
  }, [selectedSubfolder, subfolders])

  const filteredAssets = useMemo(() => {
    const selectedPrefix = selectedSubfolder !== ALL_SUB ? selectedSubfolder : selectedTopFolder !== ALL_TOP ? selectedTopFolder : ""

    return [...assets]
      .filter((asset) => {
        if (!selectedPrefix) return true
        return asset.folder === selectedPrefix || asset.folder.startsWith(`${selectedPrefix}/`)
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0) || a.name.localeCompare(b.name))
  }, [assets, selectedSubfolder, selectedTopFolder])

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
    if (selectedSubfolder === ALL_SUB) {
      toast.error("Once an alt kategori secin")
      return
    }
    fileInputRef.current?.click()
  }

  const handleUpload = async (files: FileList | File[]) => {
    const targetFolder = selectedSubfolder
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
      await Promise.all([loadFolders(), loadAssets()])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const moveSelectedToSubfolder = async () => {
    const targetFolder = selectedSubfolder
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
      await Promise.all([loadFolders(), loadAssets()])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Move failed")
    } finally {
      setMoving(false)
    }
  }

  const deleteSelected = async () => {
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
      await Promise.all([loadFolders(), loadAssets()])
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
              <div className="grid gap-3 sm:grid-cols-[260px_260px_minmax(220px,1fr)_auto]">
                <Select value={selectedTopFolder} onValueChange={setSelectedTopFolder}>
                  <SelectTrigger className="h-12 border-[#cfd9e4] bg-white text-[15px]">
                    <SelectValue placeholder="Ana sayfalar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_TOP}>All categories</SelectItem>
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

                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Klasor veya fotograf ara"
                  className="h-12 border-[#cfd9e4] bg-white text-[15px]"
                />

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
                disabled={deleting || selectedUrls.length === 0}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Sil
              </Button>
            </div>
          </div>

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
            <>
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
            <div className="mt-6 flex items-center justify-between rounded-2xl border border-[#dce3ed] bg-white px-4 py-3">
              <p className="text-sm text-slate-500">
                Page {pagination.page} of {pagination.totalPages} • {pagination.totalItems} items
              </p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setAssetPage((prev) => Math.max(1, prev - 1))}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Previous
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => setAssetPage((prev) => Math.min(pagination.totalPages, prev + 1))}>
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
            </>
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
