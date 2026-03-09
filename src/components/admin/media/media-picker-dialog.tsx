"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Loader2, Upload, Image as ImageIcon, Check, Folder } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getImageUrl, isManagedUploadUrl } from "@/lib/storage/url"

type Folder = { name: string; count: number }
type Asset = {
  id: string
  url: string
  name: string
  folder: string
  source: string
  usedIn: string
  createdAt?: number
  sizeBytes?: number
}

type TabKey = "upload" | "library"

type MediaPickerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  multiple?: boolean
  onSelect: (urls: string[]) => void
  title?: string
  productMeta?: {
    title?: string
    sku?: string
    description?: string
  }
}

const FOLDER_COLOR_KEY = "media-picker-folder-colors"
const ASSET_LABEL_KEY = "media-picker-asset-labels"
const FOLDER_COLOR_OPTIONS = ["#f59e0b", "#ef4444", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b"]

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

function normalizePickerAssetUrl(url: string) {
  const value = (url || "").trim()
  if (!value) return ""
  const normalized = getImageUrl(value)
  if (normalized !== value) return normalized
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) return value
  if (value.startsWith("uploads/")) return `/${value}`
  return value
}

export function MediaPickerDialog({
  open,
  onOpenChange,
  multiple = false,
  onSelect,
  title = "Media Library",
  productMeta,
}: MediaPickerDialogProps) {
  const [tab, setTab] = useState<TabKey>("library")
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [search, setSearch] = useState("")
  const [activeFolder, setActiveFolder] = useState("all")
  const [activeSubfolder, setActiveSubfolder] = useState("all")
  const [uploadFolder, setUploadFolder] = useState("categories")
  const [folders, setFolders] = useState<Folder[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [selectedUrls, setSelectedUrls] = useState<string[]>([])
  const [didAutoPickFolder, setDidAutoPickFolder] = useState(false)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [moving, setMoving] = useState(false)
  const [targetFolder, setTargetFolder] = useState("categories")
  const [folderMenu, setFolderMenu] = useState<{ folder: string; x: number; y: number } | null>(null)
  const [folderColors, setFolderColors] = useState<Record<string, string>>({})
  const [assetLabels, setAssetLabels] = useState<Record<string, string>>({})
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [selectedRightFolders, setSelectedRightFolders] = useState<string[]>([])
  const [draggingUrls, setDraggingUrls] = useState<string[]>([])
  const [dragTargetFolder, setDragTargetFolder] = useState<string | null>(null)
  const [hiddenDeletedUrls, setHiddenDeletedUrls] = useState<string[]>([])
  const [selectedAssetDimensions, setSelectedAssetDimensions] = useState<{ width: number; height: number } | null>(null)
  const dialogContentRef = useRef<HTMLDivElement | null>(null)
  const libraryScrollRef = useRef<HTMLDivElement | null>(null)
  const deleteTimeoutsRef = useRef<Record<string, number>>({})

  const loadMedia = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/media", { cache: "no-store" })
      const json = await res.json().catch(() => null as null | { error?: string; folders?: Folder[]; assets?: Asset[] })
      if (!res.ok) throw new Error(json?.error || "Failed to fetch media")
      const nextFolders: Folder[] = json?.folders ?? []
      const nextAssets: Asset[] = (json?.assets ?? []).map((asset: Asset) => ({
        ...asset,
        url: normalizePickerAssetUrl(asset.url),
      }))
      setFolders(nextFolders)
      setAssets(nextAssets)
      if (!nextFolders.some((folder) => folder.name === uploadFolder)) {
        setUploadFolder(nextFolders[0]?.name || "categories")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch media")
    } finally {
      setLoading(false)
    }
  }, [uploadFolder])

  useEffect(() => {
    if (!open) return
    loadMedia()
  }, [open, loadMedia])

  useEffect(() => {
    const raw = window.localStorage.getItem(FOLDER_COLOR_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as Record<string, string>
      setFolderColors(parsed)
    } catch {
      setFolderColors({})
    }
  }, [])

  useEffect(() => {
    const raw = window.localStorage.getItem(ASSET_LABEL_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as Record<string, string>
      setAssetLabels(parsed)
    } catch {
      setAssetLabels({})
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(FOLDER_COLOR_KEY, JSON.stringify(folderColors))
  }, [folderColors])

  useEffect(() => {
    window.localStorage.setItem(ASSET_LABEL_KEY, JSON.stringify(assetLabels))
  }, [assetLabels])

  useEffect(() => {
    if (!open) {
      setSelectedUrls([])
      setSearch("")
      setTab("library")
      setActiveFolder("all")
      setActiveSubfolder("all")
      setDidAutoPickFolder(false)
      setFolderMenu(null)
      setShowColorPicker(false)
      setSelectedFolder(null)
      setSelectedRightFolders([])
      setDraggingUrls([])
      setDragTargetFolder(null)
      setHiddenDeletedUrls([])
    }
  }, [open])

  const directSubfolders = useMemo(() => {
    if (activeFolder === "all") return [] as string[]
    const prefix = `${activeFolder}/`
    return folders
      .map((folder) => folder.name)
      .filter((name) => name.startsWith(prefix))
      .map((name) => name.slice(prefix.length))
      .filter((rest) => rest.length > 0 && !rest.includes("/"))
      .map((leaf) => `${activeFolder}/${leaf}`)
      .sort((a, b) => a.localeCompare(b))
  }, [activeFolder, folders])

  const currentPath = useMemo(() => {
    if (activeSubfolder !== "all") return activeSubfolder
    if (activeFolder !== "all") return activeFolder
    return ""
  }, [activeFolder, activeSubfolder])

  const rightPaneFolders = useMemo(() => {
    if (!currentPath || activeFolder === "all") return [] as string[]
    const prefix = `${currentPath}/`
    const directChildren = folders
      .map((folder) => folder.name)
      .filter((name) => name.startsWith(prefix))
      .map((name) => name.slice(prefix.length))
      .filter((rest) => rest.length > 0 && !rest.includes("/"))
      .map((leaf) => `${currentPath}/${leaf}`)
      .sort((a, b) => a.localeCompare(b))

    // Keep subcategories only in left pane; do not repeat them in right pane
    if (activeSubfolder === "all") {
      return directChildren.filter((name) => !directSubfolders.includes(name))
    }
    return directChildren
  }, [activeFolder, activeSubfolder, currentPath, directSubfolders, folders])

  const uniqueAssets = useMemo(() => {
    const map = new Map<string, Asset>()
    for (const asset of assets) {
      if (!asset.url) continue
      if (!map.has(asset.url)) map.set(asset.url, asset)
    }
    return Array.from(map.values())
  }, [assets])

  const imageAssets = useMemo(() => {
    const hiddenUrls = new Set(hiddenDeletedUrls)
    return uniqueAssets.filter((asset) => {
      if (hiddenUrls.has(asset.url)) return false
      const clean = asset.url.split("?")[0].toLowerCase()
      return clean.endsWith(".jpg") || clean.endsWith(".jpeg") || clean.endsWith(".png") || clean.endsWith(".webp") || clean.endsWith(".avif") || clean.endsWith(".gif")
    })
  }, [hiddenDeletedUrls, uniqueAssets])

  const folderImageCountMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const asset of imageAssets) {
      if (!isManagedUploadUrl(asset.url)) continue
      const folder = asset.folder
      map.set(folder, (map.get(folder) || 0) + 1)
      const parts = folder.split("/").filter(Boolean)
      for (let i = parts.length - 1; i >= 1; i -= 1) {
        const parent = parts.slice(0, i).join("/")
        map.set(parent, (map.get(parent) || 0) + 1)
      }
    }
    return map
  }, [imageAssets])

  const topFolders = useMemo(() => {
    const names = new Set<string>()
    for (const folder of folders) {
      const top = folder.name.split("/")[0] || folder.name
      if (top) names.add(top)
    }
    const normalFolders = Array.from(names)
      .map((name) => ({ name, count: folderImageCountMap.get(name) || 0 }))
      .sort((a, b) => a.name.localeCompare(b.name))
    return [{ name: "all", count: imageAssets.length }, ...normalFolders]
  }, [folderImageCountMap, folders, imageAssets.length])

  useEffect(() => {
    if (!open) return
    if (activeFolder !== "all") return
    if (didAutoPickFolder) return
    if (topFolders.length === 0) return
    setActiveFolder(topFolders[0].name)
    setActiveSubfolder("all")
    setUploadFolder(topFolders[1]?.name || "categories")
    setTargetFolder(topFolders[1]?.name || "categories")
    setDidAutoPickFolder(true)
  }, [open, activeFolder, didAutoPickFolder, topFolders])

  const filteredAssets = useMemo(() => {
    const term = search.trim().toLowerCase()
    return imageAssets.filter((asset) => {
      const inFolder =
        activeFolder === "all"
          ? true
          : activeSubfolder === "all"
            ? asset.folder === activeFolder
            : asset.folder === activeSubfolder
      const inSearch = !term || asset.name.toLowerCase().includes(term) || asset.usedIn.toLowerCase().includes(term)
      return inFolder && inSearch
    })
  }, [activeFolder, activeSubfolder, imageAssets, search])

  const sortedFilteredAssets = useMemo(() => {
    return [...filteredAssets].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }, [filteredAssets])

  const selectedAsset = useMemo(() => {
    if (selectedUrls.length === 0) return null
    return imageAssets.find((asset) => asset.url === selectedUrls[0]) || null
  }, [imageAssets, selectedUrls])

  useEffect(() => {
    if (!selectedAsset?.url) {
      setSelectedAssetDimensions(null)
      return
    }

    const img = new window.Image()
    img.onload = () => {
      setSelectedAssetDimensions({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      setSelectedAssetDimensions(null)
    }
    img.src = selectedAsset.url
  }, [selectedAsset?.url])

  const selectedAssetDate = useMemo(() => {
    if (!selectedAsset?.createdAt) return null
    return new Date(selectedAsset.createdAt).toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }, [selectedAsset?.createdAt])

  const selectedAssetSize = useMemo(() => {
    if (!selectedAsset?.sizeBytes) return null
    if (selectedAsset.sizeBytes >= 1024 * 1024) {
      return `${(selectedAsset.sizeBytes / (1024 * 1024)).toFixed(2)} MB`
    }
    return `${Math.max(1, Math.round(selectedAsset.sizeBytes / 1024))} KB`
  }, [selectedAsset?.sizeBytes])

  const getAssetLabelGroup = useCallback((asset: Asset) => {
    const folderLeaf = asset.folder.split("/").filter(Boolean).pop() || asset.folder
    return folderLeaf || (productMeta?.sku?.trim() || "")
  }, [productMeta?.sku])

  const selectedAssetLabelGroup = useMemo(
    () => (selectedAsset ? getAssetLabelGroup(selectedAsset) : ""),
    [getAssetLabelGroup, selectedAsset]
  )

  const selectedAssetDisplayLabel = useMemo(() => {
    if (!selectedAsset) return ""
    const productTitle = productMeta?.title?.trim()
    if (productTitle) return productTitle
    return assetLabels[selectedAssetLabelGroup] || selectedAsset.name
  }, [assetLabels, productMeta?.title, selectedAsset, selectedAssetLabelGroup])

  const effectiveSelectedFolderCount =
    selectedRightFolders.length > 0 ? selectedRightFolders.length : selectedFolder && rightPaneFolders.includes(selectedFolder) ? 1 : 0

  const totalSelectedCount = selectedUrls.length + effectiveSelectedFolderCount

  const toggleAssetWithModifier = (url: string, withMultiSelect: boolean) => {
    if (!multiple && !withMultiSelect && selectedUrls.includes(url)) {
      onSelect([url])
      onOpenChange(false)
      return
    }
    if (withMultiSelect || multiple) {
      setSelectedUrls((prev) => (prev.includes(url) ? prev.filter((item) => item !== url) : [...prev, url]))
      return
    }
    setSelectedUrls([url])
  }

  const toggleRightFolderSelection = (folderPath: string, withMultiSelect: boolean) => {
    if (withMultiSelect) {
      setSelectedRightFolders((prev) =>
        prev.includes(folderPath) ? prev.filter((item) => item !== folderPath) : [...prev, folderPath]
      )
      setSelectedFolder(folderPath)
      return
    }

    setSelectedRightFolders([folderPath])
    setSelectedFolder(folderPath)
  }

  const handleAssetDoubleClick = (url: string) => {
    if (!multiple) {
      onSelect([url])
      onOpenChange(false)
      return
    }

    const nextSelection = selectedUrls.includes(url) ? selectedUrls : [...selectedUrls, url]
    if (nextSelection.length === 0) return
    onSelect(nextSelection)
    onOpenChange(false)
  }

  const handleInsert = () => {
    if (selectedUrls.length === 0) {
      toast.error("Select at least one image")
      return
    }
    onSelect(selectedUrls)
    onOpenChange(false)
  }

  const queueDeleteAssets = (urls: string[], label: string) => {
    const uniqueUrls = Array.from(new Set(urls.filter(Boolean)))
    if (uniqueUrls.length === 0) {
      toast.error("Silinecek medya yok")
      return
    }

    const deleteId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setHiddenDeletedUrls((prev) => Array.from(new Set([...prev, ...uniqueUrls])))
    setSelectedUrls((prev) => prev.filter((url) => !uniqueUrls.includes(url)))

    deleteTimeoutsRef.current[deleteId] = window.setTimeout(async () => {
      try {
        for (const url of uniqueUrls) {
          const res = await fetch("/api/admin/media", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
          })
          const json = await res.json().catch(() => null as null | { error?: string })
          if (!res.ok) {
            throw new Error(json?.error || "Failed to delete media")
          }
        }
        setHiddenDeletedUrls((prev) => prev.filter((url) => !uniqueUrls.includes(url)))
        delete deleteTimeoutsRef.current[deleteId]
        await loadMedia()
      } catch (error) {
        setHiddenDeletedUrls((prev) => prev.filter((url) => !uniqueUrls.includes(url)))
        delete deleteTimeoutsRef.current[deleteId]
        toast.error(error instanceof Error ? error.message : "Failed to delete media", { position: "bottom-right" })
      }
    }, 5000)

    toast.success(label, {
      position: "bottom-right",
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          const timeoutId = deleteTimeoutsRef.current[deleteId]
          if (timeoutId) window.clearTimeout(timeoutId)
          delete deleteTimeoutsRef.current[deleteId]
          setHiddenDeletedUrls((prev) => prev.filter((url) => !uniqueUrls.includes(url)))
          toast.success("Silme geri alındı", { position: "bottom-right" })
        },
      },
    })
  }

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return
    setUploading(true)
    try {
      const uploadedUrls: string[] = []
      for (const file of files) {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("folder", uploadFolder)
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })
        const json = await res.json().catch(() => null as null | { success?: boolean; url?: string; error?: string })
        if (!res.ok || !json?.success || !json?.url) {
          throw new Error(json?.error || "Upload failed")
        }
        uploadedUrls.push(json.url)
      }
      toast.success(`${uploadedUrls.length} file(s) uploaded`)
      await loadMedia()
      setTab("library")
      if (multiple) {
        setSelectedUrls(uploadedUrls)
      } else if (uploadedUrls[0]) {
        setSelectedUrls([uploadedUrls[0]])
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setUploading(false)
      event.target.value = ""
    }
  }

  const handleCreateFolder = async (rawName?: string, parentOverride?: string) => {
    const trimmed = (rawName ?? "").trim()
    if (!trimmed) {
      toast.error("Folder name is required")
      return
    }
    if (activeFolder === "all" && !parentOverride) {
      toast.error("Select a category folder first")
      return
    }
    const parentFolder = parentOverride || currentPath
    setCreatingFolder(true)
    try {
      const res = await fetch("/api/admin/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentFolder, name: trimmed }),
      })
      const json = await res.json().catch(() => null as null | { error?: string; folder?: string })
      if (!res.ok || !json?.folder) {
        throw new Error(json?.error || "Failed to create folder")
      }
      const createdFolder = json.folder
      toast.success("Folder created")
      setSelectedFolder(createdFolder)
      setSelectedRightFolders([createdFolder])
      await loadMedia()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create folder")
    } finally {
      setCreatingFolder(false)
    }
  }

  const renameFolder = async (folderPath: string) => {
    const currentName = folderPath.split("/").pop() || folderPath
    const nextName = window.prompt("Yeni klasör adı", currentName)
    if (!nextName) return
    const trimmed = nextName.trim()
    if (!trimmed) {
      toast.error("Folder name is required")
      return
    }
    try {
      const res = await fetch("/api/admin/media/folders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: folderPath, newName: trimmed }),
      })
      const json = await res.json().catch(() => null as null | { error?: string; folder?: string })
      if (!res.ok || !json?.folder) {
        throw new Error(json?.error || "Failed to rename folder")
      }
      const nextFolder = json.folder
      toast.success("Folder renamed")
      if (activeSubfolder === folderPath) setActiveSubfolder(nextFolder)
      if (uploadFolder === folderPath) setUploadFolder(nextFolder)
      if (targetFolder === folderPath) setTargetFolder(nextFolder)
      await loadMedia()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to rename folder")
    }
  }

  const deleteFolder = async (folderPath: string) => {
    const ok = window.confirm(`Klasör silinsin mi?\n${folderPath}`)
    if (!ok) return
    try {
      const res = await fetch("/api/admin/media/folders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: folderPath }),
      })
      const json = await res.json().catch(() => null as null | { error?: string })
      if (!res.ok) {
        throw new Error(json?.error || "Failed to delete folder")
      }
      toast.success("Folder deleted")
      if (activeSubfolder === folderPath) setActiveSubfolder("all")
      if (uploadFolder === folderPath) setUploadFolder(activeFolder !== "all" ? activeFolder : "categories")
      if (targetFolder === folderPath) setTargetFolder(activeFolder !== "all" ? activeFolder : "categories")
      setSelectedFolder(null)
      setSelectedRightFolders((prev) => prev.filter((item) => item !== folderPath))
      await loadMedia()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete folder")
    }
  }

  const deleteAllAssets = async () => {
    const allVisibleUrls = Array.from(new Set(imageAssets.map((asset) => asset.url)))
    if (allVisibleUrls.length === 0) {
      toast.error("Silinecek medya yok", { position: "bottom-right" })
      return
    }

    const ok = window.confirm(`Tüm medya silinsin mi?\n${allVisibleUrls.length} dosya silinecek.`)
    if (!ok) return

    setSelectedFolder(null)
    setSelectedRightFolders([])
    queueDeleteAssets(allVisibleUrls, "Tüm medya silinmek üzere işaretlendi")
  }

  const cloneFolder = async (folderPath: string) => {
    const libraryScrollTop = libraryScrollRef.current?.scrollTop ?? 0
    const windowScrollX = window.scrollX
    const windowScrollY = window.scrollY
    const currentName = folderPath.split("/").pop() || folderPath
    const parentFolder = folderPath.includes("/") ? folderPath.split("/").slice(0, -1).join("/") : ""
    const match = currentName.match(/^(.*?)(\d+)$/)
    if (!match) {
      toast.error("Klonlama için klasör sonunda numara olmalı")
      return
    }

    const [, prefix, digits] = match
    let maxNumber = Number.parseInt(digits, 10)
    const siblingPrefix = parentFolder ? `${parentFolder}/` : ""

    for (const folder of folders) {
      const sameLevelParent = folder.name.includes("/") ? folder.name.split("/").slice(0, -1).join("/") : ""
      if (sameLevelParent !== parentFolder) continue

      const leafName = siblingPrefix ? folder.name.slice(siblingPrefix.length) : folder.name
      const siblingMatch = leafName.match(/^(.*?)(\d+)$/)
      if (!siblingMatch) continue
      if (siblingMatch[1] !== prefix) continue

      const siblingNumber = Number.parseInt(siblingMatch[2], 10)
      if (siblingNumber > maxNumber) maxNumber = siblingNumber
    }

    const nextNumber = String(maxNumber + 1).padStart(digits.length, "0")
    const nextName = `${prefix}${nextNumber}`

    setCreatingFolder(true)
    try {
      const res = await fetch("/api/admin/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentFolder, name: nextName }),
      })
      const json = await res.json().catch(() => null as null | { error?: string; folder?: string })
      if (!res.ok || !json?.folder) {
        throw new Error(json?.error || "Failed to clone folder")
      }
      toast.success(`Klonlandı: ${nextName}`)
      setSelectedFolder(json.folder)
      setSelectedRightFolders([json.folder])
      await loadMedia()
      requestAnimationFrame(() => {
        if (libraryScrollRef.current) {
          libraryScrollRef.current.scrollTop = libraryScrollTop
        }
        window.scrollTo({ left: windowScrollX, top: windowScrollY, behavior: "auto" })
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clone folder")
    } finally {
      setCreatingFolder(false)
    }
  }

  const moveAssetsToFolder = async (urls: string[], nextFolder: string) => {
    if (urls.length === 0) {
      toast.error("Select image first")
      return
    }
    if (!nextFolder) {
      toast.error("Target folder is required")
      return
    }
    setMoving(true)
    try {
      for (const url of urls) {
        const res = await fetch("/api/admin/media", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, targetFolder: nextFolder }),
        })
        const json = await res.json().catch(() => null as null | { error?: string })
        if (!res.ok) {
          throw new Error(json?.error || "Failed to move image")
        }
      }
      toast.success("Selected images moved")
      await loadMedia()
      setSelectedUrls([])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to move image")
    } finally {
      setMoving(false)
    }
  }

  const moveSelectedAssets = async () => {
    await moveAssetsToFolder(selectedUrls, targetFolder)
  }

  const goBackOneLevel = () => {
    if (activeSubfolder === "all") return

    const parts = activeSubfolder.split("/").filter(Boolean)
    if (parts.length <= 1) {
      setActiveSubfolder("all")
      setSelectedFolder(null)
      setUploadFolder(activeFolder !== "all" ? activeFolder : "categories")
      setTargetFolder(activeFolder !== "all" ? activeFolder : "categories")
      return
    }

    const parentFolder = parts.slice(0, -1).join("/")
    if (parentFolder === activeFolder) {
      setActiveSubfolder("all")
      setSelectedFolder(parentFolder)
      setUploadFolder(parentFolder)
      setTargetFolder(parentFolder)
      return
    }

    setActiveSubfolder(parentFolder)
    setSelectedFolder(parentFolder)
    setUploadFolder(parentFolder)
    setTargetFolder(parentFolder)
  }

  const handleFolderDrop = async (folderPath: string) => {
    const foldersToMove = selectedRightFolders.filter(
      (selectedPath) => selectedPath !== folderPath && !folderPath.startsWith(`${selectedPath}/`)
    )
    setDragTargetFolder(null)
    setDraggingUrls([])
    if (foldersToMove.length > 0) {
      setMoving(true)
      try {
        for (const sourceFolder of foldersToMove) {
          const currentParent = sourceFolder.includes("/") ? sourceFolder.split("/").slice(0, -1).join("/") : ""
          if (currentParent === folderPath) continue
          const res = await fetch("/api/admin/media/folders", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folder: sourceFolder, targetParent: folderPath }),
          })
          const json = await res.json().catch(() => null as null | { error?: string; folder?: string })
          if (!res.ok) {
            throw new Error(json?.error || "Failed to move folder")
          }
        }
        toast.success("Selected folders moved")
        setSelectedFolder(null)
        setSelectedRightFolders([])
        await loadMedia()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to move folder")
      } finally {
        setMoving(false)
      }
      return
    }

    const urlsToMove = draggingUrls.length > 0 ? draggingUrls : selectedUrls
    if (urlsToMove.length === 0) return
    setTargetFolder(folderPath)
    await moveAssetsToFolder(urlsToMove, folderPath)
  }

  const openFolderMenuAtElement = (folder: string, element: HTMLElement) => {
    const dialogRect = dialogContentRef.current?.getBoundingClientRect()
    const targetRect = element.getBoundingClientRect()
    if (!dialogRect) return
    setFolderMenu({
      folder,
      x: targetRect.left - dialogRect.left + 8,
      y: targetRect.top - dialogRect.top + 8,
    })
    setShowColorPicker(false)
  }

  const applyFolderColor = (folderPath: string, color: string) => {
    const parentFolder = folderPath.includes("/") ? folderPath.split("/").slice(0, -1).join("/") : ""
    const leafName = folderPath.split("/").pop() || folderPath
    const familyMatch = leafName.match(/^(.*?)(\d+)$/)

    setFolderColors((prev) => {
      const next = { ...prev }

      if (!familyMatch) {
        next[folderPath] = color
        return next
      }

      const familyPrefix = familyMatch[1]
      for (const folder of folders) {
        const sameLevelParent = folder.name.includes("/") ? folder.name.split("/").slice(0, -1).join("/") : ""
        if (sameLevelParent !== parentFolder) continue

        const siblingLeaf = folder.name.split("/").pop() || folder.name
        const siblingMatch = siblingLeaf.match(/^(.*?)(\d+)$/)
        if (!siblingMatch) continue
        if (siblingMatch[1] !== familyPrefix) continue

        next[folder.name] = color
      }

      next[folderPath] = color
      return next
    })
    setShowColorPicker(false)
    setFolderMenu(null)
  }

  const triggerCreateFolderFromHeader = async () => {
    const nextName = window.prompt("Klasör adı")
    if (!nextName) return
    await handleCreateFolder(nextName, currentPath)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={dialogContentRef}
        className="!left-1/2 !top-1/2 !translate-x-[-50%] !translate-y-[-50%] !flex flex-col overflow-hidden p-0"
        style={{ width: "98vw", maxWidth: "98vw", height: "96vh", maxHeight: "96vh" }}
      >
        <DialogHeader className="border-b border-slate-200 px-6 py-4">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="border-b border-slate-200 px-6 pt-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={tab === "upload" ? "default" : "outline"}
              size="sm"
              onClick={() => setTab("upload")}
            >
              Upload files
            </Button>
            <Button
              type="button"
              variant={tab === "library" ? "default" : "outline"}
              size="sm"
              onClick={() => setTab("library")}
            >
              Media Library
            </Button>
            {tab === "library" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void triggerCreateFolderFromHeader()}
                  disabled={creatingFolder}
                >
                  {creatingFolder ? "Ekleniyor..." : "Klasör Ekle"}
                </Button>
                {selectedUrls.length > 0 || selectedFolder || activeFolder === "all" ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (selectedUrls.length > 0) {
                        queueDeleteAssets(
                          selectedUrls,
                          `${selectedUrls.length} medya silinmek üzere işaretlendi`
                        )
                        return
                      }
                      void (selectedFolder ? deleteFolder(selectedFolder) : deleteAllAssets())
                    }}
                    disabled={moving}
                  >
                    Sil
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "upload" ? (
          <div className="h-full space-y-4 overflow-y-auto px-6 py-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Upload Folder</Label>
                <Select value={uploadFolder} onValueChange={setUploadFolder}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {folders.map((folder) => (
                      <SelectItem key={folder.name} value={folder.name}>
                        {folder.name.split("/").map(formatFolderLabel).join(" / ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <label className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
              {uploading ? <Loader2 className="h-8 w-8 animate-spin text-slate-500" /> : <Upload className="h-8 w-8 text-slate-500" />}
              <p className="text-sm text-slate-700">{uploading ? "Uploading..." : "Drop files or click to select"}</p>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
          </div>
        ) : (
          <div className="flex h-full min-h-0 overflow-hidden">
            <aside className="flex h-full min-h-0 w-[300px] shrink-0 flex-col border-r border-slate-200 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Folders</p>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {topFolders.map((folder) => {
                  const isOpen = activeFolder === folder.name
                  return (
                    <div key={folder.name} className={`rounded-md border ${isOpen ? "border-teal-400" : "border-slate-200"}`}>
                      <button
                        type="button"
                        className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm ${isOpen ? "bg-teal-50 text-slate-900" : "bg-white text-slate-700 hover:bg-slate-50"}`}
                        onClick={() => {
                          if (isOpen) {
                            setActiveFolder("all")
                            setActiveSubfolder("all")
                            setSelectedFolder(null)
                            setSelectedRightFolders([])
                            return
                          }
                          setActiveFolder(folder.name)
                          setActiveSubfolder("all")
                          setSelectedFolder(null)
                          setSelectedRightFolders([])
                          setUploadFolder(folder.name === "all" ? "categories" : folder.name)
                          setTargetFolder(folder.name === "all" ? "categories" : folder.name)
                        }}
                      >
                        <span className="inline-flex items-center gap-2">
                          <Folder className="h-4 w-4 text-amber-500" />
                          {folder.name === "all" ? "All" : formatFolderLabel(folder.name)}
                        </span>
                        <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-slate-600">
                          {folder.count}
                        </span>
                      </button>
                      {isOpen && folder.name !== "all" ? (
                        <div className="border-t border-slate-200 p-2">
                          {directSubfolders.map((subfolder) => (
                            <button
                              key={subfolder}
                              type="button"
                              className={`mb-1 flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs ${selectedFolder === subfolder ? "bg-slate-100 font-medium text-slate-900" : "text-slate-600 hover:bg-slate-50"}`}
                              onClick={() => {
                                setSelectedFolder(subfolder)
                                setSelectedRightFolders([])
                                setActiveSubfolder(subfolder)
                                setUploadFolder(subfolder)
                                setTargetFolder(subfolder)
                              }}
                            >
                              <span className="truncate">{formatFolderLabel(subfolder.replace(`${folder.name}/`, ""))}</span>
                              <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-slate-600">
                                {folderImageCountMap.get(subfolder) || 0}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </aside>

            <div className="flex min-w-0 flex-1 overflow-hidden">
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="border-b border-slate-200 p-4">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Search media..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                    <Select value={targetFolder} onValueChange={setTargetFolder}>
                      <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="Move to folder" />
                      </SelectTrigger>
                      <SelectContent>
                        {folders.map((folder) => (
                          <SelectItem key={folder.name} value={folder.name}>
                            {folder.name.split("/").map(formatFolderLabel).join(" / ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" size="sm" onClick={() => void moveSelectedAssets()} disabled={moving || selectedUrls.length === 0}>
                      {moving ? "Moving..." : "Move"}
                    </Button>
                  </div>
                  {activeSubfolder !== "all" ? (
                    <div className="mt-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={goBackOneLevel}
                        className="border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700"
                      >
                        Geri
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div ref={libraryScrollRef} className="min-h-0 flex-1 overflow-y-auto p-4">
                  {loading ? (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading media...
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {rightPaneFolders.length > 0 ? (
                        <div
                          className="grid gap-3"
                          style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
                        >
                          {rightPaneFolders.map((folderPath) => {
                            const folderColor = folderColors[folderPath] || "#f59e0b"
                            const isSelected = selectedRightFolders.includes(folderPath)
                            return (
                              <button
                                key={folderPath}
                                type="button"
                                draggable
                                className={`rounded-md border bg-white p-3 text-left hover:bg-slate-50 ${dragTargetFolder === folderPath ? "ring-2 ring-teal-400" : "border-slate-200"} ${isSelected ? "ring-2 ring-blue-300" : ""}`}
                                style={{
                                  borderColor: folderColor,
                                  backgroundColor: `${folderColor}12`,
                                }}
                                onClick={(event) => {
                                  toggleRightFolderSelection(folderPath, event.metaKey || event.ctrlKey)
                                }}
                                onDoubleClick={() => {
                                  setSelectedFolder(folderPath)
                                  setSelectedRightFolders([folderPath])
                                  setActiveSubfolder(folderPath)
                                  setUploadFolder(folderPath)
                                  setTargetFolder(folderPath)
                                }}
                                onContextMenu={(event) => {
                                  event.preventDefault()
                                  setSelectedFolder(folderPath)
                                  setSelectedRightFolders((prev) => (prev.includes(folderPath) ? prev : [folderPath]))
                                  openFolderMenuAtElement(folderPath, event.currentTarget)
                                }}
                                onDragStart={(event) => {
                                  const foldersToDrag = selectedRightFolders.includes(folderPath) ? selectedRightFolders : [folderPath]
                                  if (!selectedRightFolders.includes(folderPath)) {
                                    setSelectedRightFolders([folderPath])
                                    setSelectedFolder(folderPath)
                                  }
                                  event.dataTransfer.setData("text/plain", foldersToDrag.join(","))
                                }}
                                onDragOver={(event) => {
                                  event.preventDefault()
                                  setDragTargetFolder(folderPath)
                                }}
                                onDragLeave={() => {
                                  setDragTargetFolder((prev) => (prev === folderPath ? null : prev))
                                }}
                                onDrop={(event) => {
                                  event.preventDefault()
                                  void handleFolderDrop(folderPath)
                                }}
                              >
                                <Folder
                                  className="mb-2 h-8 w-8"
                                  style={{ color: folderColor, fill: `${folderColor}33` }}
                                />
                                <p className="truncate text-sm font-medium text-slate-800">
                                  {formatFolderLabel(folderPath.split("/").pop() || folderPath)}
                                </p>
                                <p className="text-xs text-slate-500">{folderImageCountMap.get(folderPath) || 0}</p>
                              </button>
                            )
                          })}
                        </div>
                      ) : null}

                      {sortedFilteredAssets.length === 0 ? (
                        <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-sm text-slate-500">
                          <ImageIcon className="mb-2 h-8 w-8 text-slate-400" />
                          No images found
                        </div>
                      ) : (
                        <div
                          className="grid gap-3"
                          style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
                        >
                          {sortedFilteredAssets.map((asset) => {
                            const selected = selectedUrls.includes(asset.url)
                            const labelGroup = getAssetLabelGroup(asset)
                            const displayLabel = assetLabels[labelGroup] || asset.name
                            return (
                              <button
                                key={asset.id}
                                type="button"
                                onClick={(event) => toggleAssetWithModifier(asset.url, event.metaKey || event.ctrlKey)}
                                onDoubleClick={() => handleAssetDoubleClick(asset.url)}
                                draggable
                                onDragStart={() => {
                                  const urls = selectedUrls.includes(asset.url) ? selectedUrls : [asset.url]
                                  setDraggingUrls(urls)
                                }}
                                onDragEnd={() => {
                                  setDraggingUrls([])
                                  setDragTargetFolder(null)
                                }}
                                className={`relative overflow-hidden rounded-md border bg-white text-left ${selected ? "border-blue-500 ring-2 ring-blue-200" : "border-slate-200"}`}
                              >
                                <div className="aspect-square overflow-hidden bg-slate-100">
                                  <img src={asset.url} alt={asset.name} className="h-full w-full object-cover" />
                                </div>
                                <div className="truncate px-2 py-1 text-[11px] text-slate-700">{displayLabel}</div>
                                {selected ? (
                                  <span className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
                                    <Check className="h-3 w-3" />
                                  </span>
                                ) : null}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <aside className="flex h-full min-h-0 w-[360px] shrink-0 flex-col border-l border-slate-200 bg-slate-50/70">
                <div className="h-full overflow-y-auto p-4">
                  {selectedAsset ? (
                    <div className="space-y-4">
                      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                        <div className="aspect-square overflow-hidden bg-slate-100">
                          <img src={selectedAsset.url} alt={selectedAsset.name} className="h-full w-full object-cover" />
                        </div>
                        <div className="space-y-1 border-t border-slate-200 px-3 py-3 text-sm">
                          <p className="break-all font-semibold text-slate-900">{selectedAssetDisplayLabel}</p>
                          {selectedAssetDate ? <p className="text-sm text-slate-600">{selectedAssetDate}</p> : null}
                          {selectedAssetSize ? <p className="text-sm text-slate-600">{selectedAssetSize}</p> : null}
                          {selectedAssetDimensions ? (
                            <p className="text-sm text-slate-600">
                              {selectedAssetDimensions.width} by {selectedAssetDimensions.height} pixels
                            </p>
                          ) : null}
                          <p className="text-xs text-slate-500">{selectedAsset.folder.split("/").map(formatFolderLabel).join(" / ")}</p>
                          <button
                            type="button"
                            className="text-sm font-medium text-red-600 hover:text-red-700"
                            onClick={() => queueDeleteAssets([selectedAsset.url], "1 medya silinmek üzere işaretlendi")}
                          >
                            Delete
                          </button>
                          <div className="pt-2">
                            <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">SKU</Label>
                            <div className="mt-1 min-h-[40px] rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
                              {productMeta?.sku?.trim() || "SKU girildiğinde burada görünür"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
                      Sağ detay alanı seçilen görselle burada görünür.
                    </div>
                  )}

                  <div className="mt-4 space-y-4 rounded-lg border border-slate-200 bg-white p-4">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Title</Label>
                      <div className="min-h-[44px] rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
                        {productMeta?.title?.trim() || "Ürün başlığı girildiğinde burada görünür"}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</Label>
                      <div className="min-h-[160px] whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
                        {productMeta?.description?.trim() || "Ürün açıklaması yazıldığında burada görünür"}
                      </div>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3">
          <p className="text-xs text-slate-500">
            {totalSelectedCount} selected
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (tab === "upload") {
                  setTab("library")
                  return
                }
                onOpenChange(false)
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleInsert} disabled={selectedUrls.length === 0}>
              Add
            </Button>
          </div>
        </div>
        {folderMenu ? (
          <div
            className="fixed inset-0 z-50"
            onClick={() => setFolderMenu(null)}
            onContextMenu={(event) => {
              event.preventDefault()
              setFolderMenu(null)
            }}
          >
            <div
              className="absolute min-w-[140px] rounded-md border border-slate-200 bg-white p-1 shadow-lg"
              style={{ left: folderMenu.x, top: folderMenu.y }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="block w-full rounded px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100"
                onClick={() => {
                  void renameFolder(folderMenu.folder)
                  setFolderMenu(null)
                }}
              >
                Düzenle
              </button>
              <button
                type="button"
                className="block w-full rounded px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100"
                onClick={() => {
                  void cloneFolder(folderMenu.folder)
                  setFolderMenu(null)
                }}
              >
                Klonla
              </button>
              <button
                type="button"
                className="block w-full rounded px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100"
                onClick={() => setShowColorPicker((prev) => !prev)}
              >
                Renk
              </button>
              {showColorPicker ? (
                <div className="mt-1 grid grid-cols-4 gap-1 px-1 py-1">
                  {FOLDER_COLOR_OPTIONS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className="h-6 w-6 rounded border border-slate-200"
                      style={{ backgroundColor: color }}
                      onClick={() => applyFolderColor(folderMenu.folder, color)}
                    />
                  ))}
                </div>
              ) : null}
              <button
                type="button"
                className="block w-full rounded px-2 py-1.5 text-left text-xs text-rose-600 hover:bg-rose-50"
                onClick={() => {
                  void deleteFolder(folderMenu.folder)
                  setFolderMenu(null)
                }}
              >
                Sil
              </button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
