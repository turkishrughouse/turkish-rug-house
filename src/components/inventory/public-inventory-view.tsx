"use client"

import { useEffect, useMemo, useState } from "react"
import { Download, Images } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import type { InventoryProductRow } from "@/lib/admin-inventory"
import { parseProductSpecs } from "@/lib/inventory-specs"
import { InventoryPortalShell } from "@/components/inventory/inventory-portal-shell"

const INVENTORY_FALLBACK_IMAGE = "/uploads/oushak-rugs/large-oushak/beige-floral-oushak-rug-4x6-handmade-turkish-rug-1-large.webp"

function resolveImage(row: InventoryProductRow) {
  return row.imageUrls[0] || INVENTORY_FALLBACK_IMAGE
}

function specValue(value: string | null | undefined) {
  return String(value || "").trim() || "-"
}

function buildSpecItems(row: InventoryProductRow) {
  const parsedSpecs = parseProductSpecs(row.description)
  return [
    ["Origin", parsedSpecs.origin],
    ["Material", parsedSpecs.material],
    ["Size", parsedSpecs.size],
    ["Age", parsedSpecs.age],
    ["Condition", parsedSpecs.condition],
    ["Pile", parsedSpecs.pile],
    ["Knot Density", parsedSpecs.knotDensity],
    ["SKU", parsedSpecs.sku || row.sku],
  ]
}

export function PublicInventoryView({
  rows,
}: {
  rows: InventoryProductRow[]
}) {
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [activeCategory, setActiveCategory] = useState("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [sorting, setSorting] = useState("updated_desc")
  const [mainColorFilter, setMainColorFilter] = useState("All")

  const specMap = useMemo(() => {
    return new Map(
      rows.map((row) => [row.id, parseProductSpecs(row.description)])
    )
  }, [rows])

  const categories = useMemo(() => {
    const values = rows.flatMap((row) => String(row.category || "").split(",").map((v) => v.trim()).filter(Boolean))
    return ["All", ...Array.from(new Set(values)).sort((a, b) => a.localeCompare(b))]
  }, [rows])

  const mainColors = useMemo(() => {
    const values = rows.flatMap((row) => {
      const parsed = specMap.get(row.id)
      return [parsed?.mainColor, ...row.colorLabels]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    })
    return ["All", ...Array.from(new Set(values)).sort((a, b) => a.localeCompare(b))]
  }, [rows, specMap])

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase()
    const result = rows.filter((row) => {
      const parsed = specMap.get(row.id)
      const rowCategories = String(row.category || "").split(",").map((v) => v.trim()).filter(Boolean)
      const normalizedSku = String(parsed?.sku || row.sku || "").trim()
      const normalizedTitle = String(row.title || "").trim()
      const rowMainColors = [parsed?.mainColor, ...row.colorLabels].map((value) => String(value || "").trim()).filter(Boolean)

      if (activeCategory !== "All" && !rowCategories.includes(activeCategory)) return false
      if (mainColorFilter !== "All" && !rowMainColors.includes(mainColorFilter)) return false

      if (normalizedSearch) {
        const searchableText = [
          normalizedTitle,
          normalizedSku,
          ...rowCategories,
          ...rowMainColors,
        ].map(v => String(v || "").toLowerCase()).join(" ")

        if (!searchableText.includes(normalizedSearch)) return false
      }
      return true
    })

    const sorted = [...result]
    sorted.sort((a, b) => {
      switch (sorting) {
        case "price_asc":
          return a.price - b.price
        case "price_desc":
          return b.price - a.price
        case "title_asc":
          return a.title.localeCompare(b.title)
        case "title_desc":
          return b.title.localeCompare(a.title)
        case "created_asc":
          return a.createdAt.getTime() - b.createdAt.getTime()
        case "created_desc":
          return b.createdAt.getTime() - a.createdAt.getTime()
        case "updated_asc":
          return a.updatedAt.getTime() - b.updatedAt.getTime()
        case "updated_desc":
        default:
          return b.updatedAt.getTime() - a.updatedAt.getTime()
      }
    })
    return sorted
  }, [
    activeCategory,
    mainColorFilter,
    rows,
    searchQuery,
    sorting,
    specMap,
  ])

  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedRowId) || null,
    [rows, selectedRowId]
  )

  const selectedCount = selectedIds.length

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => rows.some((row) => row.id === id)))
  }, [rows])

  useEffect(() => {
    if (!selectedRow) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedRowId(null)
        setSelectedImageIndex(0)
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [selectedRow])

  const toggleSelected = (rowId: string, checked: boolean) => {
    setSelectedIds((current) => {
      if (checked) {
        return current.includes(rowId) ? current : [...current, rowId]
      }
      return current.filter((id) => id !== rowId)
    })
  }

  const buildExportHref = (pathname: "/api/inventory/export" | "/api/inventory/images") => {
    const params = new URLSearchParams()
    if (selectedIds.length > 0) {
      params.set("ids", selectedIds.join(","))
    }
    const query = params.toString()
    return query ? `${pathname}?${query}` : pathname
  }

  const actions = (
    <>
      <Button
        variant="outline"
        className="h-10 rounded-sm border-[#c3c4c7] bg-[#f6f7f7] px-3 text-[12px] font-semibold text-slate-800 hover:bg-white"
        onClick={() => {
          window.location.assign(buildExportHref("/api/inventory/export"))
        }}
      >
        <>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </>
      </Button>
      <Button
        variant="outline"
        className="h-10 rounded-sm border-[#c3c4c7] bg-[#f6f7f7] px-3 text-[12px] font-semibold text-slate-800 hover:bg-white"
        onClick={() => {
          window.location.assign(buildExportHref("/api/inventory/images"))
        }}
      >
        <>
          <Images className="mr-2 h-4 w-4" />
          Download Product Images
        </>
      </Button>
    </>
  )

  return (
    <InventoryPortalShell
      title="Inventory"
      description="Read-only inventory access powered by the existing Turkish Rug House inventory service."
      actions={actions}
    >
      <div className="mb-5 rounded-sm border border-[#dcdcde] bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4 [&>label]:min-w-0">
          <label className="min-w-0 space-y-1">
            <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Sorting</span>
            <select
              value={sorting}
              onChange={(event) => setSorting(event.target.value)}
              className="h-10 w-full rounded-sm border border-[#e5ddd2] bg-[#fcfaf7] px-3 text-sm text-slate-900 outline-none"
            >
              <option value="updated_desc">Newest Updated</option>
              <option value="updated_asc">Oldest Updated</option>
              <option value="created_desc">Newest Created</option>
              <option value="created_asc">Oldest Created</option>
              <option value="price_asc">Price Low to High</option>
              <option value="price_desc">Price High to Low</option>
              <option value="title_asc">Title A-Z</option>
              <option value="title_desc">Title Z-A</option>
            </select>
          </label>

          <label className="min-w-0 space-y-1">
            <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Search</span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search title, SKU, category, color"
              className="h-10 w-full rounded-sm border border-[#e5ddd2] bg-[#fcfaf7] px-3 text-sm text-slate-900 outline-none"
            />
          </label>

          <label className="min-w-0 space-y-1">
            <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Stock Category</span>
            <select
              value={activeCategory}
              onChange={(event) => setActiveCategory(event.target.value)}
              className="h-10 w-full rounded-sm border border-[#e5ddd2] bg-[#fcfaf7] px-3 text-sm text-slate-900 outline-none"
            >
              {categories.map((value) => (
                <option key={value} value={value}>
                  {value === "All" ? "Tümü" : value}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-0 space-y-1">
            <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Main Color</span>
            <select
              value={mainColorFilter}
              onChange={(event) => setMainColorFilter(event.target.value)}
              className="h-10 w-full rounded-sm border border-[#e5ddd2] bg-[#fcfaf7] px-3 text-sm text-slate-900 outline-none"
            >
              {mainColors.map((value) => (
                <option key={value} value={value}>
                  {value === "All" ? "All" : value}
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedCount > 0 ? (
          <div className="mt-3 text-sm text-slate-600">{selectedCount} selected</div>
        ) : null}
      </div>

      {filteredRows.length === 0 ? (
        <div className="rounded-sm border border-[#dcdcde] bg-white px-6 py-14 text-center text-sm text-slate-500">
          No inventory records found.
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {filteredRows.map((row) => {
            const specItems = buildSpecItems(row)
            const checked = selectedIds.includes(row.id)
            return (
              <article key={row.id} className="overflow-hidden rounded-sm border border-[#dcdcde] bg-white">
                <div className="grid min-h-full grid-cols-1 items-start gap-5 p-5 md:grid-cols-[280px_minmax(0,1fr)] md:gap-6">
                  <div className="relative self-start">
                    <div className="absolute left-3 top-3 z-10 rounded-sm bg-white/95 p-1 shadow-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => toggleSelected(row.id, value === true)}
                        aria-label={`Select ${row.title}`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRowId(row.id)
                        setSelectedImageIndex(0)
                      }}
                      className="relative block min-h-[280px] w-full bg-[#f4efe8] text-left"
                    >
                      <ResponsiveImage
                        src={resolveImage(row)}
                        alt={row.title}
                        fill
                        sizes="(min-width: 1280px) 280px, 100vw"
                        className="object-cover"
                      />
                    </button>
                  </div>

                  <div className="min-w-0 self-start">
                    <div className="flex min-h-[280px] flex-col justify-start">
                      <div className="min-w-0 pb-5">
                        <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                          STOCK CODE {row.sku || "-"}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRowId(row.id)
                            setSelectedImageIndex(0)
                          }}
                          className="mt-2 block text-left text-[22px] leading-tight font-medium text-slate-900"
                        >
                          {row.title || "-"}
                        </button>
                      </div>

                      <div className="rounded-sm border border-[#ece6dc] bg-[#fcfaf7] px-4 py-3">
                        <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">Specs</div>
                        <div className="space-y-0.5">
                          {specItems.map(([label, value]) => (
                            <div key={label} className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 py-1 text-[12px] leading-5">
                              <div className="text-slate-500">{label}</div>
                              <div className="break-words text-slate-900">{specValue(value)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {selectedRow ? (
        <InventoryProductModal
          row={selectedRow}
          selectedImageIndex={selectedImageIndex}
          onSelectImage={setSelectedImageIndex}
          onClose={() => {
            setSelectedRowId(null)
            setSelectedImageIndex(0)
          }}
        />
      ) : null}
    </InventoryPortalShell>
  )
}

function InventoryProductModal({
  row,
  selectedImageIndex,
  onSelectImage,
  onClose,
}: {
  row: InventoryProductRow
  selectedImageIndex: number
  onSelectImage: (index: number) => void
  onClose: () => void
}) {
  const galleryImages = row.imageUrls.length > 0 ? row.imageUrls : [INVENTORY_FALLBACK_IMAGE]
  const activeIndex = Math.min(selectedImageIndex, galleryImages.length - 1)
  const activeImage = galleryImages[activeIndex] || INVENTORY_FALLBACK_IMAGE
  const specItems = buildSpecItems(row)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 px-4 py-6 backdrop-blur-[2px]">
      <div className="relative max-h-[92vh] w-full max-w-7xl overflow-auto rounded-sm border border-[#dcdcde] bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-3xl leading-none text-slate-500 transition-colors hover:text-slate-900"
          aria-label="Close"
        >
          ×
        </button>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div className="space-y-4">
            <div className="relative aspect-[4/3] overflow-hidden rounded-sm bg-[#f4efe8]">
              <ResponsiveImage
                src={activeImage}
                alt={row.title}
                fill
                sizes="(min-width: 1024px) 900px, 100vw"
                className="object-contain"
              />
            </div>

            <div className="grid grid-cols-5 gap-3">
              {galleryImages.slice(0, 5).map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => onSelectImage(index)}
                  className={`relative aspect-square overflow-hidden rounded-sm border bg-[#f4efe8] ${index === activeIndex ? "border-[#9fb30f]" : "border-[#dcdcde]"
                    }`}
                >
                  <ResponsiveImage
                    src={image}
                    alt={`${row.title} image ${index + 1}`}
                    fill
                    sizes="180px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                STOCK CODE {row.sku || "-"}
              </div>
              <div className="mt-2 text-[22px] leading-tight font-medium text-slate-900">
                {row.title || "-"}
              </div>
            </div>

            <div className="rounded-sm border border-[#ece6dc] bg-[#fcfaf7] px-4 py-3">
              <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">Specs</div>
              <div className="divide-y divide-[#ece6dc]">
                {specItems.map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[120px_minmax(0,1fr)] gap-4 py-3 text-sm">
                    <div className="text-slate-500">{label}</div>
                    <div className="break-words text-slate-900">{specValue(value)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
