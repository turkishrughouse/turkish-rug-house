"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Folder, FolderPlus, Image as ImageIcon, Loader2, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { buildMediaDropdownTree } from "@/components/admin/media/media-dropdown-options"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { listCanonicalFolderPaths, resolveCanonicalFolderPath } from "@/lib/admin/media-folder-paths"
import { isManagedUploadUrl } from "@/lib/storage/url"
import { prettifyAdminMediaLabel } from "@/lib/admin/media-labels"
import { shouldUseProductSkuChildFolders } from "@/lib/media-sku-roots"

type Folder = { name: string; count: number }
type Asset = {
  id: string
  url: string
  name: string
  folder: string
  source: string
  usedIn: string
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

export function MediaBrowser() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTopFolder, setSelectedTopFolder] = useState(ALL_TOP)
  const [selectedSubfolder, setSelectedSubfolder] = useState(ALL_SUB)
  const [selectedChildFolder, setSelectedChildFolder] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedFolderCard, setSelectedFolderCard] = useState("")
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
  const didInitializeRef = useRef(false)

  const normalizedSearchTerm = searchTerm.trim().toLowerCase()
  const folderNames = useMemo(() => listCanonicalFolderPaths(folders.map((folder) => folder.name)), [folders])
  const canonicalFolders = useMemo(() => folderNames.map((name) => ({ name, count: 0 })), [folderNames])
  const canonicalizeFolderPath = useCallback((value: string) => resolveCanonicalFolderPath(value, folderNames), [folderNames])
  const resetSelectionState = useCallback((next?: {
    topFolder?: string
    subfolder?: string
    childFolder?: string
    resetSearch?: boolean
    resetSelection?: boolean
    resetPagination?: boolean
    resetFolderCard?: boolean
  }) => {
    const topFolder = next?.topFolder ?? ALL_TOP
    const subfolder = next?.subfolder ?? ALL_SUB
    const childFolder = next?.childFolder ?? ""

    setSelectedTopFolder(topFolder)
    setSelectedSubfolder(subfolder)
    setSelectedChildFolder(childFolder)

    if (next?.resetSearch ?? true) setSearchTerm("")
    if (next?.resetFolderCard ?? true) setSelectedFolderCard("")
    if (next?.resetSelection ?? true) setSelectedUrls([])
    if (next?.resetPagination ?? true) setAssetPage(1)

    console.info("[admin-media-browser] selection state", {
      topCategoryState: topFolder,
      subcategoryState: subfolder,
      selectedChildFolderState: childFolder,
    })
  }, [])
  const usesSkuFolders = useMemo(() => {
    if (selectedSubfolder === ALL_SUB) return false
    return shouldUseProductSkuChildFolders(selectedSubfolder)
  }, [selectedSubfolder])
  const isPromotedSubfolderView = selectedSubfolder === ALL_SUB && Boolean(selectedChildFolder)

  const assetQuery = useMemo(() => {
    const params = new URLSearchParams()
    params.set("page", String(assetPage))
    params.set("limit", String(MEDIA_PAGE_SIZE))
    if (normalizedSearchTerm) params.set("search", normalizedSearchTerm)

    let rawSelectedValue = ""
    let selectedLabel = ""
    let canonicalFolder = ""

    if (isPromotedSubfolderView) {
      rawSelectedValue = selectedChildFolder
      selectedLabel = folderLabel(selectedChildFolder.split("/").pop() || selectedChildFolder)
      canonicalFolder = canonicalizeFolderPath(selectedChildFolder)
      console.info("[admin-media-browser] asset request", {
        selectedUiLabel: selectedLabel,
        selectedRawValue: rawSelectedValue,
        canonicalResolvedValue: canonicalFolder,
        finalRequestFolder: "",
        topFolder: selectedTopFolder,
        selectedSubfolder,
        selectedChildFolder,
      })
      return params.toString()
    }

    if (selectedChildFolder) {
      rawSelectedValue = selectedChildFolder
      selectedLabel = folderLabel(selectedChildFolder.split("/").pop() || selectedChildFolder)
      canonicalFolder = canonicalizeFolderPath(selectedChildFolder)
      params.set("folder", canonicalFolder)
      params.set("folderMode", "exact")
      console.info("[admin-media-browser] asset request", {
        selectedUiLabel: selectedLabel,
        selectedRawValue: rawSelectedValue,
        canonicalResolvedValue: canonicalFolder,
        finalRequestFolder: canonicalFolder,
        topFolder: selectedTopFolder,
        selectedSubfolder,
        selectedChildFolder,
      })
      return params.toString()
    }

    if (selectedSubfolder !== ALL_SUB) {
      rawSelectedValue = selectedSubfolder
      selectedLabel = folderLabel(selectedSubfolder.split("/").pop() || selectedSubfolder)
      canonicalFolder = canonicalizeFolderPath(selectedSubfolder)
      if (!usesSkuFolders) {
        params.set("folder", canonicalFolder)
        params.set("folderMode", "exact")
      }
      console.info("[admin-media-browser] asset request", {
        selectedUiLabel: selectedLabel,
        selectedRawValue: rawSelectedValue,
        canonicalResolvedValue: canonicalFolder,
        finalRequestFolder: params.get("folder") || "",
        topFolder: selectedTopFolder,
        selectedSubfolder,
        selectedChildFolder,
      })
      return params.toString()
    }

    if (selectedTopFolder !== ALL_TOP) {
      rawSelectedValue = selectedTopFolder
      selectedLabel = folderLabel(selectedTopFolder)
      canonicalFolder = canonicalizeFolderPath(selectedTopFolder)
      params.set("folder", canonicalFolder)
      params.set("folderMode", "exact")
    }

    console.info("[admin-media-browser] asset request", {
      selectedUiLabel: selectedLabel,
      selectedRawValue: rawSelectedValue,
      canonicalResolvedValue: canonicalFolder,
      finalRequestFolder: params.get("folder") || "",
      topFolder: selectedTopFolder,
      selectedSubfolder,
      selectedChildFolder,
    })

    return params.toString()
  }, [assetPage, canonicalizeFolderPath, isPromotedSubfolderView, normalizedSearchTerm, selectedChildFolder, selectedSubfolder, selectedTopFolder, usesSkuFolders])

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

  useEffect(() => {
    if (!foldersLoaded) return
    if (didInitializeRef.current) return
    didInitializeRef.current = true
    resetSelectionState({
      topFolder: ALL_TOP,
      subfolder: ALL_SUB,
      childFolder: "",
    })
  }, [foldersLoaded, resetSelectionState])

  const dropdownTree = useMemo(() => buildMediaDropdownTree(folderNames), [folderNames])
  const topFolders = useMemo(
    () => [...dropdownTree.topFolders].sort((a, b) => folderLabel(a).localeCompare(folderLabel(b))),
    [dropdownTree.topFolders]
  )

  useEffect(() => {
    if (selectedTopFolder === ALL_TOP) return
    if (topFolders.includes(selectedTopFolder)) return
    resetSelectionState({
      topFolder: ALL_TOP,
      subfolder: ALL_SUB,
      childFolder: "",
    })
  }, [resetSelectionState, selectedTopFolder, topFolders])

  const loadAssets = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/media?${assetQuery}`, { cache: "no-store" })
      const json = await res.json().catch(() => null as null | { error?: string; assets?: Asset[]; pagination?: PaginationState })
      if (!res.ok) throw new Error(json?.error || "Failed to fetch media")
      const nextAssets = json?.assets || []
      console.info("[admin-media-browser] asset response", {
        requestUrl: `/api/admin/media?${assetQuery}`,
        apiAssetCountReceived: nextAssets.length,
        assetFolders: nextAssets.map((asset: Asset) => asset.folder),
      })
      setAssets(nextAssets)
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
    if (isPromotedSubfolderView) {
      setAssets([])
      setPagination({ page: 1, limit: MEDIA_PAGE_SIZE, totalItems: 0, totalPages: 1 })
      setLoading(false)
      return
    }
    if (selectedTopFolder === ALL_TOP && !selectedChildFolder) {
      setAssets([])
      setPagination({ page: 1, limit: MEDIA_PAGE_SIZE, totalItems: 0, totalPages: 1 })
      setLoading(false)
      return
    }
    void loadAssets()
  }, [foldersLoaded, isPromotedSubfolderView, loadAssets, selectedChildFolder, selectedSubfolder, selectedTopFolder])

  const subfolders = useMemo(() => {
    if (selectedTopFolder === ALL_TOP) return [] as string[]
    return (dropdownTree.subfoldersByTop.get(selectedTopFolder) || []).slice()
      .sort((a, b) => folderLabel(a).localeCompare(folderLabel(b)))
  }, [dropdownTree.subfoldersByTop, selectedTopFolder])

  useEffect(() => {
    if (selectedSubfolder === ALL_SUB) return
    if (subfolders.includes(selectedSubfolder)) return
    resetSelectionState({
      topFolder: selectedTopFolder,
      subfolder: ALL_SUB,
      childFolder: "",
      resetSearch: false,
      resetSelection: false,
      resetFolderCard: false,
    })
  }, [resetSelectionState, selectedSubfolder, selectedTopFolder, subfolders])

  const activeFolder = selectedChildFolder || (selectedSubfolder !== ALL_SUB ? selectedSubfolder : selectedTopFolder !== ALL_TOP ? selectedTopFolder : "")

  const childFolders = useMemo(() => {
    if (selectedSubfolder === ALL_SUB) return [] as string[]
    const prefix = `${selectedSubfolder}/`
    return canonicalFolders
      .map((folder) => folder.name)
      .filter((name) => name.startsWith(prefix))
      .map((name) => name.slice(prefix.length))
      .filter((rest) => rest.length > 0 && !rest.includes("/"))
      .map((leaf) => `${selectedSubfolder}/${leaf}`)
      .sort((a, b) => folderLabel(a.split("/").pop() || a).localeCompare(folderLabel(b.split("/").pop() || b)))
  }, [canonicalFolders, selectedSubfolder])

  useEffect(() => {
    setAssetPage(1)
  }, [searchTerm, selectedTopFolder, selectedSubfolder, selectedChildFolder])

  const currentLevelFolders = useMemo(() => {
    if (selectedTopFolder === ALL_TOP) return topFolders
    if (isPromotedSubfolderView) return childFolders
    if (selectedChildFolder) return [] as string[]
    if (selectedSubfolder !== ALL_SUB) return childFolders
    return subfolders
  }, [childFolders, isPromotedSubfolderView, selectedChildFolder, selectedSubfolder, selectedTopFolder, subfolders, topFolders])

  const searchableFolders = useMemo(() => {
    const allFolderNames = canonicalFolders.map((folder) => folder.name)

    if (selectedTopFolder === ALL_TOP) {
      return topFolders
        .slice()
        .sort((a, b) => folderLabel(a).localeCompare(folderLabel(b)))
    }

    if (isPromotedSubfolderView) {
      const prefix = `${selectedChildFolder}/`
      return allFolderNames
        .filter((name) => name.startsWith(prefix))
        .sort((a, b) => folderLabel(a.split("/").pop() || a).localeCompare(folderLabel(b.split("/").pop() || b)))
    }

    if (selectedChildFolder) {
      const prefix = `${selectedChildFolder}/`
      return allFolderNames
        .filter((name) => name.startsWith(prefix))
        .sort((a, b) => folderLabel(a.split("/").pop() || a).localeCompare(folderLabel(b.split("/").pop() || b)))
    }

    if (selectedSubfolder !== ALL_SUB) {
      const prefix = `${selectedSubfolder}/`
      return allFolderNames
        .filter((name) => name.startsWith(prefix))
        .sort((a, b) => folderLabel(a.split("/").pop() || a).localeCompare(folderLabel(b.split("/").pop() || b)))
    }

    if (selectedTopFolder !== ALL_TOP) {
      const prefix = `${selectedTopFolder}/`
      return allFolderNames
        .filter((name) => name.startsWith(prefix))
        .sort((a, b) => folderLabel(a.split("/").pop() || a).localeCompare(folderLabel(b.split("/").pop() || b)))
    }

    return allFolderNames.sort((a, b) => folderLabel(a.split("/").pop() || a).localeCompare(folderLabel(b.split("/").pop() || b)))
  }, [canonicalFolders, isPromotedSubfolderView, selectedChildFolder, selectedSubfolder, selectedTopFolder, topFolders])

  const visibleCurrentLevelFolders = useMemo(() => {
    if (!normalizedSearchTerm) return currentLevelFolders
    return searchableFolders.filter((folder) => {
      const folderLeaf = folder.split("/").pop() || folder
      return folder.toLowerCase().includes(normalizedSearchTerm) || folderLeaf.toLowerCase().includes(normalizedSearchTerm)
    })
  }, [currentLevelFolders, normalizedSearchTerm, searchableFolders])

  const isTopLevelFolderView = selectedTopFolder !== ALL_TOP && selectedSubfolder === ALL_SUB && !selectedChildFolder

  const filteredAssets = assets

  useEffect(() => {
    console.info("[admin-media-browser] rendered assets", {
      topFolder: selectedTopFolder,
      selectedSubfolder,
      selectedChildFolder,
      returnedAssetCount: assets.length,
      renderedFolderCount: visibleCurrentLevelFolders.length,
      renderedAssetCount: filteredAssets.length,
      emptyStateInputs: {
        loading,
        renderedFolderCount: visibleCurrentLevelFolders.length,
        filteredAssetCount: filteredAssets.length,
      },
    })
  }, [assets.length, filteredAssets.length, loading, selectedChildFolder, selectedSubfolder, selectedTopFolder, visibleCurrentLevelFolders.length])

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
    await Promise.all([loadFolders(), loadAssets()])
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
    await Promise.all([loadFolders(), loadAssets()])
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
    const targetFolder = canonicalizeFolderPath(selectedChildFolder || selectedSubfolder)
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
    const targetFolder = canonicalizeFolderPath(selectedChildFolder || selectedSubfolder)
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
                <Select
                  value={selectedTopFolder}
                  onValueChange={(value) => {
                    const canonicalValue = value === ALL_TOP ? ALL_TOP : canonicalizeFolderPath(value)
                    console.info("[admin-media-browser] top folder selected", {
                      selectedUiLabel: value === ALL_TOP ? "All categories" : folderLabel(value),
                      selectedRawValue: value,
                      canonicalResolvedValue: canonicalValue,
                    })
                    resetSelectionState({
                      topFolder: canonicalValue,
                      subfolder: ALL_SUB,
                      childFolder: "",
                    })
                  }}
                >
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
                      const canonicalValue = value === ALL_SUB ? ALL_SUB : canonicalizeFolderPath(value)
                      console.info("[admin-media-browser] subfolder selected", {
                        selectedUiLabel: value === ALL_SUB ? "All subcategories" : folderLabel(value.split("/").pop() || value),
                        selectedRawValue: value,
                        canonicalResolvedValue: canonicalValue,
                      })
                      if (canonicalValue === ALL_SUB) {
                        resetSelectionState({
                          topFolder: selectedTopFolder,
                          subfolder: ALL_SUB,
                          childFolder: "",
                        })
                        return
                      }
                      resetSelectionState({
                        topFolder: selectedTopFolder,
                        subfolder: canonicalValue,
                        childFolder: "",
                      })
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
              <Button
                type="button"
                variant="outline"
                className="h-9 px-3"
                onClick={() =>
                  resetSelectionState({
                    topFolder: selectedTopFolder,
                    subfolder: selectedSubfolder,
                    childFolder: "",
                    resetSearch: false,
                    resetSelection: false,
                    resetFolderCard: false,
                  })
                }
              >
                Geri
              </Button>
            </div>
          ) : null}

          {(isPromotedSubfolderView || !selectedChildFolder) && visibleCurrentLevelFolders.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {visibleCurrentLevelFolders.map((folderPath) => (
                <button
                  key={folderPath}
                  type="button"
                  onClick={() => setSelectedFolderCard(folderPath)}
                  onDoubleClick={() => {
                    const canonicalValue = canonicalizeFolderPath(folderPath)
                    console.info("[admin-media-browser] child folder selected", {
                      topFolder: selectedTopFolder,
                      selectedSubfolder,
                      selectedChildFolder,
                      selectedUiLabel: folderLabel(folderPath.split("/").pop() || folderPath),
                      selectedRawValue: folderPath,
                      canonicalResolvedValue: canonicalValue,
                    })
                    setSelectedFolderCard(folderPath)
                    if (selectedTopFolder === ALL_TOP) {
                      resetSelectionState({
                        topFolder: canonicalValue,
                        subfolder: ALL_SUB,
                        childFolder: "",
                        resetSearch: false,
                        resetSelection: false,
                        resetFolderCard: false,
                        resetPagination: true,
                      })
                      return
                    }
                    if (isTopLevelFolderView) {
                      resetSelectionState({
                        topFolder: selectedTopFolder,
                        subfolder: canonicalValue,
                        childFolder: "",
                        resetSearch: false,
                        resetSelection: false,
                        resetFolderCard: false,
                        resetPagination: true,
                      })
                      return
                    }
                    resetSelectionState({
                      topFolder: selectedTopFolder,
                      subfolder: selectedSubfolder,
                      childFolder: canonicalValue,
                      resetSearch: false,
                      resetSelection: false,
                      resetFolderCard: false,
                      resetPagination: true,
                    })
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
          ) : filteredAssets.length === 0 && visibleCurrentLevelFolders.length === 0 ? (
            <div className="flex h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#d7dee8] bg-[#f8fafc] text-slate-500">
              <ImageIcon className="mb-3 h-10 w-10 text-slate-300" />
              No images found
            </div>
          ) : visibleCurrentLevelFolders.length === 0 ? (
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
          ) : null}
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
