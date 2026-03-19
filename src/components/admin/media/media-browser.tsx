"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronRight, Folder, FolderPlus, Image as ImageIcon, Loader2, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type FolderInfo = { name: string; count: number }
type Asset = {
  id: string
  url: string
  name: string
  folder: string
  source: string
  usedIn: string
}

type CategoryFolderMeta = {
  path: string
  label: string
  count: number
  productCount: number
}

type ProductFolderMeta = {
  path: string
  categoryPath: string
  sku: string
  productId: string
  count: number
}

type MediaResponse = {
  folders?: FolderInfo[]
  assets?: Asset[]
  categoryFolders?: CategoryFolderMeta[]
  productFolders?: ProductFolderMeta[]
  error?: string
}

type FolderCard = {
  path: string
  label: string
  count: number
  kind: "category" | "product"
}

const ALL_TOP = "__all__"
const ALL_CATEGORY = "__all_category__"
const SPECIAL_ROOT_FOLDERS = ["Kategori-Fotoğrafları"] 

function formatFolderLabel(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => {
      if (/^[A-Z0-9]+$/.test(part)) return part
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    })
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

function formatProductCount(count: number) {
  return `${count} ${count === 1 ? "product" : "products"}`
}

function looksLikeSkuPath(path: string) {
  const leaf = path.split("/").filter(Boolean).pop() || path
  return /[0-9]/.test(leaf) && /^[A-Z0-9-]{6,}$/i.test(leaf)
}

function getImmediateChildPaths(folderNames: string[], parentPath: string) {
  const prefix = `${parentPath}/`
  return Array.from(
    new Set(
      folderNames
        .filter((folder) => folder.startsWith(prefix))
        .map((folder) => {
          const remainder = folder.slice(prefix.length)
          const child = remainder.split("/").filter(Boolean)[0] || ""
          return child ? `${parentPath}/${child}` : ""
        })
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b))
}

export function MediaBrowser() {
  const [folders, setFolders] = useState<FolderInfo[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [categoryFolders, setCategoryFolders] = useState<CategoryFolderMeta[]>([])
  const [productFolders, setProductFolders] = useState<ProductFolderMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTopFolder, setSelectedTopFolder] = useState(ALL_TOP)
  const [selectedCategoryFolder, setSelectedCategoryFolder] = useState(ALL_CATEGORY)
  const [selectedProductFolder, setSelectedProductFolder] = useState("")
  const [selectedFolderCard, setSelectedFolderCard] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedUrls, setSelectedUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const loadMedia = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/media", { cache: "no-store" })
      const json = await res.json().catch(() => null as null | MediaResponse)
      if (!res.ok) throw new Error(json?.error || "Failed to fetch media")
      setFolders(json?.folders || [])
      setAssets(json?.assets || [])
      setCategoryFolders(json?.categoryFolders || [])
      setProductFolders(json?.productFolders || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch media")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMedia()
  }, [loadMedia])

  const rootCategoryCards = useMemo<FolderCard[]>(() => {
    const categoryCards = [...categoryFolders]
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((folder) => ({
        path: folder.path,
        label: folder.label || formatFolderLabel(folder.path),
        count: folder.productCount,
        kind: "category" as const,
      }))

    const specialRootCards = SPECIAL_ROOT_FOLDERS
      .filter((path) => folders.some((folder) => folder.name === path || folder.name.startsWith(`${path}/`)))
      .map((path) => ({
        path,
        label: formatFolderLabel(path),
        count: folders.filter((folder) => folder.name === path || folder.name.startsWith(`${path}/`)).length,
        kind: "category" as const,
      }))

    return [...categoryCards, ...specialRootCards]
  }, [categoryFolders, folders])

  const categoryOptions = useMemo(() => {
    if (selectedTopFolder === ALL_TOP) return [] as CategoryFolderMeta[]
    const childPaths = getImmediateChildPaths(
      folders.map((folder) => folder.name),
      selectedTopFolder
    ).filter((path) => !looksLikeSkuPath(path))

    return childPaths.map((path) => ({
      path,
      label: formatFolderLabel(path.split("/").pop() || path),
      count: 0,
      productCount: productFolders.filter((folder) => folder.categoryPath === path).length,
    }))
  }, [folders, productFolders, selectedTopFolder])

  const activeCategoryPath =
    selectedTopFolder === ALL_TOP
      ? ""
      : selectedCategoryFolder !== ALL_CATEGORY
        ? selectedCategoryFolder
        : selectedTopFolder

  const productFolderCards = useMemo<FolderCard[]>(() => {
    if (!activeCategoryPath) return []
    return getImmediateChildPaths(
      folders.map((folder) => folder.name),
      activeCategoryPath
    ).map((path) => {
      const hasChildren = folders.some((folder) => folder.name.startsWith(`${path}/`))
      const productMeta = productFolders.find((folder) => folder.path === path)
      return {
        path,
        label: productMeta?.sku || formatFolderLabel(path.split("/").pop() || path),
        count: productMeta?.count || folders.find((folder) => folder.name === path)?.count || 0,
        kind: (hasChildren ? "category" : "product") as FolderCard["kind"],
      }
    })
  }, [activeCategoryPath, folders, productFolders])

  const activeAssetFolder = selectedProductFolder || (activeCategoryPath && productFolderCards.length === 0 ? activeCategoryPath : "")

  const currentFolderCards = activeAssetFolder ? [] : activeCategoryPath ? productFolderCards : rootCategoryCards

  const filteredFolderCards = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    if (!normalizedSearch) return currentFolderCards
    return currentFolderCards.filter((folder) => folder.label.toLowerCase().includes(normalizedSearch))
  }, [currentFolderCards, searchTerm])

  const filteredAssets = useMemo(() => {
    if (!activeAssetFolder) return [] as Asset[]
    const normalizedSearch = searchTerm.trim().toLowerCase()
    return assets.filter((asset) => {
      const inFolder = asset.folder === activeAssetFolder || asset.folder.startsWith(`${activeAssetFolder}/`)
      if (!inFolder) return false
      if (!normalizedSearch) return true
      return (
        prettifyAssetName(asset).toLowerCase().includes(normalizedSearch) ||
        asset.name.toLowerCase().includes(normalizedSearch)
      )
    })
  }, [activeAssetFolder, assets, searchTerm])

  useEffect(() => {
    setSelectedCategoryFolder(ALL_CATEGORY)
    setSelectedProductFolder("")
    setSelectedFolderCard("")
    setSelectedUrls([])
    setSearchTerm("")
  }, [selectedTopFolder])

  useEffect(() => {
    setSelectedProductFolder("")
    setSelectedFolderCard("")
    setSelectedUrls([])
    setSearchTerm("")
  }, [selectedCategoryFolder])

  useEffect(() => {
    setSelectedFolderCard("")
    setSelectedUrls([])
    setSearchTerm("")
  }, [selectedProductFolder])

  const breadcrumbItems = useMemo(() => {
    const items = [{ label: "Media", value: "root" }]
    if (activeCategoryPath) {
      const categoryLabel =
        categoryFolders.find((folder) => folder.path === activeCategoryPath)?.label ||
        formatFolderLabel(activeCategoryPath.split("/").pop() || activeCategoryPath)
      items.push({ label: categoryLabel, value: activeCategoryPath as string })
    }
    if (selectedProductFolder) {
      items.push({
        label: selectedProductFolder.split("/").filter(Boolean).pop() || selectedProductFolder,
        value: selectedProductFolder ,
      })
    }
    return items
  }, [activeCategoryPath, categoryFolders, selectedProductFolder])

  const allFilteredSelected =
    selectedProductFolder.length > 0 &&
    filteredAssets.length > 0 &&
    filteredAssets.every((asset) => selectedUrls.includes(asset.url))

  const canGoBack = breadcrumbItems.length > 1

  const toggleSelectAll = () => {
    if (!selectedProductFolder || filteredAssets.length === 0) return
    if (allFilteredSelected) {
      const visibleUrls = new Set(filteredAssets.map((asset) => asset.url))
      setSelectedUrls((prev) => prev.filter((url) => !visibleUrls.has(url)))
      return
    }
    setSelectedUrls(Array.from(new Set(filteredAssets.map((asset) => asset.url))))
  }

  const openFolder = (folder: FolderCard) => {
    if (folder.kind === "category") {
      const topFolder = folder.path.split("/")[0] || folder.path
      setSelectedTopFolder(topFolder)
      setSelectedCategoryFolder(folder.path)
      setSelectedFolderCard(folder.path)
      return
    }
    setSelectedProductFolder(folder.path)
    setSelectedFolderCard(folder.path)
  }

  const navigateTo = (target: "root" | string) => {
    if (target === "root") {
      setSelectedTopFolder(ALL_TOP)
      setSelectedCategoryFolder(ALL_CATEGORY)
      setSelectedProductFolder("")
      setSelectedFolderCard("")
      return
    }
    const topFolder = target.split("/")[0] || target
    if (target === activeCategoryPath) {
      setSelectedTopFolder(topFolder)
      setSelectedCategoryFolder(target)
      setSelectedProductFolder("")
      setSelectedFolderCard("")
      return
    }
    setSelectedTopFolder(topFolder)
    setSelectedCategoryFolder(topFolder)
    setSelectedProductFolder(target)
    setSelectedFolderCard(target)
  }

  const handleNavigateBack = () => {
    if (!canGoBack) return
    const previous = breadcrumbItems[breadcrumbItems.length - 2]
    if (!previous) return
    navigateTo(previous.value)
  }

  const openFilePicker = () => {
    if (!selectedProductFolder && !activeCategoryPath) {
      toast.error("Open a category or SKU folder first")
      return
    }
    fileInputRef.current?.click()
  }

  const handleCreateFolder = async () => {
    const nextName = window.prompt("Folder name")
    if (!nextName?.trim()) return

    const parentFolder = selectedProductFolder || activeCategoryPath || ""
    setCreatingFolder(true)
    try {
      const res = await fetch("/api/admin/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parentFolder ? { parentFolder, name: nextName.trim() } : { name: nextName.trim() }),
      })
      const json = await res.json().catch(() => null as null | { error?: string; folder?: string })
      if (!res.ok || !json?.folder) throw new Error(json?.error || "Failed to create folder")
      toast.success("Folder created")
      await loadMedia()
      const createdFolder = json.folder
      const topFolder = createdFolder.split("/")[0] || createdFolder
      if (!createdFolder.includes("/")) {
        setSelectedTopFolder(topFolder)
        setSelectedCategoryFolder(topFolder)
        setSelectedFolderCard(topFolder)
      } else if ((selectedProductFolder || activeCategoryPath) === (createdFolder.split("/").slice(0, -1).join("/"))) {
        setSelectedFolderCard(createdFolder)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create folder")
    } finally {
      setCreatingFolder(false)
    }
  }

  const handleUpload = async (files: FileList | File[]) => {
    const targetFolder = selectedProductFolder || activeCategoryPath
    if (!targetFolder) {
      toast.error("Open a category or SKU folder first")
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
      toast.success(`${list.length} file(s) uploaded`)
      await loadMedia()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const deleteSelectedFolder = async () => {
    if (!selectedFolderCard || selectedProductFolder) return
    if (!window.confirm(`${selectedFolderCard} folder will be deleted. Continue?`)) return
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
    toast.success("Folder deleted")
    setSelectedFolderCard("")
    await loadMedia()
  }

  const deleteSelected = async () => {
    if (!selectedProductFolder && selectedFolderCard) {
      await deleteSelectedFolder()
      return
    }
    if (selectedUrls.length === 0) return
    if (!window.confirm(`${selectedUrls.length} file(s) will be deleted. Continue?`)) return

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
      toast.success(`${selectedUrls.length} file(s) deleted`)
      setSelectedUrls([])
      setPreviewAsset(null)
      await loadMedia()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed")
    } finally {
      setDeleting(false)
    }
  }

  const searchPlaceholder = selectedProductFolder
    ? "Search files in this SKU folder"
    : activeCategoryPath
      ? "Search SKU folders"
      : "Search categories"

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
        <Button type="button" variant="outline" className="h-12 px-5" onClick={handleCreateFolder} disabled={creatingFolder}>
          {creatingFolder ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderPlus className="mr-2 h-4 w-4" />}
          New folder
        </Button>
        <Button type="button" variant="outline" className="h-12 px-5" onClick={handleNavigateBack} disabled={!canGoBack}>
          Geri
        </Button>
        <Button type="button" className="h-12 px-5" onClick={openFilePicker} disabled={uploading}>
          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          Upload media
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-12 px-5"
          onClick={toggleSelectAll}
          disabled={!selectedProductFolder || filteredAssets.length === 0}
        >
          {allFilteredSelected ? "Clear Selection" : "Select All"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-12 px-5"
          onClick={deleteSelected}
          disabled={deleting || (selectedUrls.length === 0 && (!selectedFolderCard || Boolean(selectedProductFolder)))}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </div>

      <Card className="border border-[#dce3ed] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <CardContent className="space-y-6 p-6">
          <div className="grid gap-3 sm:grid-cols-[260px_260px_minmax(220px,1fr)]">
            <Select value={selectedTopFolder} onValueChange={setSelectedTopFolder}>
              <SelectTrigger className="h-12 border-[#cfd9e4] bg-white text-[15px]">
                <SelectValue placeholder="Category folders" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_TOP}>All categories</SelectItem>
                {rootCategoryCards.map((folder) => (
                  <SelectItem key={folder.path} value={folder.path}>
                    {folder.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedCategoryFolder}
              onValueChange={setSelectedCategoryFolder}
              disabled={selectedTopFolder === ALL_TOP}
            >
              <SelectTrigger className="h-12 border-[#cfd9e4] bg-white text-[15px]">
                <SelectValue placeholder="Category level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CATEGORY}>Current category</SelectItem>
                {categoryOptions.map((folder) => (
                  <SelectItem key={folder.path} value={folder.path}>
                    {folder.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-12 border-[#cfd9e4] bg-white text-[15px]"
            />
          </div>

          {breadcrumbItems.length > 1 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#dce3ed] bg-[#f8fafc] px-4 py-3 text-sm">
              {breadcrumbItems.map((item, index) => (
                <div key={`${item.value}-${index}`} className="flex items-center gap-2">
                  {index > 0 ? <ChevronRight className="h-4 w-4 text-slate-400" /> : null}
                  <button
                    type="button"
                    onClick={() => navigateTo(item.value)}
                    className="font-medium text-slate-700 transition-colors hover:text-slate-900"
                  >
                    {item.label}
                  </button>
                </div>
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
          ) : !activeAssetFolder && filteredFolderCards.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {filteredFolderCards.map((folder) => (
                <button
                  key={folder.path}
                  type="button"
                  onClick={() => setSelectedFolderCard(folder.path)}
                  onDoubleClick={() => openFolder(folder)}
                  className={`flex min-h-[148px] flex-col items-start justify-between rounded-2xl border bg-white p-4 text-left transition hover:border-slate-300 ${
                    selectedFolderCard === folder.path ? "border-teal-500 ring-2 ring-teal-200" : "border-[#dce3ed]"
                  }`}
                >
                  <Folder className="h-8 w-8 text-amber-500" />
                  <div className="space-y-1">
                    <p className="truncate text-sm font-medium text-slate-900">{folder.label}</p>
                    {folder.kind === "category" ? (
                      <>
                        <p className="text-xs text-slate-500">{folder.path.includes("/") ? "Folder" : "Category folder"}</p>
                        <p className="text-xs text-slate-500">
                          {folder.path.includes("/") ? `${folder.count} ${folder.count === 1 ? "item" : "items"}` : formatProductCount(folder.count)}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-slate-500">
                        SKU folder{folder.count > 0 ? ` (${folder.count})` : ""}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : activeAssetFolder ? (
            filteredAssets.length > 0 ? (
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
                        <p className="truncate text-xs text-slate-500">{asset.name}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#d7dee8] bg-[#f8fafc] text-slate-500">
                <ImageIcon className="mb-3 h-10 w-10 text-slate-300" />
                        No files found in this folder
              </div>
            )
          ) : (
            <div className="flex h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#d7dee8] bg-[#f8fafc] text-slate-500">
              <Folder className="mb-3 h-10 w-10 text-slate-300" />
              {activeCategoryPath ? "No SKU folders found in this category" : "No category folders found"}
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
