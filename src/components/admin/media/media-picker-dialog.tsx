"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Loader2, Upload, Image as ImageIcon, Check, Folder as FolderIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { isProductSkuFolderPath, looksLikeProductSkuSegment, shouldUseProductSkuChildFolders } from "@/lib/media-sku-roots"
import { getImageUrl } from "@/lib/storage/url"
import { normalizeMediaTitleForBaseName, prettifyAdminMediaLabel, stripDuplicateMediaPrefix } from "@/lib/admin/media-labels"

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
    categoryFolderPath?: string
  }
}

const FOLDER_COLOR_KEY = "media-picker-folder-colors"
const ASSET_LABEL_KEY = "media-picker-asset-labels"
const FOLDER_COLOR_OPTIONS = ["#f59e0b", "#ef4444", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b"]
const MEDIA_PAGE_SIZE = 30
const BROWSE_ONLY_FOLDER = "__no_results__"

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

function buildUploadBaseName(title: string, index: number, total: number) {
  const base = normalizeMediaTitleForBaseName(title)
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()

  if (!base) return ""
  if (total <= 1) return base
  return `${base}-${index + 1}`
}

function prettifyPickerAssetName(asset: Asset) {
  return prettifyAdminMediaLabel(asset)
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

function extractFolderFromUploadUrl(url: string) {
  const normalized = getImageUrl(url)
  const marker = "/uploads/"
  const idx = normalized.indexOf(marker)
  if (idx < 0) return null
  const relative = normalized.slice(idx + marker.length).replace(/^\/+/, "")
  const parts = relative.split("/").filter(Boolean)
  if (parts.length < 2) return null
  return parts.slice(0, -1).join("/")
}

function resolveProductUploadFolder(baseFolder: string, sku: string) {
  const cleanFolder = (baseFolder || "").trim().replace(/^\/+|\/+$/g, "")
  const cleanSku = (sku || "").trim().replace(/^\/+|\/+$/g, "")
  if (!cleanFolder) return cleanSku ? cleanSku : ""
  if (!cleanSku) return cleanFolder

  const parts = cleanFolder.split("/").filter(Boolean)
  const alreadyOnSkuFolder = parts[parts.length - 1] === cleanSku
  if (alreadyOnSkuFolder) return cleanFolder

  return `${cleanFolder}/${cleanSku}`
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
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [activeFolder, setActiveFolder] = useState("all")
  const [activeSubfolder, setActiveSubfolder] = useState("all")
  const [selectedChildFolder, setSelectedChildFolder] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [uploadFolder, setUploadFolder] = useState("categories")
  const [folders, setFolders] = useState<Folder[]>([])
  const [branchSkuFolders, setBranchSkuFolders] = useState<Record<string, string[]>>({})
  const [assets, setAssets] = useState<Asset[]>([])
  const [selectedUrls, setSelectedUrls] = useState<string[]>([])
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [moving, setMoving] = useState(false)
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
  const [assetPage, setAssetPage] = useState(1)
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: MEDIA_PAGE_SIZE,
    totalItems: 0,
    totalPages: 1,
  })
  const [foldersLoaded, setFoldersLoaded] = useState(false)
  const dialogContentRef = useRef<HTMLDivElement | null>(null)
  const libraryScrollRef = useRef<HTMLDivElement | null>(null)
  const deleteTimeoutsRef = useRef<Record<string, number>>({})

  const preferredUploadFolder = useMemo(() => {
    const sku = (productMeta?.sku || "").trim()
    const categoryFolderPath = (productMeta?.categoryFolderPath || "").trim()
    const resolved = resolveProductUploadFolder(categoryFolderPath, sku)
    if (resolved) return resolved
    if (categoryFolderPath) return categoryFolderPath
    return ""
  }, [productMeta?.categoryFolderPath, productMeta?.sku])

  const normalizedSearchTerm = searchTerm.trim().toLowerCase()
  const categoryTree = useMemo(() => buildCategoryOptions(categories), [categories])

  const topFolders = useMemo(
    () => categoryTree.topOptions.map((option) => ({ name: option.value, count: 0 })),
    [categoryTree.topOptions]
  )

  const topFolderLabels = useMemo(
    () => new Map(categoryTree.topOptions.map((option) => [option.value, option.label])),
    [categoryTree.topOptions]
  )

  const subfolders = useMemo(() => {
    if (activeFolder === "all") return [] as string[]
    return (categoryTree.subOptionsByTop.get(activeFolder) || []).map((option) => option.value)
  }, [activeFolder, categoryTree.subOptionsByTop])

  const subfolderLabels = useMemo(
    () =>
      new Map(
        Array.from(categoryTree.subOptionsByTop.values()).flatMap((options) => options.map((option) => [option.value, option.label] as const))
      ),
    [categoryTree.subOptionsByTop]
  )

  const categoryBranchSkuFolders = useMemo(() => {
    if (activeSubfolder === "all") return [] as string[]
    return branchSkuFolders[activeSubfolder] || []
  }, [activeSubfolder, branchSkuFolders])

  const usesSkuFolders = useMemo(() => {
    if (activeSubfolder === "all") return false
    if (categoryBranchSkuFolders.length > 0) return true
    return shouldUseProductSkuChildFolders(activeSubfolder)
  }, [activeSubfolder, categoryBranchSkuFolders])

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/categories", { cache: "no-store" })
      const json = await res.json().catch(() => null as null | { error?: string } | CategoryRow[])
      if (!res.ok) {
        const errorMessage = !Array.isArray(json) && json?.error ? json.error : "Failed to fetch categories"
        throw new Error(errorMessage)
      }
      setCategories(
        Array.isArray(json)
          ? json.map((category) => ({
              id: category.id,
              title: category.title,
              slug: category.slug,
              parentId: category.parentId ?? null,
            }))
          : []
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch categories")
    }
  }, [])

  const loadFolders = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/media/folders", { cache: "no-store" })
      const json = await res.json().catch(() => null as null | { error?: string; folders?: Folder[]; branchSkuFolders?: Record<string, string[]> })
      if (!res.ok) throw new Error(json?.error || "Failed to fetch folders")
      const nextFolders: Folder[] = json?.folders ?? []
      setFolders(nextFolders)
      setBranchSkuFolders(json?.branchSkuFolders || {})
      return { folders: nextFolders }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch folders")
      return null
    }
  }, [])

  const assetQuery = useMemo(() => {
    const params = new URLSearchParams()
    params.set("page", String(assetPage))
    params.set("limit", String(MEDIA_PAGE_SIZE))
    if (normalizedSearchTerm) params.set("search", normalizedSearchTerm)

    const isAllCategoriesRoot = activeFolder === "all" && activeSubfolder === "all" && !selectedChildFolder
    const isCategoryRootBrowseState = activeFolder !== "all" && activeSubfolder === "all" && !selectedChildFolder
    const isSubcategoryBrowseState = activeSubfolder !== "all" && !selectedChildFolder && categoryBranchSkuFolders.length > 0
    const isLeafFolder = Boolean(selectedChildFolder)

    let finalRequestFolder = ""
    let finalFolderMode = ""

    if (!isAllCategoriesRoot) {
      if (isLeafFolder) {
        finalRequestFolder = selectedChildFolder
        finalFolderMode = "exact"
      } else if (isSubcategoryBrowseState) {
        finalRequestFolder = BROWSE_ONLY_FOLDER
        finalFolderMode = "prefix"
      } else if (activeSubfolder !== "all") {
        finalRequestFolder = activeSubfolder
        finalFolderMode = "prefix"
      } else if (isCategoryRootBrowseState) {
        finalRequestFolder = activeFolder
        finalFolderMode = "prefix"
      }

      if (finalRequestFolder) {
        params.set("folder", finalRequestFolder)
        params.set("folderMode", finalFolderMode)
      }
    }

    console.info("[media-picker-dialog] asset request", {
      selectedTopFolder: activeFolder,
      selectedSubfolder: activeSubfolder,
      selectedChildFolder,
      finalRequestFolder,
      finalFolderMode,
      isLeafFolder,
      isCategoryRootBrowseState,
      isSubcategoryBrowseState,
    })
    return params.toString()
  }, [activeFolder, activeSubfolder, assetPage, categoryBranchSkuFolders.length, normalizedSearchTerm, selectedChildFolder])

  const loadAssets = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/media?${assetQuery}`, { cache: "no-store" })
      const json = await res.json().catch(() => null as null | { error?: string; assets?: Asset[]; pagination?: PaginationState })
      if (!res.ok) throw new Error(json?.error || "Failed to fetch media")
      const nextAssets: Asset[] = (json?.assets ?? []).map((asset: Asset) => ({
        ...asset,
        url: normalizePickerAssetUrl(asset.url),
      }))
      setAssets(nextAssets)
      setPagination(json?.pagination || { page: 1, limit: MEDIA_PAGE_SIZE, totalItems: 0, totalPages: 1 })
      if (json?.pagination?.page && json.pagination.page !== assetPage) {
        setAssetPage(json.pagination.page)
      }
      return { assets: nextAssets }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch media")
      return null
    } finally {
      setLoading(false)
    }
  }, [assetPage, assetQuery])

  useEffect(() => {
    if (!open) return
    void loadCategories()
  }, [loadCategories, open])

  useEffect(() => {
    if (!open) return
    void loadFolders().finally(() => setFoldersLoaded(true))
  }, [open, loadFolders])

  useEffect(() => {
    if (!open) return
    if (!preferredUploadFolder) return
    setUploadFolder(preferredUploadFolder)
  }, [open, preferredUploadFolder])

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
      setTab("library")
      setActiveFolder("all")
      setActiveSubfolder("all")
      setSelectedChildFolder("")
      setSearchTerm("")
      setFolderMenu(null)
      setShowColorPicker(false)
      setSelectedFolder(null)
      setSelectedRightFolders([])
      setDraggingUrls([])
      setDragTargetFolder(null)
      setHiddenDeletedUrls([])
      setAssetPage(1)
      setPagination({
        page: 1,
        limit: MEDIA_PAGE_SIZE,
        totalItems: 0,
        totalPages: 1,
      })
      setFoldersLoaded(false)
    }
  }, [open])

  const currentPath = useMemo(() => {
    if (selectedChildFolder) return selectedChildFolder
    if (activeSubfolder !== "all") return activeSubfolder
    if (activeFolder !== "all") return activeFolder
    return ""
  }, [activeFolder, activeSubfolder, selectedChildFolder])

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

  useEffect(() => {
    if (!open || !foldersLoaded) return
    void loadAssets()
  }, [activeFolder, activeSubfolder, foldersLoaded, loadAssets, open, selectedChildFolder])

  const childFolders = useMemo(() => {
    if (activeSubfolder === "all") return [] as string[]
    if (categoryBranchSkuFolders.length > 0) {
      return [...categoryBranchSkuFolders].sort((a, b) => a.localeCompare(b))
    }
    const prefix = `${activeSubfolder}/`
    return folders
      .map((folder) => folder.name)
      .filter((name) => name.startsWith(prefix))
      .map((name) => name.slice(prefix.length))
      .filter((rest) => rest.length > 0 && !rest.includes("/"))
      .map((leaf) => `${activeSubfolder}/${leaf}`)
      .sort((a, b) => a.localeCompare(b))
  }, [activeSubfolder, categoryBranchSkuFolders, folders])

  const currentLevelFolders = useMemo(() => {
    if (selectedChildFolder) return [] as string[]
    if (activeSubfolder !== "all") return childFolders
    return subfolders
  }, [activeSubfolder, childFolders, selectedChildFolder, subfolders])

  const searchableFolders = useMemo(() => {
    if (selectedChildFolder) {
      return [] as string[]
    }

    if (activeSubfolder !== "all") {
      return childFolders
    }

    if (activeFolder !== "all") {
      return subfolders
    }

    return [] as string[]
  }, [activeFolder, activeSubfolder, childFolders, selectedChildFolder, subfolders])

  const visibleCurrentLevelFolders = useMemo(() => {
    if (!normalizedSearchTerm) return currentLevelFolders
    return searchableFolders.filter((folder) => {
      const folderLeaf = folder.split("/").pop() || folder
      return folder.toLowerCase().includes(normalizedSearchTerm) || folderLeaf.toLowerCase().includes(normalizedSearchTerm)
    })
  }, [currentLevelFolders, normalizedSearchTerm, searchableFolders])

  useEffect(() => {
    setAssetPage(1)
  }, [activeFolder, activeSubfolder, selectedChildFolder, searchTerm])

  const getAssetLabelGroup = useCallback((asset: Asset) => {
    const folderLeaf = asset.folder.split("/").filter(Boolean).pop() || asset.folder
    return folderLeaf || (productMeta?.sku?.trim() || "")
  }, [productMeta?.sku])

  const filteredAssets = useMemo(() => {
    return imageAssets.filter((asset) => {
      if (selectedChildFolder) {
        const inFolder = asset.folder === selectedChildFolder || asset.folder.startsWith(`${selectedChildFolder}/`)
        if (!inFolder) return false
      } else if (activeFolder === "all") {
        // keep all assets
      } else if (activeSubfolder === "all") {
        const inTopFolder =
          asset.folder === activeFolder ||
          asset.folder.startsWith(`${activeFolder}/`)
        if (!inTopFolder) return false
      } else if (usesSkuFolders) {
        return false
      } else if (asset.folder !== activeSubfolder && !asset.folder.startsWith(`${activeSubfolder}/`)) {
        return false
      }

      if (!normalizedSearchTerm) return true

      const labelGroup = getAssetLabelGroup(asset).toLowerCase()
      const displayLabel = (assetLabels[getAssetLabelGroup(asset)] || prettifyPickerAssetName(asset)).toLowerCase()
      return (
        asset.name.toLowerCase().includes(normalizedSearchTerm) ||
        asset.folder.toLowerCase().includes(normalizedSearchTerm) ||
        asset.usedIn.toLowerCase().includes(normalizedSearchTerm) ||
        labelGroup.includes(normalizedSearchTerm) ||
        displayLabel.includes(normalizedSearchTerm)
      )
    })
  }, [activeFolder, activeSubfolder, assetLabels, getAssetLabelGroup, imageAssets, normalizedSearchTerm, selectedChildFolder, usesSkuFolders])

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

    let cancelled = false
    const img = new window.Image()
    img.onload = () => {
      if (cancelled) return
      setSelectedAssetDimensions({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      if (cancelled) return
      setSelectedAssetDimensions(null)
    }
    img.src = selectedAsset.url

    return () => {
      cancelled = true
    }
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

  const selectedAssetLabelGroup = useMemo(
    () => (selectedAsset ? getAssetLabelGroup(selectedAsset) : ""),
    [getAssetLabelGroup, selectedAsset]
  )

  const selectedAssetDisplayLabel = useMemo(() => {
    if (!selectedAsset) return ""
    const productTitle = stripDuplicateMediaPrefix(productMeta?.title?.trim())
    if (productTitle) return productTitle
    return assetLabels[selectedAssetLabelGroup] || prettifyPickerAssetName(selectedAsset)
  }, [assetLabels, productMeta?.title, selectedAsset, selectedAssetLabelGroup])

  const effectiveSelectedFolderCount = selectedRightFolders.length

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
        await Promise.all([loadFolders(), loadAssets()])
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
      const targetUploadFolder = resolveProductUploadFolder(uploadFolder || preferredUploadFolder || "categories", productMeta?.sku || "")

      const skuFolder = (productMeta?.sku || "").trim()
      if (skuFolder && targetUploadFolder.endsWith(`/${skuFolder}`)) {
        const parentFolder = targetUploadFolder.slice(0, -(skuFolder.length + 1))
        if (parentFolder) {
          await fetch("/api/admin/media", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ parentFolder, name: skuFolder }),
          })
        }
      }
      const uploadOne = async (file: File, index: number) => {
        if (file.type && !file.type.startsWith("image/")) {
          throw new Error(`"${file.name}" is not a supported image type (${file.type})`)
        }

        const formData = new FormData()
        formData.append("file", file)
        formData.append("folder", targetUploadFolder)

        const baseName = buildUploadBaseName(productMeta?.title || "", index, files.length)
        if (baseName) formData.append("baseName", baseName)

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })

        const json = await res.json().catch(() => null as null | { success?: boolean; url?: string; error?: string })
        if (!res.ok || !json?.success || !json?.url) {
          throw new Error(json?.error || "Upload failed")
        }

        return json.url
      }

      const uploadedUrls: string[] = []
      const uploadedFolders: string[] = []
      const concurrency = 2

      for (let index = 0; index < files.length; index += concurrency) {
        const batch = files.slice(index, index + concurrency)
        const batchUrls = await Promise.all(
          batch.map((file, batchIndex) => uploadOne(file, index + batchIndex))
        )

        for (const url of batchUrls) {
          uploadedUrls.push(url)
          const resolvedFolder = extractFolderFromUploadUrl(url)
          if (resolvedFolder) uploadedFolders.push(resolvedFolder)
        }
      }
      toast.success(`${uploadedUrls.length} file(s) uploaded`)
      setHiddenDeletedUrls((prev) => prev.filter((url) => !uploadedUrls.includes(url)))
      await loadFolders()
      const refreshed = await loadAssets()
      setTab("library")
      setSelectedFolder(null)
      setSelectedRightFolders([])

      const focusFolder = uploadedFolders[0] || targetUploadFolder
      const focusTop = focusFolder.split("/")[0] || "all"
      setActiveFolder(focusTop)
      if (isProductSkuFolderPath(focusFolder)) {
        const parentFolder = focusFolder.split("/").slice(0, -1).join("/") || "all"
        setActiveSubfolder(parentFolder === focusTop ? parentFolder : parentFolder)
        setSelectedChildFolder(focusFolder)
      } else {
        setActiveSubfolder(focusFolder === focusTop ? "all" : focusFolder)
        setSelectedChildFolder("")
      }
      setUploadFolder(focusFolder)
      const assetUrlSet = new Set((refreshed?.assets || []).map((asset) => asset.url))
      const existingUploaded = uploadedUrls.filter((url) => assetUrlSet.has(url))
      if (existingUploaded.length === 0) {
        setSelectedUrls([])
      } else if (!multiple) {
        onSelect([existingUploaded[0]])
        onOpenChange(false)
        return
      } else if (multiple) {
        setSelectedUrls(existingUploaded)
      } else {
        setSelectedUrls([existingUploaded[0]])
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
      await Promise.all([loadFolders(), loadAssets()])
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
      await Promise.all([loadFolders(), loadAssets()])
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
      setSelectedFolder(null)
      setSelectedRightFolders((prev) => prev.filter((item) => item !== folderPath))
      await Promise.all([loadFolders(), loadAssets()])
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
    setCreatingFolder(true)
    try {
      const res = await fetch("/api/admin/media/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clone", folder: folderPath }),
      })
      const json = await res.json().catch(() => null as null | { error?: string; folder?: string })
      if (!res.ok || !json?.folder) {
        throw new Error(json?.error || "Failed to clone folder")
      }
      toast.success(`Klonlandı: ${json.folder.split("/").pop() || json.folder}`)
      setSelectedFolder(json.folder)
      setSelectedRightFolders([json.folder])
      await Promise.all([loadFolders(), loadAssets()])
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
      await Promise.all([loadFolders(), loadAssets()])
      setSelectedUrls([])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to move image")
    } finally {
      setMoving(false)
    }
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
        className="!left-1/2 !top-1/2 !translate-x-[-50%] !translate-y-[-50%] !flex flex-col gap-0 overflow-hidden p-0"
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
                accept=".jpg,.jpeg,.png,.webp,.avif,.gif,.bmp,.heic,.heif,.jfif"
                multiple
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f8fafc] lg:flex-row">
            <div className="flex min-w-0 flex-1 flex-col p-5">
              <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-[#dce3ed] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
                <div className="shrink-0 p-6">
                  <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center xl:justify-start">
                    <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
                      <div className="grid gap-3 sm:grid-cols-[260px_260px_minmax(220px,1fr)_auto]">
                        <Select
                          value={activeFolder}
                          onValueChange={(value) => {
                            setActiveFolder(value)
                            setActiveSubfolder("all")
                            setSelectedChildFolder("")
                            setSelectedFolder(null)
                            setSelectedRightFolders([])
                            const nextFolder = value === "all" ? preferredUploadFolder || "categories" : value
                            setUploadFolder(nextFolder)
                          }}
                        >
                          <SelectTrigger className="h-12 border-[#cfd9e4] bg-white text-[15px]">
                            <SelectValue placeholder="All media items" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All media items</SelectItem>
                            {topFolders.map((folder) => (
                                <SelectItem key={folder.name} value={folder.name}>
                                  {topFolderLabels.get(folder.name) || formatFolderLabel(folder.name)}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>

                        <Select
                          value={activeSubfolder}
                          onValueChange={(value) => {
                            setActiveSubfolder(value)
                            setSelectedChildFolder("")
                            setSelectedFolder(null)
                            setSelectedRightFolders([])
                            const nextFolder = value === "all" ? (activeFolder === "all" ? preferredUploadFolder || "categories" : activeFolder) : value
                            setUploadFolder(nextFolder)
                          }}
                          disabled={activeFolder === "all"}
                        >
                          <SelectTrigger className="h-12 border-[#cfd9e4] bg-white text-[15px]">
                            <SelectValue placeholder="All subcategories" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All subcategories</SelectItem>
                            {subfolders.map((folder) => (
                              <SelectItem key={folder} value={folder}>
                                {subfolderLabels.get(folder) || formatFolderLabel(folder.split("/").pop() || folder)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Input
                          value={searchTerm}
                          onChange={(event) => setSearchTerm(event.target.value)}
                          placeholder="Search folders or images"
                          className="h-12 border-[#cfd9e4] bg-white text-[15px]"
                        />

                        <div className="flex gap-2">
                          <Button type="button" className="h-12 px-5" onClick={() => setTab("upload")} disabled={uploading}>
                            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                            Upload files
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 xl:ml-0">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (selectedUrls.length > 0) {
                            queueDeleteAssets(selectedUrls, `${selectedUrls.length} medya silinmek üzere işaretlendi`)
                            return
                          }
                          void (selectedFolder ? deleteFolder(selectedFolder) : deleteAllAssets())
                        }}
                        disabled={moving || (selectedUrls.length === 0 && !selectedFolder && activeFolder !== "all")}
                      >
                        Sil
                      </Button>
                    </div>
                  </div>
                </div>

                <div
                  ref={libraryScrollRef}
                  className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6"
                >
                  {loading ? (
                    <div className="flex h-[520px] items-center justify-center text-sm text-slate-500">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading media...
                    </div>
                  ) : !selectedChildFolder && visibleCurrentLevelFolders.length > 0 ? (
                    <div className="space-y-6">
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                        {visibleCurrentLevelFolders.map((folder) => {
                          const selected = selectedFolder === folder
                          const folderLeaf = folder.split("/").pop() || folder
                          return (
                            <div
                              key={folder}
                              role="button"
                              tabIndex={0}
                              onClick={(event) => {
                                const withMultiSelect = event.metaKey || event.ctrlKey
                                toggleRightFolderSelection(folder, withMultiSelect)
                                setSelectedChildFolder("")
                              }}
                              onDoubleClick={() => {
                                setSelectedFolder(folder)
                                setSelectedRightFolders([folder])
                                setSelectedChildFolder(folder)
                                setUploadFolder(folder)
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault()
                                  setSelectedFolder(folder)
                                  setSelectedRightFolders([folder])
                                  setSelectedChildFolder(folder)
                                  setUploadFolder(folder)
                                }
                              }}
                              className={`rounded-[28px] border bg-white p-6 text-left shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition ${selected ? "border-teal-500 ring-2 ring-teal-200" : "border-[#dce3ed]"}`}
                            >
                              <div className="mb-8 text-[#f59e0b]">
                                <FolderIcon className="h-9 w-9" />
                              </div>
                              <div>
                                <div className="text-[18px] font-semibold text-slate-900">{folderLeaf}</div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : sortedFilteredAssets.length === 0 ? (
                    <div className="flex h-[520px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#d7dee8] bg-[#f8fafc] text-slate-500">
                      <ImageIcon className="mb-3 h-10 w-10 text-slate-300" />
                      No images found
                    </div>
                  ) : (
                    <>
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                      {sortedFilteredAssets.map((asset) => {
                        const selected = selectedUrls.includes(asset.url)
                        const labelGroup = getAssetLabelGroup(asset)
                        const displayLabel = assetLabels[labelGroup] || prettifyPickerAssetName(asset)
                        return (
                          <div
                            key={asset.id}
                            role="button"
                            tabIndex={0}
                            onClick={(event) => toggleAssetWithModifier(asset.url, event.metaKey || event.ctrlKey)}
                            onDoubleClick={() => handleAssetDoubleClick(asset.url)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault()
                                toggleAssetWithModifier(asset.url, event.metaKey || event.ctrlKey)
                              }
                            }}
                            className={`overflow-hidden rounded-2xl border bg-white text-left transition ${
                              selected ? "border-teal-500 ring-2 ring-teal-200" : "border-[#dce3ed] hover:border-slate-300"
                            }`}
                          >
                            <div className="relative aspect-square overflow-hidden bg-slate-100">
                              <div className="absolute left-3 top-3 z-10 rounded-md bg-white/95 p-1.5">
                                {multiple ? (
                                  <Checkbox
                                    checked={selected}
                                    onClick={(event: React.MouseEvent<HTMLButtonElement>) => event.stopPropagation()}
                                    onCheckedChange={() => toggleAssetWithModifier(asset.url, true)}
                                  />
                                ) : (
                                  <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${selected ? "border-teal-600 bg-teal-600 text-white" : "border-slate-300 bg-white text-transparent"}`}>
                                    <Check className="h-3 w-3" />
                                  </span>
                                )}
                              </div>
                              <img src={asset.url} alt={asset.name} className="block h-full w-full object-cover" loading="lazy" />
                            </div>
                            <div className="space-y-1 p-3">
                              <p className="truncate text-sm font-medium text-slate-900">{displayLabel}</p>
                              <p className="truncate text-xs text-slate-500">{asset.folder}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="mt-5 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
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
                </div>
              </div>
            </div>
              <aside className="flex min-h-0 w-full shrink-0 flex-col border-t border-slate-200 bg-slate-50/70 lg:h-full lg:w-[360px] lg:border-l lg:border-t-0">
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
