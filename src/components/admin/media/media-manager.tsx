"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  FolderPlus,
  Upload,
  Image as ImageIcon,
  RefreshCw,
  Eye,
  Copy,
  Trash2,
  FolderInput,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

const FOLDER_LABELS: Record<string, string> = {
  "by-type": "By Type",
  "by-style": "By Style",
  "by-size": "By Size",
  "by-color": "By Color",
  "by-age": "By Age",
  "cushion-covers": "Cushion Covers",
  categories: "Categories",
  pages: "Pages",
  profile: "Profil",
}

function folderLabel(value: string) {
  const raw = value.trim()
  if (!raw) return value

  const direct = FOLDER_LABELS[raw]
  if (direct) return direct

  const parts = raw.split("/").filter(Boolean)
  const leaf = parts[parts.length - 1] || raw

  const numberedMatch = leaf.match(/^(.*?)-(\d+)$/)
  const baseLeaf = numberedMatch?.[1] || leaf
  const suffix = numberedMatch?.[2] || ""
  const mappedBase = FOLDER_LABELS[baseLeaf]

  const humanizedBase = (mappedBase || baseLeaf)
    .split("-")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ")

  return suffix ? `${humanizedBase} ${suffix}` : humanizedBase
}

function folderLeafName(folderPath: string) {
  const parts = folderPath.split("/").filter(Boolean)
  return parts[parts.length - 1] || folderPath
}

function FolderTile({ label }: { label: string }) {
  return (
    <div className="inline-flex flex-col items-center gap-2">
      <div className="relative h-14 w-16 rounded-md bg-[#f2c300] shadow-inner">
        <div className="absolute left-1.5 top-1.5 h-2.5 w-7 rounded-sm bg-[#ffd94d]" />
        <div className="absolute inset-x-1.5 top-4 h-8 rounded-sm bg-[#f6d428]" />
      </div>
      <span className="max-w-[92px] truncate text-center text-xs font-medium text-slate-800">{label}</span>
    </div>
  )
}

export function MediaManager() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [activeFolder, setActiveFolder] = useState<string>("all")
  const [activeSubfolder, setActiveSubfolder] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [newFolderName, setNewFolderName] = useState("")
  const [newFolderParent, setNewFolderParent] = useState("")
  const [selectedUploadFolder, setSelectedUploadFolder] = useState("categories")
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [managingAsset, setManagingAsset] = useState<Asset | null>(null)
  const [targetFolder, setTargetFolder] = useState("categories")
  const [assetLoading, setAssetLoading] = useState(false)
  const [selectedAssetUrls, setSelectedAssetUrls] = useState<string[]>([])
  const [bulkLoading, setBulkLoading] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [deleteFolderModalOpen, setDeleteFolderModalOpen] = useState(false)
  const [deletingFolder, setDeletingFolder] = useState(false)
  const [renamingSubfolder, setRenamingSubfolder] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [renamingFolder, setRenamingFolder] = useState(false)
  const [showCreateForFolder, setShowCreateForFolder] = useState<string | null>(null)

  const cardSurface =
    "bg-white border border-[#dce3ed] shadow-[0_8px_24px_rgba(15,23,42,0.05)]"

  const loadMedia = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/media", { cache: "no-store" })
      const json = await res.json().catch(() => null as null | { error?: string; folders?: Folder[]; assets?: Asset[] })
      if (!res.ok) throw new Error(json?.error || "Failed to fetch media")
      const nextFolders = json?.folders || []
      const nextAssets = json?.assets || []
      setFolders(nextFolders)
      setAssets(nextAssets)
      if (!nextFolders.some((f: Folder) => f.name === selectedUploadFolder)) {
        setSelectedUploadFolder(nextFolders[0]?.name || "categories")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch media")
    } finally {
      setLoading(false)
    }
  }, [selectedUploadFolder])

  useEffect(() => {
    loadMedia()
  }, [loadMedia])

  const topFolders = useMemo(() => {
    const counts = new Map<string, number>()
    for (const folder of folders) {
      const top = folder.name.split("/")[0] || folder.name
      counts.set(top, (counts.get(top) || 0) + folder.count)
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [folders])

  const folderCountMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const folder of folders) {
      map.set(folder.name, folder.count)
    }
    return map
  }, [folders])

  useEffect(() => {
    if (activeFolder !== "all") {
      setNewFolderParent(activeFolder)
      return
    }
    if (!newFolderParent && topFolders.length > 0) {
      setNewFolderParent(topFolders[0].name)
    }
  }, [activeFolder, newFolderParent, topFolders])

  useEffect(() => {
    setRenamingSubfolder(null)
    setRenameValue("")
  }, [activeFolder])

  const filteredAssets = useMemo(() => {
    const term = search.trim().toLowerCase()
    return assets.filter((asset) => {
      const inFolder =
        activeFolder === "all"
          ? true
          : activeSubfolder === "all"
            ? asset.folder === activeFolder || asset.folder.startsWith(`${activeFolder}/`)
            : asset.folder === activeSubfolder || asset.folder.startsWith(`${activeSubfolder}/`)
      const inSearch =
        !term ||
        asset.name.toLowerCase().includes(term) ||
        asset.usedIn.toLowerCase().includes(term) ||
        asset.source.toLowerCase().includes(term)
      return inFolder && inSearch
    })
  }, [activeFolder, activeSubfolder, assets, search])

  const folderOptions = useMemo(() => {
    const names = Array.from(new Set(folders.map((f) => f.name)))
    return names.map((name) => ({ name }))
  }, [folders])

  const selectedInView = useMemo(
    () => filteredAssets.filter((asset) => selectedAssetUrls.includes(asset.url)),
    [filteredAssets, selectedAssetUrls]
  )

  const allSelectedInView =
    filteredAssets.length > 0 && selectedInView.length === filteredAssets.length

  const createFolder = async () => {
    const name = newFolderName.trim()
    if (!name || !newFolderParent) return
    setCreatingFolder(true)
    try {
      const res = await fetch("/api/admin/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentFolder: newFolderParent }),
      })
      const json = await res.json().catch(() => null as null | { error?: string; folder?: string })
      if (!res.ok) throw new Error(json?.error || "Failed to create folder")
      toast.success("Folder created")
      setNewFolderName("")
      if (json?.folder) {
        const createdFolder = json.folder
        setFolders((prev) => {
          if (prev.some((folder) => folder.name === createdFolder)) return prev
          return [...prev, { name: createdFolder, count: 0 }]
        })
        const top = createdFolder.split("/")[0] || createdFolder
        setActiveFolder(top)
        setActiveSubfolder(createdFolder)
        setSelectedUploadFolder(createdFolder)
        setTargetFolder(createdFolder)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create folder")
    } finally {
      setCreatingFolder(false)
    }
  }

  const toggleSelect = (url: string) => {
    setSelectedAssetUrls((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]
    )
  }

  const toggleSelectAllCurrent = () => {
    if (allSelectedInView) {
      const viewSet = new Set(filteredAssets.map((a) => a.url))
      setSelectedAssetUrls((prev) => prev.filter((u) => !viewSet.has(u)))
      return
    }

    setSelectedAssetUrls((prev) => {
      const next = new Set(prev)
      for (const asset of filteredAssets) next.add(asset.url)
      return Array.from(next)
    })
  }

  const copyAssetUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success("URL copied")
    } catch {
      toast.error("Could not copy URL")
    }
  }

  const moveAsset = async () => {
    if (!managingAsset) return
    setAssetLoading(true)
    try {
      const res = await fetch("/api/admin/media", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: managingAsset.url,
          targetFolder,
        }),
      })
      const json = await res.json().catch(() => null as null | { error?: string })
      if (!res.ok) throw new Error(json?.error || "Failed to move file")
      toast.success("File moved")
      setManagingAsset(null)
      await loadMedia()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to move file")
    } finally {
      setAssetLoading(false)
    }
  }

  const deleteAsset = async () => {
    if (!managingAsset) return
    if (!confirm("Bu dosya silinsin mi?")) return
    setAssetLoading(true)
    try {
      const res = await fetch("/api/admin/media", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: managingAsset.url }),
      })
      const json = await res.json().catch(() => null as null | { error?: string })
      if (!res.ok) throw new Error(json?.error || "Failed to delete file")
      toast.success("File deleted")
      setManagingAsset(null)
      await loadMedia()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete file")
    } finally {
      setAssetLoading(false)
    }
  }

  const bulkMove = async () => {
    if (selectedInView.length === 0) return
    const uploadOnly = selectedInView.filter((a) => isManagedUploadUrl(a.url))
    if (uploadOnly.length === 0) {
      toast.error("Secili dosyalarin hicbiri /uploads altinda degil")
      return
    }
    setBulkLoading(true)
    try {
      for (const asset of uploadOnly) {
        const res = await fetch("/api/admin/media", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: asset.url, targetFolder }),
        })
        const json = await res.json().catch(() => null as null | { error?: string })
        if (!res.ok) throw new Error(json?.error || "Failed to move selected files")
      }
      toast.success(`${uploadOnly.length} dosya tasindi`)
      setSelectedAssetUrls([])
      await loadMedia()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Toplu tasima basarisiz")
    } finally {
      setBulkLoading(false)
    }
  }

  const bulkDelete = async () => {
    if (selectedInView.length === 0) return
    const uploadOnly = selectedInView.filter((a) => isManagedUploadUrl(a.url))
    if (uploadOnly.length === 0) {
      toast.error("Secili dosyalarin hicbiri /uploads altinda degil")
      return
    }
    if (!confirm(`${uploadOnly.length} dosya silinsin mi?`)) return
    setBulkLoading(true)
    try {
      for (const asset of uploadOnly) {
        const res = await fetch("/api/admin/media", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: asset.url }),
        })
        const json = await res.json().catch(() => null as null | { error?: string })
        if (!res.ok) throw new Error(json?.error || "Failed to delete selected files")
      }
      toast.success(`${uploadOnly.length} dosya silindi`)
      setSelectedAssetUrls([])
      await loadMedia()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Toplu silme basarisiz")
    } finally {
      setBulkLoading(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const data = new FormData()
        data.append("file", file)
        data.append("folder", selectedUploadFolder)
        const res = await fetch("/api/upload", {
          method: "POST",
          body: data,
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || "Upload failed")
      }
      toast.success("Files uploaded")
      await loadMedia()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  const folderToDelete = activeSubfolder !== "all" ? activeSubfolder : activeFolder !== "all" ? activeFolder : ""
  const deleteTargets = folderToDelete ? [folderToDelete] : []

  const startRename = (folderPath: string) => {
    setRenamingSubfolder(folderPath)
    setRenameValue(folderLeafName(folderPath))
  }

  const submitRename = async () => {
    if (!renamingSubfolder) return
    const value = renameValue.trim()
    if (!value) {
      toast.error("Folder name is required")
      return
    }
    setRenamingFolder(true)
    try {
      const res = await fetch("/api/admin/media/folders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: renamingSubfolder, newName: value }),
      })
      const json = (await res.json().catch(() => null)) as { error?: string; folder?: string } | null
      if (!res.ok) throw new Error(json?.error || "Failed to rename folder")
      toast.success("Folder renamed")
      setRenamingSubfolder(null)
      setRenameValue("")
      if (json?.folder) {
        setActiveSubfolder(json.folder)
        setSelectedUploadFolder(json.folder)
        setTargetFolder(json.folder)
      }
      await loadMedia()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to rename folder")
    } finally {
      setRenamingFolder(false)
    }
  }

  const deleteSelectedFolder = async () => {
    if (deleteTargets.length === 0) return
    setDeletingFolder(true)
    try {
      for (const folder of deleteTargets) {
        const res = await fetch("/api/admin/media/folders", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folder }),
        })
        const json = (await res.json().catch(() => null)) as { error?: string } | null
        if (!res.ok) throw new Error(json?.error || "Failed to delete folder")
      }
      toast.success(`${deleteTargets.length} folder deleted`)
      setDeleteFolderModalOpen(false)
      setFolders((prev) =>
        prev.filter((folder) => !deleteTargets.some((target) => folder.name === target || folder.name.startsWith(`${target}/`)))
      )
      setAssets((prev) =>
        prev.filter((asset) => !deleteTargets.some((target) => asset.folder === target || asset.folder.startsWith(`${target}/`)))
      )
      if (deleteTargets.some((target) => activeSubfolder === target || activeSubfolder.startsWith(`${target}/`))) {
        setActiveSubfolder("all")
      }
      if (deleteTargets.some((target) => selectedUploadFolder === target || selectedUploadFolder.startsWith(`${target}/`))) {
        setSelectedUploadFolder(activeFolder !== "all" ? activeFolder : "categories")
      }
      if (deleteTargets.some((target) => targetFolder === target || targetFolder.startsWith(`${target}/`))) {
        setTargetFolder(activeFolder !== "all" ? activeFolder : "categories")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete folder")
    } finally {
      setDeletingFolder(false)
    }
  }

  const optimizeImages = async () => {
    setOptimizing(true)
    try {
      const res = await fetch("/api/admin/media/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: activeFolder }),
      })
      const json = (await res.json().catch(() => null)) as
        | { error?: string; optimized?: number; processed?: number; bytesSaved?: number }
        | null
      if (!res.ok) throw new Error(json?.error || "Failed to optimize images")
      const optimizedCount = Number(json?.optimized || 0)
      const processedCount = Number(json?.processed || 0)
      const savedKb = Number(json?.bytesSaved || 0) / 1024
      toast.success(
        `${optimizedCount} / ${processedCount} images optimized${savedKb > 0 ? ` (${savedKb.toFixed(1)} KB saved)` : ""}`
      )
      await loadMedia()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to optimize images")
    } finally {
      setOptimizing(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className={cardSurface}>
        <CardHeader>
          <CardTitle className="text-slate-900 text-lg">Folders</CardTitle>
          <div className="flex justify-end">
            {activeSubfolder !== "all" && activeFolder !== "all" ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => startRename(activeSubfolder)}
              >
                Rename
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (activeFolder === "all") {
                  toast.error("Once bir ana klasor secin")
                  return
                }
                setNewFolderParent(activeFolder)
                setShowCreateForFolder(activeFolder)
              }}
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              Klasor Olustur
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {topFolders.map((folder) => {
              const isOpen = activeFolder === folder.name
              return (
                <button
                  key={folder.name}
                  type="button"
                  className={`rounded-lg border bg-white p-3 text-left transition ${
                    isOpen ? "border-teal-400 ring-2 ring-teal-200" : "border-[#dce3ed] hover:border-slate-300"
                  }`}
                  onClick={() => {
                    const willOpen = activeFolder !== folder.name
                    if (!willOpen) {
                      setActiveFolder("all")
                      setActiveSubfolder("all")
                      setShowCreateForFolder(null)
                      return
                    }
                    setActiveFolder(folder.name)
                    setActiveSubfolder("all")
                    setSelectedUploadFolder(folder.name)
                    setTargetFolder(folder.name)
                    setNewFolderParent(folder.name)
                  }}
                >
                  <div className="flex items-center justify-between">
                    <FolderTile label={folderLabel(folder.name)} />
                    <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">{folder.count}</span>
                  </div>
                </button>
              )
            })}
          </div>

          {activeFolder !== "all" ? (
            <div className="rounded-lg border border-[#edf1f5] bg-white px-3 py-3 space-y-3">
              {showCreateForFolder === activeFolder ? (
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
                  <Input
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder={`New folder under ${folderLabel(activeFolder)}`}
                    className="bg-white border-[#dce3ed] text-slate-900 placeholder:text-slate-400"
                  />
                  <Button type="button" onClick={createFolder} disabled={creatingFolder}>
                    <FolderPlus className="h-4 w-4 mr-2" />
                    {creatingFolder ? "Creating..." : "Create"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCreateForFolder(null)
                      setNewFolderName("")
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveSubfolder("all")}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                    activeSubfolder === "all"
                      ? "border-teal-500 bg-teal-50 text-teal-700"
                      : "border-[#dce3ed] bg-white text-slate-700"
                  }`}
                >
                  All
                </button>
                {folders
                  .map((item) => item.name)
                  .filter((name) => name !== activeFolder && name.startsWith(`${activeFolder}/`))
                  .sort((a, b) => a.localeCompare(b))
                  .map((folderPath) => (
                    <div
                      key={folderPath}
                      className={`inline-flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${
                        activeSubfolder === folderPath
                          ? "border-teal-500 bg-teal-50 text-teal-700"
                          : "border-[#dce3ed] bg-white text-slate-700"
                      }`}
                    >
                      {renamingSubfolder === folderPath ? (
                        <Input
                          value={renameValue}
                          onChange={(event) => setRenameValue(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault()
                              void submitRename()
                            }
                            if (event.key === "Escape") {
                              setRenamingSubfolder(null)
                              setRenameValue("")
                            }
                          }}
                          onBlur={() => void submitRename()}
                          className="h-7 w-36 border-[#dce3ed] bg-white text-xs"
                          autoFocus
                          disabled={renamingFolder}
                        />
                      ) : (
                        <button
                          type="button"
                          className="text-left"
                          onClick={() => {
                            setActiveSubfolder(folderPath)
                            setSelectedUploadFolder(folderPath)
                            setTargetFolder(folderPath)
                          }}
                        >
                          {folderLabel(folderLeafName(folderPath))}
                        </button>
                      )}
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                        {folderCountMap.get(folderPath) || 0}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-end">
            {deleteTargets.length > 0 ? (
              <Button type="button" variant="destructive" onClick={() => setDeleteFolderModalOpen(true)}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className={cardSurface}>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:max-w-2xl">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search media..."
                className="bg-white border-[#dce3ed] text-slate-900 placeholder:text-slate-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedUploadFolder} onValueChange={setSelectedUploadFolder}>
                <SelectTrigger className="bg-white border-[#dce3ed] text-slate-900 min-w-[220px]">
                  <SelectValue placeholder="Select folder" />
                </SelectTrigger>
                <SelectContent>
                  {folderOptions.map((folder) => (
                    <SelectItem key={folder.name} value={folder.name}>
                      {folderLabel(folder.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={optimizeImages} disabled={optimizing || uploading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${optimizing ? "animate-spin" : ""}`} />
                {optimizing ? "Optimizing..." : "Optimize Images"}
              </Button>
              <label className="inline-flex">
                <input
                  type="file"
                  className="hidden"
                  multiple
                  accept="image/*"
                  onChange={handleUpload}
                />
                <span className="inline-flex h-10 items-center rounded-md bg-slate-800 px-4 text-sm font-medium text-slate-50 hover:bg-slate-900 cursor-pointer">
                  <Upload className="mr-2 h-4 w-4" />
                  {uploading ? "Uploading..." : "Upload"}
                </span>
              </label>
              <Button type="button" variant="outline" onClick={loadMedia}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={cardSurface}>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="text-slate-900 text-lg">
              {activeFolder === "all"
                ? "All Files"
                : activeSubfolder !== "all"
                  ? `${folderLabel(folderLeafName(activeSubfolder))} Folder`
                  : `${folderLabel(activeFolder)} Folder`}
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-md border border-[#dce3ed] px-3 py-2 bg-white">
                <Checkbox
                  checked={allSelectedInView}
                  onCheckedChange={toggleSelectAllCurrent}
                />
                <span className="text-sm text-slate-700 whitespace-nowrap">Hepsini sec</span>
              </div>
              <Select value={targetFolder} onValueChange={setTargetFolder}>
                <SelectTrigger className="bg-white border-[#dce3ed] text-slate-900 min-w-[180px]">
                  <SelectValue placeholder="Hedef klasor" />
                </SelectTrigger>
                <SelectContent>
                  {folderOptions.map((folder) => (
                    <SelectItem key={folder.name} value={folder.name}>
                      {folderLabel(folder.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" onClick={bulkMove} disabled={bulkLoading || selectedInView.length === 0}>
                <FolderInput className="h-4 w-4 mr-2" />
                Toplu Tasi ({selectedInView.length})
              </Button>
              <Button type="button" variant="destructive" onClick={bulkDelete} disabled={bulkLoading || selectedInView.length === 0}>
                <Trash2 className="h-4 w-4 mr-2" />
                Toplu Sil
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="py-10 text-center text-slate-500">Loading media...</div>
          ) : filteredAssets.length === 0 ? (
            <div className="py-10 text-center text-slate-500">No media found.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
              {filteredAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="rounded-lg border border-[#dce3ed] bg-white overflow-hidden"
                >
                  <div className="aspect-square bg-slate-100 relative">
                    <div className="absolute top-2 left-2 z-10 rounded bg-white/95 p-1 border border-[#dce3ed]">
                      <Checkbox
                        checked={selectedAssetUrls.includes(asset.url)}
                        onCheckedChange={() => toggleSelect(asset.url)}
                      />
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.url}
                      alt={asset.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-3 space-y-2">
                    <p className="text-sm font-medium text-slate-900 truncate">{asset.name}</p>
                    <p className="text-xs text-slate-600 truncate">{asset.folder}</p>
                    <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                      <ImageIcon className="h-3 w-3" />
                      {asset.source}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setManagingAsset(asset)
                        setTargetFolder(asset.folder || selectedUploadFolder)
                      }}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Manage
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(managingAsset)} onOpenChange={(open) => !open && setManagingAsset(null)}>
        <DialogContent className="bg-white border-[#dce3ed] max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-slate-900">File Actions</DialogTitle>
          </DialogHeader>
          {managingAsset && (
            <div className="space-y-4">
              <div className="rounded-md border border-[#dce3ed] bg-slate-50 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={managingAsset.url}
                  alt={managingAsset.name}
                  className="h-72 w-full object-contain bg-white"
                />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">{managingAsset.name}</p>
                <p className="text-xs text-slate-600">{managingAsset.usedIn}</p>
                <p className="text-xs text-slate-500 mt-1 break-all">{managingAsset.url}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => copyAssetUrl(managingAsset.url)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy URL
                </Button>
                <a
                  href={managingAsset.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center rounded-md border border-slate-700 bg-slate-800 px-4 text-sm font-medium text-slate-50 hover:bg-slate-900"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Open
                </a>
              </div>

              {isManagedUploadUrl(managingAsset.url) ? (
                <>
                  <div className="rounded-md border border-[#dce3ed] p-3 space-y-2">
                    <p className="text-sm font-medium text-slate-900">Move to folder</p>
                    <div className="flex gap-2">
                      <Select value={targetFolder} onValueChange={setTargetFolder}>
                        <SelectTrigger className="bg-white border-[#dce3ed] text-slate-900">
                          <SelectValue placeholder="Select folder" />
                        </SelectTrigger>
                        <SelectContent>
                          {folderOptions.map((folder) => (
                            <SelectItem key={folder.name} value={folder.name}>
                              {folderLabel(folder.name)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        onClick={moveAsset}
                        disabled={assetLoading || !targetFolder}
                      >
                        <FolderInput className="h-4 w-4 mr-2" />
                        Move
                      </Button>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="destructive"
                    onClick={deleteAsset}
                    disabled={assetLoading}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete File
                  </Button>
                </>
              ) : (
                <p className="text-xs text-slate-500">
                  Bu dosya referans dosyasıdır. Sadece `/uploads` altındaki yüklenen dosyalarda taşı/sil işlemi yapılır.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteFolderModalOpen} onOpenChange={setDeleteFolderModalOpen}>
        <DialogContent className="bg-white border-[#dce3ed] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-900">Emin misiniz?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            <span className="font-medium text-slate-900">{folderToDelete} folder will be deleted.</span>
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDeleteFolderModalOpen(false)} disabled={deletingFolder}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={deleteSelectedFolder} disabled={deletingFolder}>
              {deletingFolder ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
