"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Folder as FolderIcon, FolderPlus, Image as ImageIcon, Loader2, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
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
  updatedAt?: number | string
  uploadedAt?: number | string
  modifiedAt?: number | string
  timestamp?: number | string
  sortTimestamp?: number
}

type PaginationState = {
  page: number
  limit: number
  totalItems: number
  totalPages: number
}

type CategoryRow = {
  id: string
  title: string
  slug: string
  parentId: string | null
}

type CategoryOption = {
  id: string
  label: string
  value: string
}

const ALL_TOP = "__all__"
const ALL_SUB = "__all_sub__"
const MEDIA_PAGE_SIZE = 30

function toEpochMillis(value: number | string | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === "string") {
    const numeric = Number(value)
    if (Number.isFinite(numeric)) return numeric
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function withSortTimestamp(asset: Asset): Asset {
  const sortTimestamp =
    toEpochMillis(asset.createdAt) ||
    toEpochMillis(asset.updatedAt) ||
    toEpochMillis(asset.uploadedAt) ||
    toEpochMillis(asset.modifiedAt) ||
    toEpochMillis(asset.timestamp) ||
    0

  return {
    ...asset,
    sortTimestamp,
  }
}

function compareAssetsNewestFirst(a: Asset, b: Asset) {
  return (b.sortTimestamp || 0) - (a.sortTimestamp || 0) || b.name.localeCompare(a.name) || b.url.localeCompare(a.url)
}

function prettifyAssetName(asset: Asset) {
  return prettifyAdminMediaLabel(asset)
}

function buildCategoryOptions(categories: CategoryRow[]) {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const childrenByParent = new Map<string | null, CategoryRow[]>()
  const pathById = new Map<string, string>()

  for (const category of categories) {
    const key = category.parentId || null
    const list = childrenByParent.get(key) || []
    list.push(category)
    childrenByParent.set(key, list)
  }

  const resolvePath = (id: string): string => {
    const cached = pathById.get(id)
    if (cached) return cached
    const current = byId.get(id)
    if (!current) return ""
    const parentPath = current.parentId ? resolvePath(current.parentId) : ""
    const nextPath = parentPath ? `${parentPath}/${current.slug}` : current.slug
    pathById.set(id, nextPath)
    return nextPath
  }

  const topOptions = (childrenByParent.get(null) || []).map<CategoryOption>((category) => ({
    id: category.id,
    label: category.title,
    value: resolvePath(category.id),
  }))

  const subOptionsByTop = new Map<string, CategoryOption[]>()
  for (const topOption of topOptions) {
    const directChildren = (childrenByParent.get(topOption.id) || []).map<CategoryOption>((category) => ({
      id: category.id,
      label: category.title,
      value: resolvePath(category.id),
    }))
    subOptionsByTop.set(topOption.value, directChildren)
  }

  return {
    topOptions,
    subOptionsByTop,
  }
}

export function MediaBrowser() {
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTopFolder, setSelectedTopFolder] = useState(ALL_TOP)
  const [selectedSubfolder, setSelectedSubfolder] = useState(ALL_SUB)
  const [selectedChildFolder, setSelectedChildFolder] = useState("")
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
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const normalizedSearchTerm = searchTerm.trim().toLowerCase()
  const categoryTree = useMemo(() => buildCategoryOptions(categories), [categories])

  const assetQuery = useMemo(() => {
    const params = new URLSearchParams()
    params.set("page", String(assetPage))
    params.set("limit", String(MEDIA_PAGE_SIZE))
    if (normalizedSearchTerm) params.set("search", normalizedSearchTerm)

    if (selectedChildFolder) {
      params.set("folder", selectedChildFolder)
      params.set("folderMode", "exact")
    } else if (selectedSubfolder !== ALL_SUB) {
      params.set("folder", selectedSubfolder)
      params.set("folderMode", "prefix")
    } else if (selectedTopFolder !== ALL_TOP) {
      params.set("folder", selectedTopFolder)
      params.set("folderMode", "prefix")
    }

    return params.toString()
  }, [assetPage, normalizedSearchTerm, selectedChildFolder, selectedSubfolder, selectedTopFolder])

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/categories", { cache: "no-store" })
      const json = await res.json().catch(() => null as null | { error?: string } | CategoryRow[])
      if (!res.ok) {
        const errorMessage = !Array.isArray(json) && json?.error ? json.error : "Failed to fetch categories"
        throw new Error(errorMessage)
      }
      setCategories(Array.isArray(json) ? json.map((category) => ({
        id: category.id,
        title: category.title,
        slug: category.slug,
        parentId: category.parentId ?? null,
      })) : [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch categories")
    }
  }, [])

  useEffect(() => {
    void loadCategories()
  }, [loadCategories])

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
    void loadFolders()
  }, [loadFolders])

  const topFolders = useMemo(
    () => categoryTree.topOptions.map((option) => option.value),
    [categoryTree.topOptions]
  )

  const topFolderLabels = useMemo(
    () => new Map(categoryTree.topOptions.map((option) => [option.value, option.label])),
    [categoryTree.topOptions]
  )

  const loadAssets = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/media?${assetQuery}`, { cache: "no-store" })
      const json = await res.json().catch(() => null as null | { error?: string; assets?: Asset[]; pagination?: PaginationState })
      if (!res.ok) throw new Error(json?.error || "Failed to fetch media")
      setAssets((json?.assets || []).map(withSortTimestamp))
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
    void loadAssets()
  }, [loadAssets, selectedSubfolder, selectedTopFolder])

  const subfolders = useMemo(() => {
    if (selectedTopFolder === ALL_TOP) return [] as string[]
    return (categoryTree.subOptionsByTop.get(selectedTopFolder) || []).map((option) => option.value)
  }, [categoryTree.subOptionsByTop, selectedTopFolder])

  const subfolderLabels = useMemo(
    () =>
      new Map(
        Array.from(categoryTree.subOptionsByTop.values()).flatMap((options) => options.map((option) => [option.value, option.label] as const))
      ),
    [categoryTree.subOptionsByTop]
  )

  useEffect(() => {
    setSelectedSubfolder(ALL_SUB)
    setSelectedChildFolder("")
    setSearchTerm("")
    setSelectedUrls([])
  }, [selectedTopFolder])

  useEffect(() => {
    setSelectedChildFolder("")
    setAssetPage(1)
    setSearchTerm("")
    setSelectedUrls([])
  }, [selectedSubfolder])

  useEffect(() => {
    setAssetPage(1)
    setSelectedUrls([])
    setPreviewAsset(null)
  }, [selectedChildFolder])

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

  const directSkuFolders = useMemo(() => {
    if (selectedSubfolder === ALL_SUB || selectedChildFolder) return [] as string[]
    const prefix = `${selectedSubfolder}/`
    return folders
      .map((folder) => folder.name)
      .filter((name) => name.startsWith(prefix))
      .map((name) => name.slice(prefix.length))
      .filter((rest) => rest.length > 0 && !rest.includes("/"))
      .filter((leaf) => looksLikeProductSkuSegment(leaf))
      .map((leaf) => `${selectedSubfolder}/${leaf}`)
      .sort((a, b) => a.localeCompare(b))
  }, [folders, selectedChildFolder, selectedSubfolder])

  const visibleSkuFolders = useMemo(() => {
    if (!normalizedSearchTerm) return directSkuFolders
    return directSkuFolders.filter((folder) => {
      const leaf = folder.split("/").pop() || folder
      return folder.toLowerCase().includes(normalizedSearchTerm) || leaf.toLowerCase().includes(normalizedSearchTerm)
    })
  }, [directSkuFolders, normalizedSearchTerm])

  const isAllCategoriesRoot = selectedTopFolder === ALL_TOP && selectedSubfolder === ALL_SUB && !selectedChildFolder
  const showsSkuFolderCards = !isAllCategoriesRoot && selectedSubfolder !== ALL_SUB && !selectedChildFolder && directSkuFolders.length > 0

  const filteredAssets = useMemo(() => {
    const topPrefix = selectedTopFolder !== ALL_TOP ? selectedTopFolder : ""
    const subPrefix = selectedSubfolder !== ALL_SUB ? selectedSubfolder : ""
    const childPrefix = selectedChildFolder

    return [...assets]
      .sort(compareAssetsNewestFirst)
      .filter((asset) => {
        if (!topPrefix) return true
        return asset.folder === topPrefix || asset.folder.startsWith(`${topPrefix}/`)
      })
      .filter((asset) => {
        if (!subPrefix) return true
        return asset.folder === subPrefix || asset.folder.startsWith(`${subPrefix}/`)
      })
      .filter((asset) => {
        if (!childPrefix) return true
        return asset.folder === childPrefix || asset.folder.startsWith(`${childPrefix}/`)
      })
      .filter((asset) => {
        if (!normalizedSearchTerm) return true
        const haystacks = [
          asset.name,
          asset.folder,
          asset.usedIn,
          prettifyAssetName(asset),
          asset.url,
        ]
        return haystacks.some((value) => value.toLowerCase().includes(normalizedSearchTerm))
      })
  }, [assets, normalizedSearchTerm, selectedChildFolder, selectedSubfolder, selectedTopFolder])

  const renderedAssets = useMemo(() => {
    if (showsSkuFolderCards) return [] as Asset[]
    return filteredAssets
  }, [filteredAssets, showsSkuFolderCards])

  const allFilteredSelected = renderedAssets.length > 0 && renderedAssets.every((asset) => selectedUrls.includes(asset.url))

  const toggleSelectAll = () => {
    if (renderedAssets.length === 0) return
    if (allFilteredSelected) {
      const visibleUrls = new Set(renderedAssets.map((asset) => asset.url))
      setSelectedUrls((prev) => prev.filter((url) => !visibleUrls.has(url)))
      return
    }
    setSelectedUrls(Array.from(new Set(renderedAssets.map((asset) => asset.url))))
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
      await loadAssets()
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
      await loadAssets()
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
      await loadAssets()
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
                <Select value={selectedTopFolder} onValueChange={(value) => {
                  setSelectedTopFolder(value)
                  setSelectedChildFolder("")
                }}>
                  <SelectTrigger className="h-12 border-[#cfd9e4] bg-white text-[15px]">
                    <SelectValue placeholder="Ana sayfalar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_TOP}>All categories</SelectItem>
                    {topFolders.map((folder) => (
                      <SelectItem key={folder} value={folder}>
                        {topFolderLabels.get(folder) || folder}
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
                        {subfolderLabels.get(folder) || folder}
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
              <Button type="button" variant="outline" className="h-12 px-5" onClick={toggleSelectAll} disabled={renderedAssets.length === 0}>
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
          ) : showsSkuFolderCards ? (
            <div className="space-y-4">
              {visibleSkuFolders.length === 0 ? (
                <div className="flex h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#d7dee8] bg-[#f8fafc] text-slate-500">
                  <FolderIcon className="mb-3 h-10 w-10 text-slate-300" />
                  No folders found
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                  {visibleSkuFolders.map((folder) => {
                    const folderLeaf = folder.split("/").pop() || folder
                    return (
                      <button
                        key={folder}
                        type="button"
                        onClick={() => setSelectedChildFolder(folder)}
                        className="rounded-[28px] border border-[#dce3ed] bg-white p-6 text-left shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition hover:border-slate-300"
                      >
                        <div className="mb-8 text-[#f59e0b]">
                          <FolderIcon className="h-9 w-9" />
                        </div>
                        <div className="text-[18px] font-semibold text-slate-900">{folderLeaf}</div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ) : renderedAssets.length === 0 ? (
            <div className="flex h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#d7dee8] bg-[#f8fafc] text-slate-500">
              <ImageIcon className="mb-3 h-10 w-10 text-slate-300" />
              No images found
            </div>
          ) : (
            <>
            {selectedChildFolder ? (
              <div className="mb-4 flex items-center justify-between rounded-2xl border border-[#dce3ed] bg-white px-4 py-3">
                <p className="text-sm text-slate-500">{selectedChildFolder}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => setSelectedChildFolder("")}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Back
                </Button>
              </div>
            ) : null}
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {renderedAssets.map((asset) => {
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
