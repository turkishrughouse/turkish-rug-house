"use client"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Category, Product } from "@prisma/client"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
    ChevronDown,
    Star,
} from "lucide-react"
import { toast } from "sonner"
import { parseProductImages } from "@/lib/product-images"
import {
    bulkDeleteProductsPermanently,
    bulkDeleteProducts,
    bulkRestoreProducts,
    bulkPublishProducts,
    deleteProduct,
    duplicateProduct,
    emptyProductTrash,
    restoreProduct,
    setProductFeatured,
} from "@/lib/actions/product-actions"
import type { AdminLanguage } from "@/lib/admin/i18n"

type ProductWithRelations = Omit<Product, "price" | "compareAtPrice" | "sku"> & {
    price: number
    compareAtPrice: number | null
    sku?: string | null
    isFeatured?: boolean
    categories: Category[]
}

type FilterOption = {
    slug?: string
    title?: string
    name?: string
    productCount?: number
}

interface ProductListProps {
    lang?: AdminLanguage
    initialProducts: ProductWithRelations[]
    metadata: {
        total: number
        page: number
        limit: number
        totalPages: number
    }
    stats: {
        all: number
        published: number
        draft: number
        featured: number
        trash: number
        sorting: number
        schedule: number
    }
    filters: {
        q: string
        status: string
        category: string
        type: string
        stock: string
        brand: string
        scheduleDate?: string
    }
    filterOptions: {
        categories: FilterOption[]
        types: FilterOption[]
        brands: FilterOption[]
    }
}

type BulkAction = "" | "publish" | "draft" | "delete" | "restore" | "delete_permanently"
type ColumnKey = "image" | "sku" | "status" | "stock" | "price" | "featured" | "actions"

export function ProductList({
    lang = "en",
    initialProducts,
    metadata,
    stats,
    filters,
    filterOptions,
}: ProductListProps) {
    const isTr = lang === "tr"
    const tx = (en: string, tr: string) => (isTr ? tr : en)
    const router = useRouter()
    const importInputRef = useRef<HTMLInputElement | null>(null)
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [bulkAction, setBulkAction] = useState<BulkAction>("")

    const [categoryFilter, setCategoryFilter] = useState(filters.category || "")
    const [typeFilter, setTypeFilter] = useState(filters.type || "")
    const [stockFilter, setStockFilter] = useState(filters.stock || "")
    const [brandFilter, setBrandFilter] = useState(filters.brand || "")
    const [scheduleDate, setScheduleDate] = useState(filters.scheduleDate || "")
    const [screenOptionsOpen, setScreenOptionsOpen] = useState(false)
    const [itemsPerPage, setItemsPerPage] = useState(String(metadata.limit))
    const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>({
        image: true,
        sku: true,
        status: true,
        stock: true,
        price: true,
        featured: true,
        actions: true,
    })

    const totalSelected = selectedIds.length
    const allSelected = initialProducts.length > 0 && totalSelected === initialProducts.length
    const visibleDataColumnCount = Object.values(visibleColumns).filter(Boolean).length + 2
    const inTrashView = (filters.status || "all") === "trash"

    const stockLabel = (product: ProductWithRelations) => {
        if (!product.isStock || product.stockCount <= 0) return tx("Out of stock", "Stokta yok")
        if (product.stockCount <= 2) return isTr ? `${product.stockCount} az stok` : `${product.stockCount} low stock`
        return isTr ? `${product.stockCount} stokta` : `${product.stockCount} in stock`
    }

    const updateQueryParams = (updates: Record<string, string | undefined>, resetPage = true) => {
        const params = new URLSearchParams(window.location.search)

        Object.entries(updates).forEach(([key, value]) => {
            if (!value) {
                params.delete(key)
                return
            }
            params.set(key, value)
        })

        if (resetPage) params.set("page", "1")
        const queryString = params.toString()
        router.replace(queryString ? `?${queryString}` : "?")
    }

    const handleApplyFilters = () => {
        updateQueryParams({
            category: categoryFilter || undefined,
            type: typeFilter || undefined,
            stock: stockFilter || undefined,
            brand: brandFilter || undefined,
        })
    }

    const handleStatusFilter = (status: string) => {
        if (status === "schedule") {
            const today = new Date().toISOString().slice(0, 10)
            const pickedDate = scheduleDate || filters.scheduleDate || today
            setScheduleDate(pickedDate)
            updateQueryParams({ status: "schedule", scheduleDate: pickedDate })
            return
        }
        updateQueryParams({ status: status === "all" ? undefined : status, scheduleDate: undefined })
    }

    const handleScheduleDateApply = (value: string) => {
        if (!value) return
        setScheduleDate(value)
        updateQueryParams({ status: "schedule", scheduleDate: value })
    }

    const handleApplyScreenOptions = () => {
        const normalizedPerPage = ["20", "50", "100", "200"].includes(itemsPerPage) ? itemsPerPage : "20"
        updateQueryParams({ perPage: normalizedPerPage })
        setScreenOptionsOpen(false)
    }

    const toggleColumn = (column: ColumnKey) => {
        setVisibleColumns((current) => ({ ...current, [column]: !current[column] }))
    }

    const toggleSelectAll = () => {
        if (allSelected) {
            setSelectedIds([])
            return
        }
        setSelectedIds(initialProducts.map((product) => product.id))
    }

    const toggleSelect = (id: string) => {
        setSelectedIds((current) =>
            current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
        )
    }

    const handleMoveToTrash = async (id: string) => {
        if (!confirm(tx("Move this product to trash?", "Bu ürün çöpe taşınsın mı?"))) return
        const result = await deleteProduct(id, false)
        if (!result.success) {
            toast.error(result.error || tx("Failed to move product to trash", "Ürün çöpe taşınamadı"))
            return
        }
        toast.success(tx("Product moved to trash", "Ürün çöpe taşındı"))
        router.refresh()
    }

    const handleRestore = async (id: string) => {
        const result = await restoreProduct(id)
        if (!result.success) {
            toast.error(result.error || tx("Failed to restore product", "Ürün geri yüklenemedi"))
            return
        }
        toast.success(tx("Product restored", "Ürün geri yüklendi"))
        router.refresh()
    }

    const handleDeletePermanently = async (id: string) => {
        if (!confirm(tx("Delete this product permanently? This cannot be undone.", "Bu ürün kalıcı olarak silinsin mi? Bu işlem geri alınamaz."))) return
        const result = await deleteProduct(id, true)
        if (!result.success) {
            toast.error(result.error || tx("Failed to delete product permanently", "Ürün kalıcı olarak silinemedi"))
            return
        }
        toast.success(tx("Product deleted permanently", "Ürün kalıcı olarak silindi"))
        router.refresh()
    }

    const handleEmptyTrash = async () => {
        if (!confirm(tx("Empty folder? All trashed products will be permanently deleted.", "Çöp klasörü boşaltılsın mı? Tüm çöp ürünler kalıcı olarak silinir."))) return
        const result = await emptyProductTrash()
        if (!result.success) {
            toast.error(result.error || tx("Failed to empty folder", "Klasör boşaltılamadı"))
            return
        }
        toast.success(tx("Trash folder emptied", "Çöp klasörü boşaltıldı"))
        router.refresh()
    }

    const handleDuplicate = async (id: string) => {
        setIsLoading(true)
        const result = await duplicateProduct(id)
        setIsLoading(false)
        if (!result.success) {
            toast.error(result.error || tx("Failed to duplicate product", "Ürün kopyalanamadı"))
            return
        }
        toast.success(tx("Product duplicated", "Ürün kopyalandı"))
        router.refresh()
    }

    const handleToggleFeatured = async (id: string, currentValue: boolean) => {
        const result = await setProductFeatured(id, !currentValue)
        if (!result.success) {
            toast.error(result.error || tx("Failed to update featured", "Öne çıkan durumu güncellenemedi"))
            return
        }
        toast.success(!currentValue ? tx("Added to featured", "Öne çıkanlara eklendi") : tx("Removed from featured", "Öne çıkanlardan çıkarıldı"))
        router.refresh()
    }

    const handleApplyBulkAction = async () => {
        if (!bulkAction || totalSelected === 0) return

        if (inTrashView && bulkAction === "restore") {
            const result = await bulkRestoreProducts(selectedIds)
            if (!result.success) {
                toast.error(result.error || tx("Bulk restore failed", "Toplu geri yükleme başarısız"))
                return
            }
            toast.success(tx("Products restored", "Ürünler geri yüklendi"))
        } else if (inTrashView && bulkAction === "delete_permanently") {
            if (!confirm(isTr ? `${totalSelected} ürün kalıcı olarak silinecek. Devam edilsin mi?` : `${totalSelected} products will be permanently deleted. Continue?`)) return
            const result = await bulkDeleteProductsPermanently(selectedIds)
            if (!result.success) {
                toast.error(result.error || tx("Bulk permanent delete failed", "Toplu kalıcı silme başarısız"))
                return
            }
            toast.success(tx("Products deleted permanently", "Ürünler kalıcı olarak silindi"))
        } else if (bulkAction === "delete") {
            if (!confirm(isTr ? `${totalSelected} ürün çöpe taşınacak. Devam edilsin mi?` : `${totalSelected} products will be moved to trash. Continue?`)) return
            const result = await bulkDeleteProducts(selectedIds)
            if (!result.success) {
                toast.error(result.error || tx("Bulk delete failed", "Toplu silme başarısız"))
                return
            }
            toast.success(tx("Products moved to trash", "Ürünler çöpe taşındı"))
        } else {
            const publishState = bulkAction === "publish"
            const result = await bulkPublishProducts(selectedIds, publishState)
            if (!result.success) {
                toast.error(result.error || tx("Bulk update failed", "Toplu güncelleme başarısız"))
                return
            }
            toast.success(publishState ? tx("Products published", "Ürünler yayınlandı") : tx("Products moved to draft", "Ürünler taslağa taşındı"))
        }

        setBulkAction("")
        setSelectedIds([])
        router.refresh()
    }

    const handleExport = () => {
        window.location.href = "/api/admin/products/export"
    }

    const handleImportButtonClick = () => {
        importInputRef.current?.click()
    }

    const handleImportFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        const formData = new FormData()
        formData.append("file", file)
        setIsLoading(true)

        try {
            const response = await fetch("/api/admin/products/import", {
                method: "POST",
                body: formData,
            })
            const payload = (await response.json().catch(() => ({}))) as {
                error?: string
                created?: number
                updated?: number
                skipped?: number
                errors?: string[]
            }

            if (!response.ok) {
                toast.error(payload.error || tx("Import failed", "İçe aktarma başarısız"))
                return
            }

            toast.success(
                isTr
                    ? `İçe aktarma tamamlandı. Oluşturulan: ${payload.created || 0}, Güncellenen: ${payload.updated || 0}, Atlanan: ${payload.skipped || 0}`
                    : `Import completed. Created: ${payload.created || 0}, Updated: ${payload.updated || 0}, Skipped: ${payload.skipped || 0}`
            )
            if (Array.isArray(payload.errors) && payload.errors.length > 0) {
                toast.warning(isTr ? `Bazı satırlar atlandı. İlk hata: ${payload.errors[0]}` : `Some rows were skipped. First issue: ${payload.errors[0]}`)
            }
            router.refresh()
        } catch {
            toast.error(tx("Import failed", "İçe aktarma başarısız"))
        } finally {
            setIsLoading(false)
            event.target.value = ""
        }
    }

    const statusTabs = useMemo(
        () => [
            { key: "all", label: isTr ? `Tümü (${stats.all})` : `All (${stats.all})` },
            { key: "published", label: isTr ? `Yayında (${stats.published})` : `Published (${stats.published})` },
            { key: "draft", label: isTr ? `Taslak (${stats.draft})` : `Draft (${stats.draft})` },
            { key: "featured", label: isTr ? `Öne Çıkan (${stats.featured})` : `Featured (${stats.featured})` },
            { key: "trash", label: isTr ? `Çöp (${stats.trash})` : `Trash (${stats.trash})` },
            { key: "schedule", label: isTr ? `Takvim (${stats.schedule})` : `Schedule (${stats.schedule})` },
            { key: "sorting", label: isTr ? `Sıralama (${stats.sorting})` : `Sorting (${stats.sorting})` },
        ],
        [isTr, stats]
    )

    const lightActionButton =
        "border-[#c3c4c7] bg-[#f6f7f7] text-slate-800 hover:bg-white hover:text-slate-900"
    const lightPrimaryButton =
        "border-[#c3c4c7] bg-[#eef3f8] text-slate-800 hover:bg-[#e4ecf6] hover:text-slate-900"

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <h1 className="text-[30px] leading-none font-medium text-slate-900">{tx("Products", "Ürünler")}</h1>
                    <Button
                        variant="outline"
                        className={`h-9 rounded-sm px-4 text-[13px] font-semibold ${lightPrimaryButton}`}
                        onClick={() => router.push("/dashboard/products/new")}
                    >
                        {tx("Add new product", "Yeni ürün ekle")}
                    </Button>
                    <Button
                        variant="outline"
                        className={`h-9 rounded-sm px-4 text-[13px] font-semibold ${lightPrimaryButton}`}
                        onClick={handleImportButtonClick}
                        disabled={isLoading}
                    >
                        {tx("Import", "İçe aktar")}
                    </Button>
                    <Button
                        variant="outline"
                        className={`h-9 rounded-sm px-4 text-[13px] font-semibold ${lightPrimaryButton}`}
                        onClick={handleExport}
                    >
                        {tx("Export", "Dışa aktar")}
                    </Button>
                    <input
                        ref={importInputRef}
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={handleImportFileChange}
                    />
                </div>
                <div className="hidden md:flex items-center gap-2">
                    <Button
                        variant="outline"
                        className={`h-9 rounded-sm px-3 text-[13px] ${lightActionButton}`}
                        onClick={() => setScreenOptionsOpen((current) => !current)}
                    >
                        {tx("Screen Options", "Ekran Seçenekleri")}
                        <ChevronDown className="ml-1 h-4 w-4" />
                    </Button>
                </div>
            </div>

            {screenOptionsOpen ? (
                <div className="rounded-sm border border-[#dcdcde] bg-[#f6f7f7] p-4">
                    <div className="space-y-4">
                        <div>
                            <p className="text-sm font-semibold text-slate-900">{tx("Columns", "Sütunlar")}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-4">
                                <label className="flex items-center gap-2 text-sm text-slate-700">
                                    <Checkbox checked={visibleColumns.image} onCheckedChange={() => toggleColumn("image")} />
                                    {tx("Image", "Görsel")}
                                </label>
                                <label className="flex items-center gap-2 text-sm text-slate-700">
                                    <Checkbox checked={visibleColumns.sku} onCheckedChange={() => toggleColumn("sku")} />
                                    SKU
                                </label>
                                <label className="flex items-center gap-2 text-sm text-slate-700">
                                    <Checkbox checked={visibleColumns.status} onCheckedChange={() => toggleColumn("status")} />
                                    {tx("Status", "Durum")}
                                </label>
                                <label className="flex items-center gap-2 text-sm text-slate-700">
                                    <Checkbox checked={visibleColumns.stock} onCheckedChange={() => toggleColumn("stock")} />
                                    {tx("Stock", "Stok")}
                                </label>
                                <label className="flex items-center gap-2 text-sm text-slate-700">
                                    <Checkbox checked={visibleColumns.price} onCheckedChange={() => toggleColumn("price")} />
                                    {tx("Price", "Fiyat")}
                                </label>
                                <label className="flex items-center gap-2 text-sm text-slate-700">
                                    <Checkbox checked={visibleColumns.featured} onCheckedChange={() => toggleColumn("featured")} />
                                    {tx("Featured", "Öne Çıkan")}
                                </label>
                                <label className="flex items-center gap-2 text-sm text-slate-700">
                                    <Checkbox checked={visibleColumns.actions} onCheckedChange={() => toggleColumn("actions")} />
                                    {tx("Actions", "İşlemler")}
                                </label>
                            </div>
                        </div>

                        <div className="flex items-end gap-2">
                            <div>
                                <p className="mb-1 text-sm font-semibold text-slate-900">{tx("Pagination", "Sayfalama")}</p>
                                <label className="text-sm text-slate-700">{tx("Number of items per page:", "Sayfa başına öğe sayısı:")}</label>
                            </div>
                            <select
                                value={itemsPerPage}
                                onChange={(event) => setItemsPerPage(event.target.value)}
                                className="h-10 w-[100px] rounded-sm border border-[#8c8f94] bg-white px-2.5 text-[13px] text-slate-700"
                            >
                                <option value="20">20</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                                <option value="200">200</option>
                            </select>
                            <Button
                                variant="outline"
                                className={`h-10 rounded-sm px-4 text-[12px] font-semibold ${lightPrimaryButton}`}
                                onClick={handleApplyScreenOptions}
                            >
                                {tx("Apply", "Uygula")}
                            </Button>
                        </div>
                    </div>
                </div>
            ) : null}

            <div className="flex items-end justify-between gap-4">
                <div className="flex items-center gap-2 whitespace-nowrap text-[15px]">
                    {statusTabs.map((tab, index) => {
                        const isActive =
                            (filters.status || "all") === tab.key ||
                            ((filters.status || "all") === "all" && tab.key === "all")

                        return (
                            <div key={tab.key} className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleStatusFilter(tab.key)}
                                    className={`rounded-sm px-1 py-0.5 text-[15px] leading-none transition-colors ${
                                        isActive
                                            ? "font-semibold text-slate-900 hover:text-[#135e96]"
                                            : "font-medium text-[#2271b1] hover:text-[#135e96]"
                                    }`}
                                >
                                    {tab.label}
                                </button>
                                {index < statusTabs.length - 1 ? <span className="text-slate-400">|</span> : null}
                            </div>
                        )
                    })}
                    {inTrashView ? (
                        <>
                            <span className="text-slate-400">|</span>
                            <button
                                type="button"
                                onClick={handleEmptyTrash}
                                className="rounded-sm px-1 py-0.5 text-[15px] font-semibold leading-none text-red-600 transition-colors hover:text-red-700"
                            >
                                {tx("Empty Trash", "Çöpü Boşalt")}
                            </button>
                        </>
                    ) : null}
                </div>

                <div />
            </div>

            {(filters.status || "all") === "schedule" ? (
                <div className="mt-2 inline-flex items-center gap-2 rounded-sm border border-[#dcdcde] bg-[#f6f7f7] px-3 py-2">
                    <label className="text-[12px] font-semibold text-slate-700">
                        {tx("Select date", "Tarih seç")}
                    </label>
                    <input
                        type="date"
                        value={scheduleDate}
                        onChange={(event) => handleScheduleDateApply(event.target.value)}
                        className="h-9 rounded-sm border border-[#8c8f94] bg-white px-2.5 text-[13px] text-slate-700"
                    />
                    <Button
                        type="button"
                        variant="outline"
                        className={`h-9 rounded-sm px-3 text-[12px] font-semibold ${lightPrimaryButton}`}
                        onClick={() => handleScheduleDateApply(scheduleDate || new Date().toISOString().slice(0, 10))}
                    >
                        {tx("Apply", "Uygula")}
                    </Button>
                </div>
            ) : null}

            <div className="border-y border-[#dcdcde] py-3">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                    <select
                        value={bulkAction}
                        onChange={(event) => setBulkAction(event.target.value as BulkAction)}
                        className="h-10 w-[150px] rounded-sm border border-[#8c8f94] bg-white px-2.5 text-[13px] text-slate-700"
                    >
                        <option value="">{tx("Bulk actions", "Toplu işlemler")}</option>
                        {inTrashView ? (
                            <>
                                <option value="restore">{tx("Restore", "Geri yükle")}</option>
                                <option value="delete_permanently">{tx("Delete permanently", "Kalıcı sil")}</option>
                            </>
                        ) : (
                            <>
                                <option value="publish">{tx("Publish", "Yayınla")}</option>
                                <option value="draft">{tx("Move to draft", "Taslağa taşı")}</option>
                                <option value="delete">{tx("Move to trash", "Çöpe taşı")}</option>
                            </>
                        )}
                    </select>
                    <Button
                        variant="outline"
                        className={`h-10 rounded-sm px-3 text-[12px] font-semibold ${lightPrimaryButton}`}
                        disabled={!bulkAction || totalSelected === 0}
                        onClick={handleApplyBulkAction}
                    >
                        {tx("Apply", "Uygula")}
                    </Button>

                    <select
                        value={categoryFilter}
                        onChange={(event) => setCategoryFilter(event.target.value)}
                        className="h-10 w-[250px] rounded-sm border border-[#8c8f94] bg-white px-2.5 text-[13px] text-slate-700"
                    >
                        <option value="">{tx("Select a category", "Kategori seç")}</option>
                        {filterOptions.categories.map((category) => (
                            <option key={category.slug || category.title} value={category.slug || ""}>
                                {`${category.title} (${category.productCount ?? 0})`}
                            </option>
                        ))}
                    </select>

                    <select
                        value={typeFilter}
                        onChange={(event) => setTypeFilter(event.target.value)}
                        className="h-10 w-[165px] rounded-sm border border-[#8c8f94] bg-white px-2.5 text-[13px] text-slate-700"
                    >
                        <option value="">{tx("Filter by product type", "Ürün türüne göre filtrele")}</option>
                        {filterOptions.types.map((type) => (
                            <option key={type.slug || type.name} value={type.slug || ""}>
                                {type.name}
                            </option>
                        ))}
                    </select>

                    <select
                        value={stockFilter}
                        onChange={(event) => setStockFilter(event.target.value)}
                        className="h-10 w-[165px] rounded-sm border border-[#8c8f94] bg-white px-2.5 text-[13px] text-slate-700"
                    >
                        <option value="">{tx("Filter by stock status", "Stok durumuna göre filtrele")}</option>
                        <option value="instock">{tx("In stock", "Stokta")}</option>
                        <option value="outofstock">{tx("Out of stock", "Stokta yok")}</option>
                    </select>

                    <select
                        value={brandFilter}
                        onChange={(event) => setBrandFilter(event.target.value)}
                        className="h-10 w-[150px] rounded-sm border border-[#8c8f94] bg-white px-2.5 text-[13px] text-slate-700"
                    >
                        <option value="">{tx("Filter by brand", "Markaya göre filtrele")}</option>
                        {filterOptions.brands.map((brand) => (
                            <option key={brand.slug || brand.name} value={brand.slug || ""}>
                                {brand.name}
                            </option>
                        ))}
                    </select>

                    <Button
                        variant="outline"
                        className={`h-10 rounded-sm px-3 text-[12px] font-semibold ${lightPrimaryButton}`}
                        onClick={handleApplyFilters}
                    >
                        {tx("Filter", "Filtrele")}
                    </Button>
                </div>
                    <div className="ml-auto whitespace-nowrap text-[13px] font-medium text-slate-600">{metadata.total} {tx("items", "öğe")}</div>
                </div>
            </div>

            <div className="rounded-sm border border-[#dcdcde] bg-white">
                <Table>
                    <TableHeader className="[&_tr]:bg-[#f6f7f7]">
                        <TableRow>
                            <TableHead className="w-[48px]">
                                <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
                            </TableHead>
                            {visibleColumns.image ? <TableHead className="w-[90px]">{tx("Image", "Görsel")}</TableHead> : null}
                            <TableHead>{tx("Product", "Ürün")}</TableHead>
                            {visibleColumns.sku ? <TableHead>SKU</TableHead> : null}
                            {visibleColumns.status ? <TableHead>{tx("Status", "Durum")}</TableHead> : null}
                            {visibleColumns.stock ? <TableHead>{tx("Stock", "Stok")}</TableHead> : null}
                            {visibleColumns.price ? <TableHead className="text-right">{tx("Price", "Fiyat")}</TableHead> : null}
                            {visibleColumns.featured ? <TableHead className="text-center">{tx("Featured", "Öne Çıkan")}</TableHead> : null}
                            {visibleColumns.actions ? <TableHead className="w-[72px] text-right">{tx("Actions", "İşlemler")}</TableHead> : null}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {initialProducts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={visibleDataColumnCount} className="h-28 text-center text-slate-500">
                                    {tx("No products found.", "Ürün bulunamadı.")}
                                </TableCell>
                            </TableRow>
                        ) : (
                            initialProducts.map((product) => {
                                const mainImage = parseProductImages(product.images)[0] || null

                                return (
                                    <TableRow key={product.id} className="group transition-colors hover:bg-slate-50/80">
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedIds.includes(product.id)}
                                                onCheckedChange={() => toggleSelect(product.id)}
                                            />
                                        </TableCell>
                                        {visibleColumns.image ? (
                                            <TableCell>
                                                <div className="h-12 w-12 overflow-hidden rounded-sm border border-[#dcdcde] bg-[#f6f7f7]">
                                                    {mainImage ? (
                                                        <img src={mainImage} alt={product.title} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">
                                                            IMG
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                        ) : null}
                                        <TableCell>
                                            <div className="space-y-1.5">
                                                <Link
                                                    href={`/dashboard/products/${product.id}`}
                                                    prefetch={false}
                                                    className="inline-flex font-semibold text-slate-900 transition-colors hover:text-[#135e96] hover:underline hover:underline-offset-2"
                                                >
                                                    {product.title}
                                                </Link>
                                                <div className="text-xs text-slate-500">{tx("Slug:", "Slug:")} {product.slug}</div>
                                                <div className="text-xs text-slate-500">
                                                    {product.categories.length > 0
                                                        ? product.categories.map((category) => category.title).join(", ")
                                                        : tx("Uncategorized", "Kategorisiz")}
                                                </div>
                                                {!inTrashView ? (
                                                    <div className="min-h-[20px] pt-1 text-xs leading-5 text-slate-500 opacity-0 transition-opacity group-hover:opacity-100">
                                                        <div className="flex flex-wrap items-center gap-x-4">
                                                            <Link
                                                                href={`/dashboard/products/${product.id}`}
                                                                prefetch={false}
                                                                className="font-medium text-[#2271b1] hover:text-[#135e96]"
                                                            >
                                                                {tx("Edit", "Düzenle")}
                                                            </Link>
                                                            <span className="px-1 text-slate-300">-</span>
                                                            <Link
                                                                href={`/product/${product.slug}`}
                                                                target="_blank"
                                                                className="font-medium text-[#2271b1] hover:text-[#135e96]"
                                                            >
                                                                {tx("View", "Görüntüle")}
                                                            </Link>
                                                            <span className="px-1 text-slate-300">-</span>
                                                            <button
                                                                type="button"
                                                                disabled={isLoading}
                                                                onClick={() => handleDuplicate(product.id)}
                                                                className="cursor-pointer font-medium text-[#2271b1] hover:text-[#135e96] disabled:cursor-not-allowed disabled:opacity-50"
                                                            >
                                                                {tx("Duplicate", "Kopyala")}
                                                            </button>
                                                            <span className="px-1 text-slate-300">-</span>
                                                            <button
                                                                type="button"
                                                                disabled={isLoading}
                                                                onClick={() => handleMoveToTrash(product.id)}
                                                                className="cursor-pointer font-medium text-[#b32d2e] hover:text-[#8a2424] disabled:cursor-not-allowed disabled:opacity-50"
                                                            >
                                                                {tx("Trash", "Çöp")}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="min-h-[20px] pt-1 text-xs leading-5 text-slate-500 opacity-0 transition-opacity group-hover:opacity-100">
                                                        <div className="flex flex-wrap items-center gap-x-4">
                                                            <button
                                                                type="button"
                                                                disabled={isLoading}
                                                                onClick={() => handleRestore(product.id)}
                                                                className="cursor-pointer font-medium text-[#2271b1] hover:text-[#135e96] disabled:cursor-not-allowed disabled:opacity-50"
                                                            >
                                                                {tx("Restore", "Geri Yükle")}
                                                            </button>
                                                            <span className="px-1 text-slate-300">-</span>
                                                            <button
                                                                type="button"
                                                                disabled={isLoading}
                                                                onClick={() => handleDeletePermanently(product.id)}
                                                                className="cursor-pointer font-medium text-[#b32d2e] hover:text-[#8a2424] disabled:cursor-not-allowed disabled:opacity-50"
                                                            >
                                                                {tx("Delete permanently", "Kalıcı Sil")}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        {visibleColumns.sku ? (
                                            <TableCell>
                                                <span className="text-sm text-slate-700">{product.sku || "-"}</span>
                                            </TableCell>
                                        ) : null}
                                        {visibleColumns.status ? (
                                            <TableCell>
                                                <Badge variant={product.isPublished ? "success" : "secondary"}>
                                                    {product.isPublished ? tx("Published", "Yayında") : tx("Draft", "Taslak")}
                                                </Badge>
                                            </TableCell>
                                        ) : null}
                                        {visibleColumns.stock ? (
                                            <TableCell>
                                                <span
                                                    className={`text-sm ${
                                                        !product.isStock || product.stockCount <= 0 ? "text-red-600" : "text-slate-700"
                                                    }`}
                                                >
                                                    {stockLabel(product)}
                                                </span>
                                            </TableCell>
                                        ) : null}
                                        {visibleColumns.price ? (
                                            <TableCell className="text-right font-semibold text-slate-900">
                                                ${Number(product.price).toFixed(2)}
                                            </TableCell>
                                        ) : null}
                                        {visibleColumns.featured ? (
                                            <TableCell className="text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleFeatured(product.id, Boolean(product.isFeatured))}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-sm hover:bg-slate-100"
                                                    aria-label={product.isFeatured ? tx("Remove featured", "Öne çıkandan kaldır") : tx("Set featured", "Öne çıkan yap")}
                                                >
                                                    <Star
                                                        className={`h-5 w-5 ${
                                                            product.isFeatured
                                                                ? "fill-yellow-400 text-yellow-500"
                                                                : "text-slate-400"
                                                        }`}
                                                    />
                                                </button>
                                            </TableCell>
                                        ) : null}
                                        {visibleColumns.actions ? (
                                            <TableCell className="w-[1%] whitespace-nowrap text-right text-xs text-slate-300">|</TableCell>
                                        ) : null}
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-between py-2 text-sm text-slate-600">
                <div>
                    {isTr
                        ? `${metadata.total} üründen ${initialProducts.length} gösteriliyor`
                        : `Showing ${initialProducts.length} of ${metadata.total} products`}
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={metadata.page <= 1}
                        onClick={() => updateQueryParams({ page: String(metadata.page - 1) }, false)}
                    >
                        {tx("Previous", "Önceki")}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={metadata.page >= metadata.totalPages}
                        onClick={() => updateQueryParams({ page: String(metadata.page + 1) }, false)}
                    >
                        {tx("Next", "Sonraki")}
                    </Button>
                </div>
            </div>
        </div>
    )
}
