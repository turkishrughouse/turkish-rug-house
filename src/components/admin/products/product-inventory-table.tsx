"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Download, Images } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  bulkAdjustProductPrices,
  bulkDeleteProducts,
  bulkPublishProducts,
  deleteProduct,
  duplicateProduct,
} from "@/lib/actions/product-actions"
import type { AdminLanguage } from "@/lib/admin/i18n"
import type {
  InventoryProductRow,
  InventoryStats,
  SoldInventoryRow,
  SupplierPerformanceRow,
} from "@/lib/admin-inventory"

function formatCurrency(value: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatDate(value: Date | null) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(value)
}

function formatDateTime(value: Date | string | null) {
  if (!value) return "-"
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function formatPercent(value: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-"
  return `${value.toFixed(1)}%`
}

function metricLabel(status: "missing" | "partial" | "complete", tx: (en: string, tr: string) => string) {
  if (status === "complete") return tx("Complete", "Tam")
  if (status === "partial") return tx("Partial", "Kısmi")
  return tx("Missing", "Eksik")
}

type BulkAction = "" | "publish" | "draft" | "delete" | "increase-price" | "decrease-price"

function RowHoverActions({
  editHref,
  viewHref,
  onDuplicate,
  onTrash,
  tx,
}: {
  editHref: string
  viewHref: string
  onDuplicate: () => void
  onTrash: () => void
  tx: (en: string, tr: string) => string
}) {
  return (
    <div className="flex items-center gap-2 text-xs opacity-0 transition-opacity group-hover:opacity-100">
      <Link href={editHref} className="text-[#2271b1] hover:text-[#135e96] hover:underline">
        {tx("Edit", "Düzenle")}
      </Link>
      <span className="text-slate-300">|</span>
      <Link href={viewHref} className="text-[#2271b1] hover:text-[#135e96] hover:underline">
        {tx("View", "Görüntüle")}
      </Link>
      <span className="text-slate-300">|</span>
      <button type="button" onClick={onDuplicate} className="text-[#2271b1] hover:text-[#135e96] hover:underline">
        {tx("Duplicate", "Kopyala")}
      </button>
      <span className="text-slate-300">|</span>
      <button type="button" onClick={onTrash} className="text-[#b32d2e] hover:text-[#8a2424] hover:underline">
        {tx("Trash", "Çöp")}
      </button>
    </div>
  )
}

export function ProductInventoryTable({
  lang = "en",
  rows,
  soldRows,
  stats,
  supplier,
  status,
  supplierOptions,
  supplierPerformance,
  mode = "inventory",
}: {
  lang?: AdminLanguage
  rows: InventoryProductRow[]
  soldRows: SoldInventoryRow[]
  stats: InventoryStats
  supplier: string
  status: string
  supplierOptions: string[]
  supplierPerformance: SupplierPerformanceRow[]
  mode?: "inventory" | "sold"
}) {
  const isTr = lang === "tr"
  const tx = (en: string, tr: string) => (isTr ? tr : en)
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkAction, setBulkAction] = useState<BulkAction>("")
  const [bulkPercentage, setBulkPercentage] = useState("")

  const exportParams = new URLSearchParams()
  if (supplier) exportParams.set("supplier", supplier)
  if (mode === "inventory" && status && status !== "ALL") exportParams.set("status", status)
  if (mode === "sold") exportParams.set("status", "SOLD")
  const queryString = exportParams.toString()
  const exportHref = `/api/admin/products/export${queryString ? `?${queryString}` : ""}`
  const exportImagesHref = `/api/admin/products/export-images${queryString ? `?${queryString}` : ""}`
  const allSelected = rows.length > 0 && selectedIds.length === rows.length

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([])
      return
    }
    setSelectedIds(rows.map((row) => row.id))
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    )
  }

  const handleDuplicateProduct = async (id: string) => {
    const result = await duplicateProduct(id)
    if (!result.success) {
      toast.error(result.error || tx("Duplicate failed", "Kopyalama başarısız"))
      return
    }
    toast.success(tx("Product duplicated", "Ürün kopyalandı"))
    router.refresh()
  }

  const handleTrashProduct = async (id: string) => {
    if (!confirm(tx("This product will be moved to trash. Continue?", "Bu ürün çöpe taşınacak. Devam edilsin mi?"))) {
      return
    }
    const result = await deleteProduct(id, false)
    if (!result.success) {
      toast.error(result.error || tx("Delete failed", "Silme başarısız"))
      return
    }
    toast.success(tx("Product moved to trash", "Ürün çöpe taşındı"))
    router.refresh()
  }

  const handleApplyBulkAction = async () => {
    if (mode !== "inventory" || !bulkAction || selectedIds.length === 0) return

    if (bulkAction === "delete") {
      if (!confirm(tx(`${selectedIds.length} products will be moved to trash. Continue?`, `${selectedIds.length} ürün çöpe taşınacak. Devam edilsin mi?`))) {
        return
      }
      const result = await bulkDeleteProducts(selectedIds)
      if (!result.success) {
        toast.error(result.error || tx("Bulk delete failed", "Toplu silme başarısız"))
        return
      }
      toast.success(tx("Products moved to trash", "Ürünler çöpe taşındı"))
    } else if (bulkAction === "increase-price" || bulkAction === "decrease-price") {
      const percentage = Number(bulkPercentage)
      if (!Number.isFinite(percentage) || percentage <= 0) {
        toast.error(tx("Enter a valid percentage", "Geçerli bir yüzde girin"))
        return
      }
      const result = await bulkAdjustProductPrices(
        selectedIds,
        bulkAction === "increase-price" ? "increase" : "decrease",
        percentage
      )
      if (!result.success) {
        toast.error(result.error || tx("Bulk price update failed", "Toplu fiyat güncellemesi başarısız"))
        return
      }
      toast.success(
        bulkAction === "increase-price"
          ? tx("Prices increased", "Fiyatlar artırıldı")
          : tx("Prices decreased", "Fiyatlar düşürüldü")
      )
    } else {
      const publishState = bulkAction === "publish"
      const result = await bulkPublishProducts(selectedIds, publishState)
      if (!result.success) {
        toast.error(result.error || tx("Bulk update failed", "Toplu güncelleme başarısız"))
        return
      }
      toast.success(
        publishState
          ? tx("Products published", "Ürünler yayınlandı")
          : tx("Products moved to draft", "Ürünler taslağa taşındı")
      )
    }

    setSelectedIds([])
    setBulkAction("")
    setBulkPercentage("")
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[30px] leading-none font-medium text-slate-900">
            {mode === "sold" ? tx("Sold Rugs Archive", "Satılan Halılar Arşivi") : tx("Inventory", "Envanter")}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {mode === "sold"
              ? tx("Operational sold-rug archive based on real product and order data.", "Gerçek ürün ve sipariş verisine dayalı satılan halılar arşivi.")
              : tx("Operational inventory view for product records.", "Ürün kayıtları için operasyonel envanter görünümü.")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="h-10 rounded-sm border-[#c3c4c7] bg-[#f6f7f7] px-3 text-[12px] font-semibold text-slate-800 hover:bg-white">
            <a href={exportHref}>
              <Download className="mr-2 h-4 w-4" />
              {tx("Export Inventory (CSV)", "Envanteri Dışa Aktar (CSV)")}
            </a>
          </Button>
          <Button asChild variant="outline" className="h-10 rounded-sm border-[#c3c4c7] bg-[#f6f7f7] px-3 text-[12px] font-semibold text-slate-800 hover:bg-white">
            <a href={exportImagesHref}>
              <Images className="mr-2 h-4 w-4" />
              {tx("Export Images (ZIP)", "Görselleri Dışa Aktar (ZIP)")}
            </a>
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-[#dcdcde]">
        <Link
          href="/dashboard/products/inventory"
          className={`inline-flex h-10 items-center rounded-t-sm border border-b-0 px-4 text-sm font-medium ${mode === "inventory" ? "border-[#dcdcde] bg-white text-slate-900" : "border-transparent bg-transparent text-slate-500 hover:text-slate-900"}`}
        >
          {tx("Inventory", "Envanter")}
        </Link>
        <Link
          href="/dashboard/products/inventory/sold"
          className={`inline-flex h-10 items-center rounded-t-sm border border-b-0 px-4 text-sm font-medium ${mode === "sold" ? "border-[#dcdcde] bg-white text-slate-900" : "border-transparent bg-transparent text-slate-500 hover:text-slate-900"}`}
        >
          {tx("Sold Archive", "Satılanlar")}
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-4 xl:grid-cols-8">
        {[
          { label: tx("Total Products", "Toplam Ürün"), value: stats.totalProducts },
          { label: tx("Total Stock", "Toplam Stok"), value: stats.totalStock },
          { label: tx("Out of Stock", "Stokta Yok"), value: stats.outOfStock },
          { label: tx("Reserved", "Rezerve"), value: stats.reserved },
          { label: tx("Sold", "Satıldı"), value: stats.sold },
          { label: tx("Avg Days", "Ort. Gün"), value: stats.averageDaysInStock ?? "-" },
          { label: tx("Missing Images", "Görsel Eksik"), value: stats.productsMissingImages },
          { label: tx("Missing SEO", "SEO Eksik"), value: stats.productsMissingSeo },
        ].map((item) => (
          <div key={item.label} className="rounded-sm border border-[#dcdcde] bg-white px-4 py-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-sm border border-[#dcdcde] bg-white">
        <div className="border-b border-[#dcdcde] px-4 py-3">
          <form className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label htmlFor="inventory-supplier" className="text-xs font-medium uppercase tracking-wide text-slate-600">
                {tx("Supplier", "Tedarikçi")}
              </label>
              <select
                id="inventory-supplier"
                name="supplier"
                defaultValue={supplier}
                className="h-10 min-w-[220px] rounded-sm border border-[#8c8f94] bg-white px-3 text-sm text-slate-700"
              >
                <option value="">{tx("All suppliers", "Tüm tedarikçiler")}</option>
                {supplierOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            {mode === "inventory" ? (
              <div className="space-y-1">
                <label htmlFor="inventory-status" className="text-xs font-medium uppercase tracking-wide text-slate-600">
                  {tx("Business status", "İş durumu")}
                </label>
                <select
                  id="inventory-status"
                  name="status"
                  defaultValue={status}
                  className="h-10 min-w-[180px] rounded-sm border border-[#8c8f94] bg-white px-3 text-sm text-slate-700"
                >
                  <option value="ALL">{tx("All statuses", "Tüm durumlar")}</option>
                  <option value="AVAILABLE">{tx("Available", "Müsait")}</option>
                  <option value="RESERVED">{tx("Reserved", "Rezerve")}</option>
                  <option value="SOLD">{tx("Sold", "Satıldı")}</option>
                  <option value="RETURNED">{tx("Returned", "İade")}</option>
                </select>
              </div>
            ) : null}
            <Button type="submit" variant="outline" className="h-10 rounded-sm border-[#c3c4c7] bg-[#f6f7f7] px-3 text-[12px] font-semibold text-slate-800 hover:bg-white">
              {tx("Filter", "Filtrele")}
            </Button>
            {(supplier || (mode === "inventory" && status !== "ALL")) ? (
              <Button asChild type="button" variant="outline" className="h-10 rounded-sm border-[#c3c4c7] bg-[#f6f7f7] px-3 text-[12px] font-semibold text-slate-800 hover:bg-white">
                <Link href={mode === "sold" ? "/dashboard/products/inventory/sold" : "/dashboard/products/inventory"}>
                  {tx("Reset", "Sıfırla")}
                </Link>
              </Button>
            ) : null}
          </form>
          {mode === "inventory" ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                value={bulkAction}
                onChange={(event) => setBulkAction(event.target.value as BulkAction)}
                className="h-10 w-[170px] rounded-sm border border-[#8c8f94] bg-white px-2.5 text-[13px] text-slate-700"
              >
                <option value="">{tx("Bulk actions", "Toplu işlemler")}</option>
                <option value="publish">{tx("Publish", "Yayınla")}</option>
                <option value="draft">{tx("Move to draft", "Taslağa taşı")}</option>
                <option value="delete">{tx("Move to trash", "Çöpe taşı")}</option>
                <option value="increase-price">{tx("Increase price (%)", "Fiyat artır (%)")}</option>
                <option value="decrease-price">{tx("Decrease price (%)", "Fiyat düşür (%)")}</option>
              </select>
              {bulkAction === "increase-price" || bulkAction === "decrease-price" ? (
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={bulkPercentage}
                  onChange={(event) => setBulkPercentage(event.target.value)}
                  className="h-10 w-[120px] rounded-sm border border-[#8c8f94] bg-white px-2.5 text-[13px] text-slate-700"
                  placeholder={tx("Percent", "Yüzde")}
                />
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-sm border-[#c3c4c7] bg-[#f6f7f7] px-3 text-[12px] font-semibold text-slate-800 hover:bg-white"
                disabled={
                  !bulkAction ||
                  selectedIds.length === 0 ||
                  ((bulkAction === "increase-price" || bulkAction === "decrease-price") && !bulkPercentage.trim())
                }
                onClick={handleApplyBulkAction}
              >
                {tx("Apply", "Uygula")}
              </Button>
              <div className="text-[13px] font-medium text-slate-600">
                {selectedIds.length > 0 ? tx(`${selectedIds.length} selected`, `${selectedIds.length} seçildi`) : tx("No products selected", "Ürün seçilmedi")}
              </div>
            </div>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          {mode === "sold" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tx("Title", "Başlık")}</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>{tx("Supplier", "Tedarikçi")}</TableHead>
                  <TableHead>{tx("Sold Date", "Satış Tarihi")}</TableHead>
                  <TableHead>{tx("Final Sale Price", "Son Satış Fiyatı")}</TableHead>
                  <TableHead>{tx("Revenue", "Ciro")}</TableHead>
                  <TableHead>{tx("Customer Country", "Müşteri Ülkesi")}</TableHead>
                  <TableHead>{tx("Admin", "Admin")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {soldRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-sm text-slate-500">
                      {tx("No sold rugs matched the current data.", "Mevcut verilere göre satılmış halı bulunamadı.")}
                    </TableCell>
                  </TableRow>
                ) : (
                  soldRows.map((row) => (
                    <TableRow key={row.id} className="group transition-colors hover:bg-slate-50/80">
                      <TableCell>
                        <div className="space-y-1.5">
                          <Link href={`/dashboard/products/${row.id}`} className="font-medium text-[#2271b1] hover:text-[#135e96] hover:underline">
                            {row.title}
                          </Link>
                              <RowHoverActions
                                editHref={`/dashboard/products/${row.id}`}
                                viewHref={`/product/${row.slug}`}
                                onDuplicate={() => handleDuplicateProduct(row.id)}
                                onTrash={() => handleTrashProduct(row.id)}
                                tx={tx}
                              />
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-600">{row.sku || "-"}</TableCell>
                      <TableCell>{row.supplier || "-"}</TableCell>
                      <TableCell>{formatDate(row.soldDate)}</TableCell>
                      <TableCell>{formatCurrency(row.finalSalePrice)}</TableCell>
                      <TableCell>{formatCurrency(row.revenue)}</TableCell>
                      <TableCell>{row.customerCountry || "-"}</TableCell>
                      <TableCell>{row.adminName || "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
                      <span>{tx("Title", "Başlık")}</span>
                    </div>
                  </TableHead>
                  <TableHead>{tx("Category", "Kategori")}</TableHead>
                  <TableHead>{tx("Location", "Lokasyon")}</TableHead>
                  <TableHead>{tx("Business", "İş Durumu")}</TableHead>
                  <TableHead>{tx("Hold", "Hold")}</TableHead>
                  <TableHead>{tx("Price", "Fiyat")}</TableHead>
                  <TableHead>{tx("Cost", "Alış")}</TableHead>
                  <TableHead>{tx("Profit", "Kâr")}</TableHead>
                  <TableHead>{tx("Margin", "Marj")}</TableHead>
                  <TableHead>{tx("Days In Stock", "Stokta Gün")}</TableHead>
                  <TableHead>{tx("Stock", "Stok")}</TableHead>
                  <TableHead>{tx("Supplier", "Tedarikçi")}</TableHead>
                  <TableHead>{tx("Photo", "Foto")}</TableHead>
                  <TableHead>{tx("SEO", "SEO")}</TableHead>
                  <TableHead>{tx("Created", "Oluşturuldu")}</TableHead>
                  <TableHead>{tx("Updated", "Güncellendi")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={17} className="h-24 text-center text-sm text-slate-500">
                      {tx("No inventory records found.", "Envanter kaydı bulunamadı.")}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id} className="group transition-colors hover:bg-slate-50/80">
                      <TableCell className="font-mono text-xs text-slate-600">{row.sku || "-"}</TableCell>
                      <TableCell>
                        <div className="space-y-1.5">
                          <div className="flex items-start gap-2">
                            <Checkbox
                              checked={selectedIds.includes(row.id)}
                              onCheckedChange={() => toggleSelect(row.id)}
                              className="mt-0.5"
                            />
                            <div className="min-w-0 space-y-1.5">
                              <Link href={`/dashboard/products/${row.id}`} className="font-medium text-[#2271b1] hover:text-[#135e96] hover:underline">
                                {row.title}
                              </Link>
                              <RowHoverActions
                                editHref={`/dashboard/products/${row.id}`}
                                viewHref={`/product/${row.slug}`}
                                onDuplicate={() => handleDuplicateProduct(row.id)}
                                onTrash={() => handleTrashProduct(row.id)}
                                tx={tx}
                              />
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600">{row.category || "-"}</TableCell>
                      <TableCell className="text-slate-600">{row.location || "-"}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div>{row.businessStatus}</div>
                          {row.businessStatus === "RESERVED" && row.holdUntil ? (
                            <div className="text-xs text-slate-500">{formatDateTime(row.holdUntil)}</div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600">{row.holdUntil ? formatDateTime(row.holdUntil) : "-"}</TableCell>
                      <TableCell>{formatCurrency(row.price)}</TableCell>
                      <TableCell>{formatCurrency(row.purchasePrice)}</TableCell>
                      <TableCell>{formatCurrency(row.profit)}</TableCell>
                      <TableCell>{formatPercent(row.marginPercent)}</TableCell>
                      <TableCell>{row.daysInStock ?? "-"}</TableCell>
                      <TableCell>{row.stockCount}</TableCell>
                      <TableCell className="text-slate-600">{row.supplier || "-"}</TableCell>
                      <TableCell>
                        <div className="space-y-1 text-xs text-slate-600">
                          <div>{metricLabel(row.photoCompleteness.status, tx)}</div>
                          <div>{tx("Featured", "Kapak")}: {row.photoCompleteness.featuredImagePresent ? tx("Present", "Var") : tx("Missing", "Eksik")}</div>
                          <div>{tx("Gallery", "Galeri")}: {row.photoCompleteness.galleryImageCount}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-xs text-slate-600">
                          <div>{metricLabel(row.seoCompleteness.status, tx)}</div>
                          <div>{tx("Title", "Başlık")}: {row.seoCompleteness.seoTitlePresent ? tx("Present", "Var") : tx("Missing", "Eksik")}</div>
                          <div>{tx("Description", "Açıklama")}: {row.seoCompleteness.seoDescriptionPresent ? tx("Present", "Var") : tx("Missing", "Eksik")}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600">{formatDate(row.createdAt)}</TableCell>
                      <TableCell className="text-slate-600">{formatDate(row.updatedAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <div className="rounded-sm border border-[#dcdcde] bg-white">
        <div className="border-b border-[#dcdcde] px-4 py-3">
          <h2 className="text-lg font-semibold">{tx("Supplier Performance", "Tedarikçi Performansı")}</h2>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tx("Supplier", "Tedarikçi")}</TableHead>
                <TableHead>{tx("Total Rugs", "Toplam Halı")}</TableHead>
                <TableHead>{tx("Sold Rugs", "Satılan Halı")}</TableHead>
                <TableHead>{tx("Revenue", "Ciro")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {supplierPerformance.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-20 text-center text-sm text-slate-500">
                    {tx("No supplier performance data is available yet.", "Henüz tedarikçi performans verisi yok.")}
                  </TableCell>
                </TableRow>
              ) : (
                supplierPerformance.map((row) => (
                  <TableRow key={row.supplier}>
                    <TableCell>{row.supplier}</TableCell>
                    <TableCell>{row.totalRugs}</TableCell>
                    <TableCell>{row.soldRugs}</TableCell>
                    <TableCell>{formatCurrency(row.revenue)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
