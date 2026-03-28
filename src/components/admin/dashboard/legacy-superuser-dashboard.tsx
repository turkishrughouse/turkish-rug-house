"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { ChevronLeft, ChevronRight, DollarSign, ShoppingBag, Users, Package, Globe2, Boxes, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { parseProductImages } from "@/lib/product-images"

// Icon mapping for KPIs
const KPI_ICONS = [ShoppingBag, Users, Package, DollarSign]
const KPI_COLORS = ["bg-blue-50 text-blue-600", "bg-violet-50 text-violet-600", "bg-orange-50 text-orange-600", "bg-emerald-50 text-emerald-600"]
const DASHBOARD_CARD = "bg-white border border-[#dce3ed] shadow-[0_8px_20px_rgba(15,23,42,0.05)]"

type DashboardProduct = {
  id: string
  title: string
  slug: string
  sku?: string | null
  price: number
  stockCount: number
  images: string
  soldCount?: number
  categories?: Array<{ id: string; title: string }>
}

type ActivityCountry = {
  code: string
  name: string
  count: number
  lastAt: string
  registeredCustomers?: number
}

type ActivityEvent = {
  id: string
  actorKey: string
  orderNumber: string
  customerName: string
  email?: string | null
  countryCode: string
  countryName: string
  action: string
  currentPath?: string
  createdAt: string
}

type CountryOnlineCustomer = ActivityEvent

type CustomerDetailPage = {
  path: string
  source: string
  count: number
  lastAt: string
  totalMs?: number
  title?: string | null
  lastHoverLabel?: string | null
  lastHoverType?: string | null
}

type CustomerDetailResponse = {
  customer: {
    actorKey: string
    userId: string | null
    name: string
    email: string | null
    country: string | null
    lastActiveAt: string | null
    currentPath?: string | null
    currentPageTitle?: string | null
    lastAction?: string | null
    lastHoverLabel?: string | null
    lastHoverType?: string | null
    longestStayPath?: string | null
    longestStayTitle?: string | null
    longestStayMs?: number
  }
  pages: CustomerDetailPage[]
}

type GeoFeature = {
  type: "Feature"
  properties: Record<string, unknown>
  geometry: {
    type: "Polygon" | "MultiPolygon"
    coordinates: number[][][] | number[][][][]
  }
}

type DeviceLoginEntry = {
  id: string
  actorKey: string
  name: string
  browser: string
  device: string
  country: string
  currentPath?: string
  createdAt: string
}

type DeviceLoginSummaryItem = {
  label: string
  count: number
}

type AbandonedCartEntry = {
  id: string
  actorKey: string
  customerName: string
  action: string
  currentPath: string
  createdAt: string
  isGuest: boolean
}

type AbandonedCartSummary = {
  total: number
  guestCount: number
  customerCount: number
  lastAt: string | null
}

type ProductCreatorUserOption = {
  id: string
  label: string
  email: string
  count: number
}

type ProductCreatorProduct = {
  id: string
  title: string
  slug: string
  sku: string | null
  createdAt: string
}

type ProductCreatorSection = {
  selectedUserId: string
  total: number
  products: ProductCreatorProduct[]
}

type ProductCreatorResponse = {
  period: "week" | "month" | "year"
  superUsers: ProductCreatorUserOption[]
  adminUsers: ProductCreatorUserOption[]
  superUserSection: ProductCreatorSection
  adminSection: ProductCreatorSection
}

type GeoCollection = {
  type: "FeatureCollection"
  features: GeoFeature[]
}

const PRODUCT_PERIOD_OPTIONS = [
  { value: "week", labelEn: "This Week", labelTr: "Bu Hafta" },
  { value: "month", labelEn: "This Month", labelTr: "Bu Ay" },
  { value: "year", labelEn: "This Year", labelTr: "Bu Yıl" },
] as const
const PRODUCT_CREATOR_PAGE_SIZE = 20

const COUNTRY_COORDS: Record<string, { lat: number; lng: number }> = {
  US: { lat: 39, lng: -98 },
  CA: { lat: 57, lng: -106 },
  GB: { lat: 55, lng: -3 },
  DE: { lat: 51, lng: 10 },
  FR: { lat: 46, lng: 2 },
  ES: { lat: 40, lng: -3 },
  IT: { lat: 42, lng: 12 },
  TR: { lat: 39, lng: 35 },
  SA: { lat: 24, lng: 45 },
  AE: { lat: 24, lng: 54 },
  IN: { lat: 21, lng: 78 },
  CN: { lat: 35, lng: 103 },
  JP: { lat: 36, lng: 138 },
  AU: { lat: -25, lng: 133 },
  BR: { lat: -14, lng: -52 },
  MX: { lat: 23, lng: -102 },
}

function subscribeToHydration() {
  return () => {}
}

function coordToPercent(lat: number, lng: number) {
  return {
    x: ((lng + 180) / 360) * 100,
    y: ((90 - lat) / 180) * 100,
  }
}

function projectPoint(lng: number, lat: number) {
  return {
    x: ((lng + 180) / 360) * 1200,
    y: ((90 - lat) / 180) * 560,
  }
}

function ringToPath(ring: number[][]) {
  if (!ring.length) return ""
  const [firstLng, firstLat] = ring[0]
  const first = projectPoint(firstLng, firstLat)
  let path = `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`
  for (let i = 1; i < ring.length; i += 1) {
    const [lng, lat] = ring[i]
    const point = projectPoint(lng, lat)
    path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
  }
  return `${path} Z`
}

function geometryToPath(geometry: GeoFeature["geometry"]) {
  if (geometry.type === "Polygon") {
    const polygon = geometry.coordinates as number[][][]
    return polygon.map((ring) => ringToPath(ring)).join(" ")
  }
  const multi = geometry.coordinates as number[][][][]
  return multi.map((polygon) => polygon.map((ring) => ringToPath(ring)).join(" ")).join(" ")
}

function geometryCentroid(geometry: GeoFeature["geometry"]) {
  const allPoints: Array<{ lng: number; lat: number }> = []
  if (geometry.type === "Polygon") {
    const polygon = geometry.coordinates as number[][][]
    polygon.forEach((ring) => ring.forEach(([lng, lat]) => allPoints.push({ lng, lat })))
  } else {
    const multi = geometry.coordinates as number[][][][]
    multi.forEach((polygon) => polygon.forEach((ring) => ring.forEach(([lng, lat]) => allPoints.push({ lng, lat }))))
  }
  if (allPoints.length === 0) return null
  const lng = allPoints.reduce((sum, point) => sum + point.lng, 0) / allPoints.length
  const lat = allPoints.reduce((sum, point) => sum + point.lat, 0) / allPoints.length
  return { lng, lat }
}

function normalizeCountryCode(properties: Record<string, unknown>) {
  const candidates = [
    properties["ISO3166-1-Alpha-2"],
    properties["iso_a2"],
    properties["ISO_A2"],
    properties["id"],
  ]
  for (const item of candidates) {
    if (typeof item === "string" && item.trim().length === 2) return item.trim().toUpperCase()
  }
  return null
}

function normalizeCountryName(properties: Record<string, unknown>) {
  const candidates = [properties["name"], properties["ADMIN"], properties["admin"], properties["name_long"]]
  for (const item of candidates) {
    if (typeof item === "string" && item.trim().length > 0) return item.trim()
  }
  return "Unknown country"
}

function getActiveTier(activeCount: number) {
  if (activeCount > 200) return "high"
  if (activeCount > 100) return "medium"
  if (activeCount > 0) return "low"
  return "none"
}

function getTierPalette(activeCount: number) {
  const tier = getActiveTier(activeCount)
  if (tier === "high") {
    return { fill: "#55b86f", stroke: "#2f8f4c", chip: "bg-emerald-600", ping: "bg-emerald-500/25" }
  }
  if (tier === "medium") {
    return { fill: "#f2c94c", stroke: "#c39b2f", chip: "bg-amber-500", ping: "bg-amber-400/25" }
  }
  if (tier === "low") {
    return { fill: "#5ca6e3", stroke: "#2b6f9e", chip: "bg-blue-600", ping: "bg-blue-500/25" }
  }
  return { fill: "#bdc5d1", stroke: "#ffffff", chip: "bg-slate-500", ping: "bg-slate-500/20" }
}

function toAbsolutePath(path: string) {
  if (!path) return "#"
  if (path.startsWith("http://") || path.startsWith("https://")) return path
  return path.startsWith("/") ? path : `/${path}`
}

function formatSocialLoginDate(value: string | null) {
  if (!value) return "Never"
  try {
    return new Date(value).toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return value
  }
}

function DeviceBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
      {label}
    </span>
  )
}

type ProductCreatorPaginationProps = {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  previousLabel: string
  nextLabel: string
}

const ProductCreatorPagination = memo(function ProductCreatorPagination({
  page,
  totalPages,
  onPageChange,
  previousLabel,
  nextLabel,
}: ProductCreatorPaginationProps) {
  if (totalPages <= 1) return null

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1)

  return (
    <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#e6ecf4] pt-3">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className="rounded-md border border-[#dce3ed] bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {previousLabel}
      </button>
      <div className="flex items-center gap-1.5">
        {pages.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            onClick={() => onPageChange(pageNumber)}
            className={cn(
              "h-8 min-w-8 rounded-md border px-2 text-xs font-semibold transition-colors",
              pageNumber === page
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-[#dce3ed] bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
            )}
            aria-current={pageNumber === page ? "page" : undefined}
          >
            {pageNumber}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        className="rounded-md border border-[#dce3ed] bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {nextLabel}
      </button>
    </div>
  )
})

type ProductCreatorListPanelProps = {
  title: string
  description: string
  total: number
  productsLabel: string
  selectedUserId: string
  onSelectedUserIdChange: (value: string) => void
  selectUserLabel: string
  users: ProductCreatorUserOption[]
  selectedPeriod: "week" | "month" | "year"
  onSelectedPeriodChange: (value: "week" | "month" | "year") => void
  periodOptions: typeof PRODUCT_PERIOD_OPTIONS
  isTr: boolean
  selectedUserLabel: string
  selectedUserEmail: string
  loading: boolean
  loadingLabel: string
  emptyLabel: string
  products: ProductCreatorProduct[]
  previousLabel: string
  nextLabel: string
}

type ProductActivityCard = {
  key: string
  label: string
  value: number
  breakdown: Array<{ creator: string; count: number }>
}

const ProductCreatorListPanel = memo(function ProductCreatorListPanel({
  title,
  description,
  total,
  productsLabel,
  selectedUserId,
  onSelectedUserIdChange,
  selectUserLabel,
  users,
  selectedPeriod,
  onSelectedPeriodChange,
  periodOptions,
  isTr,
  selectedUserLabel,
  selectedUserEmail,
  loading,
  loadingLabel,
  emptyLabel,
  products,
  previousLabel,
  nextLabel,
}: ProductCreatorListPanelProps) {
  const [page, setPage] = useState(1)
  const handleUserChange = useCallback((value: string) => {
    setPage(1)
    onSelectedUserIdChange(value)
  }, [onSelectedUserIdChange])
  const handlePeriodChange = useCallback((value: "week" | "month" | "year") => {
    setPage(1)
    onSelectedPeriodChange(value)
  }, [onSelectedPeriodChange])

  const { paginatedProducts, totalPages } = useMemo(() => {
    const nextTotalPages = Math.max(1, Math.ceil(products.length / PRODUCT_CREATOR_PAGE_SIZE))
    const currentPage = Math.min(page, nextTotalPages)
    const startIndex = (currentPage - 1) * PRODUCT_CREATOR_PAGE_SIZE
    return {
      paginatedProducts: products.slice(startIndex, startIndex + PRODUCT_CREATOR_PAGE_SIZE),
      totalPages: nextTotalPages,
    }
  }, [page, products])

  return (
    <div className="rounded-xl border border-[#e6ecf4] bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</p>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
        <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
          {total} {productsLabel}
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        <select
          value={selectedUserId}
          onChange={(event) => handleUserChange(event.target.value)}
          className="h-11 rounded-md border border-[#dce3ed] bg-white px-3 text-sm text-slate-700"
        >
          <option value="">{selectUserLabel}</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>{user.label}</option>
          ))}
        </select>
        <select
          value={selectedPeriod}
          onChange={(event) => handlePeriodChange(event.target.value as "week" | "month" | "year")}
          className="h-11 rounded-md border border-[#dce3ed] bg-white px-3 text-sm text-slate-700"
        >
          {periodOptions.map((option) => (
            <option key={`${title}-${option.value}`} value={option.value}>{isTr ? option.labelTr : option.labelEn}</option>
          ))}
        </select>
      </div>
      <div className="mt-4 rounded-lg border border-[#e6ecf4] bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{selectedUserLabel}</p>
            <p className="truncate text-xs text-slate-500">{selectedUserEmail}</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">{total}</span>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {loading ? (
          <div className="rounded-lg border border-[#e6ecf4] bg-white p-3 text-xs text-slate-500">{loadingLabel}</div>
        ) : products.length === 0 ? (
          <div className="rounded-lg border border-[#e6ecf4] bg-white p-3 text-xs text-slate-500">{emptyLabel}</div>
        ) : (
          paginatedProducts.map((product) => (
            <div key={`${title}-${product.id}`} className="rounded-lg border border-[#e6ecf4] bg-white p-3">
              <p className="truncate text-sm font-semibold text-slate-900">{product.title}</p>
              <div className="mt-1 flex items-center justify-between gap-3 text-xs text-slate-500">
                <span className="truncate">{product.sku || product.slug}</span>
                <span className="shrink-0">{new Date(product.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
      {!loading && products.length > 0 ? (
        <ProductCreatorPagination
          page={Math.min(page, totalPages)}
          totalPages={totalPages}
          onPageChange={setPage}
          previousLabel={previousLabel}
          nextLabel={nextLabel}
        />
      ) : null}
    </div>
  )
})

type ProductActivityPanelProps = {
  title: string
  description: string
  totalProducts: number
  activeLabel: string
  creatorBreakdownLabel: string
  liveLabel: string
  noCreatorDataLabel: string
  noCreatorRecordsLabel: string
  cards: ProductActivityCard[]
}

const ProductActivityPanel = memo(function ProductActivityPanel({
  title,
  description,
  totalProducts,
  activeLabel,
  creatorBreakdownLabel,
  liveLabel,
  noCreatorDataLabel,
  noCreatorRecordsLabel,
  cards,
}: ProductActivityPanelProps) {
  return (
    <div className="rounded-xl border border-[#e6ecf4] bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</p>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
        <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
          {totalProducts} {activeLabel}
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <div key={card.key} className="rounded-lg border border-[#e6ecf4] bg-white p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{card.value}</p>
            <p className="mt-1 text-xs text-slate-500">
              {card.breakdown[0] ? `${card.breakdown[0].creator} • ${card.breakdown[0].count}` : noCreatorDataLabel}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-lg border border-[#e6ecf4] bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-900">{creatorBreakdownLabel}</p>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">{liveLabel}</span>
        </div>
        <div className="mt-3 space-y-2">
          {cards.map((card) => (
            <div key={`breakdown-${card.key}`} className="rounded-lg border border-[#e6ecf4] bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{card.label}</p>
                <span className="text-xs font-semibold text-slate-700">{card.value}</span>
              </div>
              {card.breakdown.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">{noCreatorRecordsLabel}</p>
              ) : (
                <div className="mt-2 space-y-1.5">
                  {card.breakdown.slice(0, 3).map((row) => (
                    <div key={`${card.key}-${row.creator}`} className="flex items-center justify-between gap-3 text-xs">
                      <span className="truncate text-slate-700">{row.creator}</span>
                      <span className="shrink-0 font-semibold text-slate-900">{row.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})

export default function DashboardPage() {
  const [isTr, setIsTr] = useState(false)
  const [topProducts, setTopProducts] = useState<DashboardProduct[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [role, setRole] = useState<string>("SUPER_USER")
  const [summary, setSummary] = useState({
    totalOrders: 0,
    ordersBreakdown: {
      today: 0,
      week: 0,
      month: 0,
    },
    totalCustomers: 0,
    customersBreakdown: {
      today: 0,
      week: 0,
      month: 0,
    },
    customersByCountry: [] as Array<{ country: string; count: number }>,
    customersByCountryDetails: [] as Array<{
      id: string
      name: string
      email: string
      country: string
      createdAt: string
      lastLoginAt: string | null
    }>,
    ordersTodayByCountry: [] as Array<{ country: string; count: number }>,
    ordersTodayDetails: [] as Array<{
      id: string
      orderNumber: string
      createdAt: string
      customer: string
      country: string
      products: Array<{ title: string; quantity: number; price: number }>
    }>,
    totalProducts: 0,
    productsAdded: {
      today: 0,
      week: 0,
      month: 0,
      year: 0,
    },
    productsAddedBy: {
      today: [] as Array<{ creator: string; count: number }>,
      week: [] as Array<{ creator: string; count: number }>,
      month: [] as Array<{ creator: string; count: number }>,
      year: [] as Array<{ creator: string; count: number }>,
    },
    adminSalesByCreator: [] as Array<{ creator: string; salesTotal: number; itemsSold: number }>,
    pendingDelivery: 0,
    pendingDeliveryBreakdown: {
      shipped: 0,
      cancelled: 0,
      pending: 0,
      other: 0,
    },
    totalRevenue: 0,
    revenueBreakdown: {
      today: 0,
      week: 0,
      month: 0,
    },
    salesAnalytics: {
      income: 0,
      expense: 0,
      chart: [] as Array<{ name: string; income: number; expense: number }>,
    },
  })
  const [activityCountries, setActivityCountries] = useState<ActivityCountry[]>([])
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([])
  const [registeredByCountry, setRegisteredByCountry] = useState<Record<string, number>>({})
  const [hoverCountryCode, setHoverCountryCode] = useState<string | null>(null)
  const [worldFeatures, setWorldFeatures] = useState<GeoFeature[]>([])
  const summaryInFlightRef = useRef(false)
  const activityInFlightRef = useRef(false)
  const deviceLoginsInFlightRef = useRef(false)
  const abandonedCartsInFlightRef = useRef(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailData, setDetailData] = useState<CustomerDetailResponse | null>(null)
  const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(null)
  const [hoveredActorKey, setHoveredActorKey] = useState<string | null>(null)
  const [isProductsDetailOpen, setIsProductsDetailOpen] = useState(false)
  const [productCreatorData, setProductCreatorData] = useState<ProductCreatorResponse | null>(null)
  const [productCreatorLoading, setProductCreatorLoading] = useState(false)
  const [selectedSuperUserId, setSelectedSuperUserId] = useState("")
  const [selectedSuperUserPeriod, setSelectedSuperUserPeriod] = useState<"week" | "month" | "year">("week")
  const [selectedAdminUserId, setSelectedAdminUserId] = useState("")
  const [selectedAdminUserPeriod, setSelectedAdminUserPeriod] = useState<"week" | "month" | "year">("week")
  const [isOrdersDetailOpen, setIsOrdersDetailOpen] = useState(false)
  const [ordersCountryFilter, setOrdersCountryFilter] = useState<string | null>(null)
  const [isCustomersDetailOpen, setIsCustomersDetailOpen] = useState(false)
  const [customersCountryFilter, setCustomersCountryFilter] = useState<string | null>(null)
  const [isPendingDeliveryDetailOpen, setIsPendingDeliveryDetailOpen] = useState(false)
  const [isRevenueDetailOpen, setIsRevenueDetailOpen] = useState(false)
  const [deviceLogins, setDeviceLogins] = useState<DeviceLoginEntry[]>([])
  const [deviceTopBrowsers, setDeviceTopBrowsers] = useState<DeviceLoginSummaryItem[]>([])
  const [deviceTopDevices, setDeviceTopDevices] = useState<DeviceLoginSummaryItem[]>([])
  const [isDeviceLoginsOpen, setIsDeviceLoginsOpen] = useState(false)
  const [isDeviceVisitorDetailOpen, setIsDeviceVisitorDetailOpen] = useState(false)
  const [selectedDeviceVisitor, setSelectedDeviceVisitor] = useState<DeviceLoginEntry | null>(null)
  const [deviceVisitorDetailLoading, setDeviceVisitorDetailLoading] = useState(false)
  const [deviceVisitorDetail, setDeviceVisitorDetail] = useState<CustomerDetailResponse | null>(null)
  const [abandonedCarts, setAbandonedCarts] = useState<AbandonedCartEntry[]>([])
  const [abandonedCartSummary, setAbandonedCartSummary] = useState<AbandonedCartSummary>({
    total: 0,
    guestCount: 0,
    customerCount: 0,
    lastAt: null,
  })
  const [isAbandonedCartsOpen, setIsAbandonedCartsOpen] = useState(false)
  const hasDeviceData = deviceLogins.length > 0
  const hasAbandonedCartData = abandonedCarts.length > 0
  const chartsReady = useSyncExternalStore(subscribeToHydration, () => true, () => false)

  const loadTopProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/dashboard/top-products", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to fetch products")
      const data = await res.json()
      setTopProducts((data?.products || []) as DashboardProduct[])
    } catch {
      setTopProducts([])
    } finally {
      setProductsLoading(false)
    }
  }, [])

  useEffect(() => {
    const langFromMain = document.querySelector("main[lang]")?.getAttribute("lang") || document.documentElement.lang || "en"
    setIsTr(langFromMain.toLowerCase().startsWith("tr"))
  }, [])

  useEffect(() => {
    void loadTopProducts()
    const handleRefresh = () => {
      void loadTopProducts()
    }
    const timer = window.setInterval(() => {
      void loadTopProducts()
    }, 60000)
    window.addEventListener("focus", handleRefresh)
    window.addEventListener("admin-products-updated", handleRefresh as EventListener)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", handleRefresh)
      window.removeEventListener("admin-products-updated", handleRefresh as EventListener)
    }
  }, [loadTopProducts])

  useEffect(() => {
    let mounted = true

    const loadDeviceLogins = async () => {
      if (deviceLoginsInFlightRef.current) return
      deviceLoginsInFlightRef.current = true
      try {
        const res = await fetch("/api/admin/dashboard/device-logins", { cache: "no-store" })
        if (!res.ok) throw new Error("Failed to fetch device logins")
        const data = await res.json()
        if (!mounted) return
        setDeviceLogins(
          Array.isArray(data?.items)
            ? (data.items as Array<DeviceLoginEntry & { country?: string }>).map((item) => ({
                ...item,
                actorKey: item.actorKey || item.id,
                country: item.country || "Unknown",
              }))
            : []
        )
        setDeviceTopBrowsers(Array.isArray(data?.topBrowsers) ? (data.topBrowsers as DeviceLoginSummaryItem[]) : [])
        setDeviceTopDevices(Array.isArray(data?.topDevices) ? (data.topDevices as DeviceLoginSummaryItem[]) : [])
      } catch {
        if (!mounted) return
        setDeviceLogins([])
        setDeviceTopBrowsers([])
        setDeviceTopDevices([])
      } finally {
        deviceLoginsInFlightRef.current = false
      }
    }

    void loadDeviceLogins()
    const timer = window.setInterval(() => {
      void loadDeviceLogins()
    }, 60000)

    return () => {
      mounted = false
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const loadAbandonedCarts = async () => {
      if (abandonedCartsInFlightRef.current) return
      abandonedCartsInFlightRef.current = true
      try {
        const res = await fetch("/api/admin/dashboard/abandoned-carts", { cache: "no-store" })
        if (!res.ok) throw new Error("Failed to fetch abandoned carts")
        const data = await res.json()
        if (!mounted) return
        setAbandonedCarts(Array.isArray(data?.items) ? (data.items as AbandonedCartEntry[]) : [])
        setAbandonedCartSummary({
          total: Number(data?.total || 0),
          guestCount: Number(data?.guestCount || 0),
          customerCount: Number(data?.customerCount || 0),
          lastAt: typeof data?.lastAt === "string" ? data.lastAt : null,
        })
      } catch {
        if (!mounted) return
        setAbandonedCarts([])
        setAbandonedCartSummary({ total: 0, guestCount: 0, customerCount: 0, lastAt: null })
      } finally {
        abandonedCartsInFlightRef.current = false
      }
    }

    void loadAbandonedCarts()
    const timer = window.setInterval(() => {
      void loadAbandonedCarts()
    }, 60000)

    return () => {
      mounted = false
      window.clearInterval(timer)
    }
  }, [])

  const loadSummary = useCallback(async () => {
    if (summaryInFlightRef.current) return
    summaryInFlightRef.current = true
    try {
      const res = await fetch("/api/admin/dashboard/summary", { cache: "no-store" })
      if (!res.ok) return
      const json = await res.json()
      setRole(String(json?.role || "SUPER_USER"))
      setSummary({
        totalOrders: Number(json?.metrics?.totalOrders || 0),
        ordersBreakdown: {
          today: Number(json?.metrics?.ordersBreakdown?.today || 0),
          week: Number(json?.metrics?.ordersBreakdown?.week || 0),
          month: Number(json?.metrics?.ordersBreakdown?.month || 0),
        },
        totalCustomers: Number(json?.metrics?.totalCustomers || 0),
        customersBreakdown: {
          today: Number(json?.metrics?.customersBreakdown?.today || 0),
          week: Number(json?.metrics?.customersBreakdown?.week || 0),
          month: Number(json?.metrics?.customersBreakdown?.month || 0),
        },
        customersByCountry: Array.isArray(json?.metrics?.customersByCountry) ? json.metrics.customersByCountry : [],
        customersByCountryDetails: Array.isArray(json?.metrics?.customersByCountryDetails) ? json.metrics.customersByCountryDetails : [],
        ordersTodayByCountry: Array.isArray(json?.metrics?.ordersTodayByCountry) ? json.metrics.ordersTodayByCountry : [],
        ordersTodayDetails: Array.isArray(json?.metrics?.ordersTodayDetails) ? json.metrics.ordersTodayDetails : [],
        totalProducts: Number(json?.metrics?.totalProducts || 0),
        productsAdded: {
          today: Number(json?.metrics?.productsAdded?.today || 0),
          week: Number(json?.metrics?.productsAdded?.week || 0),
          month: Number(json?.metrics?.productsAdded?.month || 0),
          year: Number(json?.metrics?.productsAdded?.year || 0),
        },
        productsAddedBy: {
          today: Array.isArray(json?.metrics?.productsAddedBy?.today) ? json.metrics.productsAddedBy.today : [],
          week: Array.isArray(json?.metrics?.productsAddedBy?.week) ? json.metrics.productsAddedBy.week : [],
          month: Array.isArray(json?.metrics?.productsAddedBy?.month) ? json.metrics.productsAddedBy.month : [],
          year: Array.isArray(json?.metrics?.productsAddedBy?.year) ? json.metrics.productsAddedBy.year : [],
        },
        adminSalesByCreator: Array.isArray(json?.metrics?.adminSalesByCreator) ? json.metrics.adminSalesByCreator : [],
        pendingDelivery: Number(json?.metrics?.pendingDelivery || 0),
        pendingDeliveryBreakdown: {
          shipped: Number(json?.metrics?.pendingDeliveryBreakdown?.shipped || 0),
          cancelled: Number(json?.metrics?.pendingDeliveryBreakdown?.cancelled || 0),
          pending: Number(json?.metrics?.pendingDeliveryBreakdown?.pending || 0),
          other: Number(json?.metrics?.pendingDeliveryBreakdown?.other || 0),
        },
        totalRevenue: Number(json?.metrics?.totalRevenue || 0),
        revenueBreakdown: {
          today: Number(json?.metrics?.revenueBreakdown?.today || 0),
          week: Number(json?.metrics?.revenueBreakdown?.week || 0),
          month: Number(json?.metrics?.revenueBreakdown?.month || 0),
        },
        salesAnalytics: {
          income: Number(json?.metrics?.salesAnalytics?.income || 0),
          expense: Number(json?.metrics?.salesAnalytics?.expense || 0),
          chart: Array.isArray(json?.metrics?.salesAnalytics?.chart) ? json.metrics.salesAnalytics.chart : [],
        },
      })
    } catch {
      // keep fallback
    } finally {
      summaryInFlightRef.current = false
    }
  }, [])

  useEffect(() => {
    loadSummary()
    const handleSummaryRefresh = () => {
      void loadSummary()
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadSummary()
      }
    }
    window.addEventListener("admin-products-updated", handleSummaryRefresh as EventListener)
    window.addEventListener("focus", handleSummaryRefresh)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    const timer = setInterval(() => {
      void loadSummary()
    }, 60000)
    return () => {
      clearInterval(timer)
      window.removeEventListener("admin-products-updated", handleSummaryRefresh as EventListener)
      window.removeEventListener("focus", handleSummaryRefresh)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [loadSummary])

  useEffect(() => {
    if (!isProductsDetailOpen) return
    void loadSummary()
  }, [isProductsDetailOpen, loadSummary])

  useEffect(() => {
    if (!isProductsDetailOpen) return

    let cancelled = false
    const loadProductCreatorData = async () => {
      setProductCreatorLoading(true)
      try {
        const params = new URLSearchParams({
          superUserId: selectedSuperUserId,
          superPeriod: selectedSuperUserPeriod,
          adminUserId: selectedAdminUserId,
          adminPeriod: selectedAdminUserPeriod,
        })
        const res = await fetch(`/api/admin/dashboard/product-creators?${params.toString()}`, { cache: "no-store" })
        if (!res.ok) throw new Error("Failed to load product creator data")
        const data = (await res.json()) as ProductCreatorResponse
        if (cancelled) return
        setProductCreatorData(data)
        if (!selectedSuperUserId && data.superUserSection.selectedUserId) {
          setSelectedSuperUserId(data.superUserSection.selectedUserId)
        } else if (!selectedSuperUserId && data.superUsers[0]?.id) {
          setSelectedSuperUserId(data.superUsers[0].id)
        }
        if (!selectedAdminUserId && data.adminSection.selectedUserId) {
          setSelectedAdminUserId(data.adminSection.selectedUserId)
        } else if (!selectedAdminUserId && data.adminUsers[0]?.id) {
          setSelectedAdminUserId(data.adminUsers[0].id)
        }
      } catch {
        if (!cancelled) {
          setProductCreatorData(null)
        }
      } finally {
        if (!cancelled) setProductCreatorLoading(false)
      }
    }

    void loadProductCreatorData()
    return () => {
      cancelled = true
    }
  }, [isProductsDetailOpen, selectedAdminUserId, selectedAdminUserPeriod, selectedSuperUserId, selectedSuperUserPeriod])

  useEffect(() => {
    let mounted = true

    const loadActivity = async () => {
      if (activityInFlightRef.current) return
      activityInFlightRef.current = true
      try {
        const res = await fetch("/api/admin/dashboard/customer-activity", { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        const countries = (data?.countries || []) as ActivityCountry[]
        const events = (data?.events || []) as ActivityEvent[]
        const registered = (data?.registeredByCountry || {}) as Record<string, number>
        if (!mounted) return
        setActivityCountries(countries)
        setActivityEvents(events)
        setRegisteredByCountry(registered)
      } catch {
        // ignore activity polling errors
      } finally {
        activityInFlightRef.current = false
      }
    }

    loadActivity()
    const timer = setInterval(() => loadActivity(), 60000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [])

  const isLimitedRole = role === "ADMIN" || role === "EDITOR"
  const tx = useCallback((en: string, tr: string) => (isTr ? tr : en), [isTr])
  const formatDuration = (valueMs: number | null | undefined) => {
    const totalSeconds = Math.max(0, Math.round(Number(valueMs || 0) / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    if (minutes > 0) return `${minutes}m ${seconds}s`
    return `${seconds}s`
  }
  const formatCompactCurrency = (value: number) => {
    const amount = Number(value || 0)
    const absolute = Math.abs(amount)
    if (absolute >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`
    if (absolute >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`
    return `$${amount.toFixed(1)}`
  }
  const filteredOrdersTodayDetails = useMemo(() => {
    if (!ordersCountryFilter) return summary.ordersTodayDetails
    return summary.ordersTodayDetails.filter((order) => order.country === ordersCountryFilter)
  }, [summary.ordersTodayDetails, ordersCountryFilter])
  const filteredCustomersByCountryDetails = useMemo(() => {
    if (!customersCountryFilter) return summary.customersByCountryDetails
    return summary.customersByCountryDetails.filter((customer) => customer.country === customersCountryFilter)
  }, [summary.customersByCountryDetails, customersCountryFilter])
  const kpiLabelByIndex = (index: number, fallback: string) => {
    if (index === 0) return tx("Total Orders", "Toplam Siparis")
    if (index === 1) return tx("Total Customers", "Toplam Musteri")
    if (index === 2) return tx("Pending Delivery", "Bekleyen Teslimat")
    if (index === 3) return tx("Total Revenue", "Toplam Ciro")
    return fallback
  }

  useEffect(() => {
    let ignore = false
    const loadWorldMap = async () => {
      try {
        const res = await fetch("https://cdn.jsdelivr.net/gh/datasets/geo-countries@master/data/countries.geojson", { cache: "force-cache" })
        if (!res.ok) return
        const data = (await res.json()) as GeoCollection
        if (ignore || !Array.isArray(data?.features)) return
        setWorldFeatures(data.features)
      } catch {
        // keep fallback
      }
    }
    loadWorldMap()
    return () => {
      ignore = true
    }
  }, [])

  const countryCoordMap = useMemo(() => {
    const map = new Map<string, { lat: number; lng: number }>()
    worldFeatures.forEach((feature) => {
      const code = normalizeCountryCode(feature.properties)
      if (!code) return
      const centroid = geometryCentroid(feature.geometry)
      if (!centroid) return
      map.set(code, { lat: centroid.lat, lng: centroid.lng })
    })
    Object.entries(COUNTRY_COORDS).forEach(([code, point]) => {
      if (!map.has(code)) map.set(code, point)
    })
    return map
  }, [worldFeatures])

  const worldShapes = useMemo(
    () =>
      worldFeatures.map((feature, idx) => ({
        key: `${normalizeCountryCode(feature.properties) || "country"}-${idx}`,
        code: normalizeCountryCode(feature.properties),
        name: normalizeCountryName(feature.properties),
        path: geometryToPath(feature.geometry),
      })),
    [worldFeatures]
  )
  const hoveredCountry = hoverCountryCode ? activityCountries.find((country) => country.code === hoverCountryCode) : null
  const hoveredWorldCountry = hoverCountryCode
    ? worldShapes.find((shape) => shape.code === hoverCountryCode)
    : null
  const hoveredCountryName = hoveredWorldCountry?.name || hoveredCountry?.name || null
  const hoveredRegisteredCustomers = hoverCountryCode ? Number(registeredByCountry[hoverCountryCode] || 0) : 0
  const hoveredActiveCustomers = hoverCountryCode ? Number(activityCountries.find((country) => country.code === hoverCountryCode)?.count || 0) : 0
  const mapCountries = useMemo(() => {
    const activeMap = new Map(activityCountries.map((country) => [country.code, country]))
    const codes = new Set<string>([...Object.keys(registeredByCountry), ...activityCountries.map((country) => country.code)])
    return Array.from(codes).map((code) => ({
      code,
      name: activeMap.get(code)?.name || code,
      activeCount: Number(activeMap.get(code)?.count || 0),
      registeredCount: Number(registeredByCountry[code] || 0),
    }))
  }, [activityCountries, registeredByCountry])
  const activeCountByCountry = useMemo(
    () => new Map(mapCountries.map((country) => [country.code, country.activeCount])),
    [mapCountries]
  )

  const recentRoutes = useMemo(() => {
    const routes: Array<{ id: string; from: { x: number; y: number }; to: { x: number; y: number } }> = []
    const recent = activityEvents.slice(0, 8)
    for (let index = 0; index < recent.length - 1; index += 1) {
      const current = recent[index]
      const next = recent[index + 1]
      const fromCoord = countryCoordMap.get(current.countryCode)
      const toCoord = countryCoordMap.get(next.countryCode)
      if (!fromCoord || !toCoord) continue
      if (current.countryCode === next.countryCode) continue
      routes.push({
        id: `${current.id}-${next.id}`,
        from: coordToPercent(fromCoord.lat, fromCoord.lng),
        to: coordToPercent(toCoord.lat, toCoord.lng),
      })
    }
    return routes
  }, [activityEvents, countryCoordMap])

  const onlineCustomersByCountry = useMemo(() => {
    const activeWindowMs = 15 * 60 * 1000
    const now = Date.now()
    const latestByCountryActor = new Map<string, CountryOnlineCustomer>()

    for (const event of activityEvents) {
      if (!event.actorKey) continue
      const eventTime = new Date(event.createdAt).getTime()
      if (now - eventTime > activeWindowMs) continue
      const key = `${event.countryCode}::${event.actorKey}`
      const existing = latestByCountryActor.get(key)
      if (!existing || new Date(existing.createdAt).getTime() < eventTime) {
        latestByCountryActor.set(key, event)
      }
    }

    const grouped = new Map<string, CountryOnlineCustomer[]>()
    for (const customer of latestByCountryActor.values()) {
      const list = grouped.get(customer.countryCode) || []
      list.push(customer)
      grouped.set(customer.countryCode, list)
    }
    for (const [code, list] of grouped.entries()) {
      grouped.set(
        code,
        [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      )
    }
    return grouped
  }, [activityEvents])

  const openCustomerDetail = async (actorKey: string) => {
    setDetailLoading(true)
    setDetailData(null)
    try {
      const res = await fetch(`/api/admin/dashboard/customer-activity/detail?actorKey=${encodeURIComponent(actorKey)}`, {
        cache: "no-store",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Detail fetch failed")
      setDetailData(data as CustomerDetailResponse)
    } catch {
      toast.error("Müşteri detayları alınamadı")
    } finally {
      setDetailLoading(false)
    }
  }

  const openCountryDetail = (countryCode: string) => {
    const customers = onlineCustomersByCountry.get(countryCode) || []
    if (customers.length === 0) {
      toast.info("Bu ülkede şu an online müşteri bulunamadı")
      return
    }
    closeAllOverlays()
    setSelectedCountryCode(countryCode)
    setIsDetailOpen(true)
    setHoveredActorKey(customers[0].actorKey)
    void openCustomerDetail(customers[0].actorKey)
  }

  const selectedCountryCustomers = useMemo(
    () => (selectedCountryCode ? onlineCustomersByCountry.get(selectedCountryCode) || [] : []),
    [onlineCustomersByCountry, selectedCountryCode]
  )

  const selectedCountryName = useMemo(() => {
    if (!selectedCountryCode) return null
    return mapCountries.find((country) => country.code === selectedCountryCode)?.name || selectedCountryCode
  }, [mapCountries, selectedCountryCode])

  const handleCustomerSelect = (actorKey: string) => {
    if (hoveredActorKey === actorKey) return
    setHoveredActorKey(actorKey)
    void openCustomerDetail(actorKey)
  }

  const closeAllOverlays = () => {
    setIsProductsDetailOpen(false)
    setIsOrdersDetailOpen(false)
    setIsCustomersDetailOpen(false)
    setIsPendingDeliveryDetailOpen(false)
    setIsRevenueDetailOpen(false)
    setIsDetailOpen(false)
    setIsDeviceVisitorDetailOpen(false)
  }

  const openDeviceVisitorDetail = async (visitor: DeviceLoginEntry) => {
    setSelectedDeviceVisitor(visitor)
    setDeviceVisitorDetail(null)
    setDeviceVisitorDetailLoading(true)
    setIsDeviceVisitorDetailOpen(true)
    try {
      const res = await fetch(`/api/admin/dashboard/customer-activity/detail?actorKey=${encodeURIComponent(visitor.actorKey)}`, {
        cache: "no-store",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Detail fetch failed")
      setDeviceVisitorDetail(data as CustomerDetailResponse)
    } catch {
      toast.error(tx("Visitor detail could not be loaded", "Ziyaretçi detayı alınamadı"))
    } finally {
      setDeviceVisitorDetailLoading(false)
    }
  }

  const openProductsOverlay = () => {
    closeAllOverlays()
    setIsProductsDetailOpen(true)
  }

  const selectedSuperUserOption = useMemo(
    () => productCreatorData?.superUsers.find((entry) => entry.id === selectedSuperUserId) || null,
    [productCreatorData?.superUsers, selectedSuperUserId]
  )
  const selectedAdminUserOption = useMemo(
    () => productCreatorData?.adminUsers.find((entry) => entry.id === selectedAdminUserId) || null,
    [productCreatorData?.adminUsers, selectedAdminUserId]
  )
  const stableProductActivityCards = useMemo(
    () => [
      { key: "today", label: tx("Today", "Bugün"), value: summary.productsAdded.today, breakdown: [...summary.productsAddedBy.today] },
      { key: "week", label: tx("Week", "Hafta"), value: summary.productsAdded.week, breakdown: [...summary.productsAddedBy.week] },
      { key: "month", label: tx("Month", "Ay"), value: summary.productsAdded.month, breakdown: [...summary.productsAddedBy.month] },
      { key: "year", label: tx("Year", "Yıl"), value: summary.productsAdded.year, breakdown: [...summary.productsAddedBy.year] },
    ] satisfies ProductActivityCard[],
    [
      tx,
      summary.productsAdded.today,
      summary.productsAdded.week,
      summary.productsAdded.month,
      summary.productsAdded.year,
      summary.productsAddedBy.today,
      summary.productsAddedBy.week,
      summary.productsAddedBy.month,
      summary.productsAddedBy.year,
    ]
  )

  const openOrdersOverlay = (country: string | null = null) => {
    closeAllOverlays()
    setOrdersCountryFilter(country)
    setIsOrdersDetailOpen(true)
  }

  const openCustomersOverlay = (country: string | null = null) => {
    closeAllOverlays()
    setCustomersCountryFilter(country)
    setIsCustomersDetailOpen(true)
  }

  const openPendingDeliveryOverlay = () => {
    closeAllOverlays()
    setIsPendingDeliveryDetailOpen(true)
  }

  const openRevenueOverlay = () => {
    closeAllOverlays()
    setIsRevenueDetailOpen(true)
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">

      {/* 1) KPI Row - Soft & Friendly */}
      <div className="relative z-[1] grid grid-cols-1 gap-6 min-[420px]:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: tx("Total Orders", "Toplam Sipariş"),
            value: summary.totalOrders.toLocaleString(),
            detail: `${tx("Today", "Bugün")}: ${summary.ordersBreakdown.today} • ${tx("Week", "Hafta")}: ${summary.ordersBreakdown.week} • ${tx("Month", "Ay")}: ${summary.ordersBreakdown.month}`,
            onOpen: () => openOrdersOverlay(),
          },
          {
            label: tx("Total Customers", "Toplam Müşteri"),
            value: summary.totalCustomers.toLocaleString(),
            detail: `${tx("Today", "Bugün")}: ${summary.customersBreakdown.today} • ${tx("Week", "Hafta")}: ${summary.customersBreakdown.week} • ${tx("Month", "Ay")}: ${summary.customersBreakdown.month}`,
            onOpen: () => openCustomersOverlay(),
          },
          {
            label: tx("Pending Delivery", "Bekleyen Teslimat"),
            value: summary.pendingDelivery.toLocaleString(),
            detail: `Shipped: ${summary.pendingDeliveryBreakdown.shipped} • Pending: ${summary.pendingDeliveryBreakdown.pending} • Cancelled: ${summary.pendingDeliveryBreakdown.cancelled}`,
            onOpen: openPendingDeliveryOverlay,
          },
          {
            label: tx("Total Revenue", "Toplam Ciro"),
            value: isLimitedRole ? tx("Hidden", "Gizli") : `$${summary.totalRevenue.toLocaleString()}`,
            detail: `${tx("Today", "Bugün")}: ${formatCompactCurrency(summary.revenueBreakdown.today)} • ${tx("Week", "Hafta")}: ${formatCompactCurrency(summary.revenueBreakdown.week)} • ${tx("Month", "Ay")}: ${formatCompactCurrency(summary.revenueBreakdown.month)}`,
            onOpen: openRevenueOverlay,
          },
        ].map((kpi, i) => {
          const Icon = KPI_ICONS[i]
          return (
            <Card
              key={kpi.label}
              className={cn(
                DASHBOARD_CARD,
                "relative h-full cursor-pointer overflow-visible transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
              )}
              onClick={kpi.onOpen}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-3">
                  <div className={cn("rounded-full p-2", KPI_COLORS[i])}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-sm font-medium text-slate-700">{kpiLabelByIndex(i, kpi.label)}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="pl-1 text-2xl font-bold text-slate-900">{kpi.value}</div>
                <p className="mt-2 truncate pl-1 text-[11px] text-slate-500">{kpi.detail}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>
      <div className="grid grid-cols-1 justify-items-center gap-4 py-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          className={cn(DASHBOARD_CARD, "min-h-[138px] w-full max-w-[450px] cursor-pointer transition-all duration-300 hover:shadow-md")}
          onClick={() => setIsDeviceLoginsOpen(true)}
        >
          <CardHeader className="pb-1 pt-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-xs font-semibold text-slate-600">{tx("Browsers & Devices", "Tarayıcılar ve Cihazlar")}</CardTitle>
              <span className="text-[10px] font-semibold text-slate-500">{deviceLogins.length}</span>
            </div>
          </CardHeader>
          <CardContent className="pb-2 pt-0">
            {hasDeviceData ? (
              <div className="grid grid-cols-4 gap-2">
                {deviceLogins.slice(0, 4).map((item) => (
                  <div key={item.id} className="rounded-lg bg-slate-50 px-2 py-2 text-center">
                    <p className="truncate text-[11px] font-semibold text-slate-700">{item.browser}</p>
                    <p className="mt-1 truncate text-[10px] text-slate-500">{item.device}</p>
                    <p className="mt-1 truncate text-[10px] text-slate-400">{item.country}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-[62px] items-center justify-center rounded-lg bg-slate-50 px-3 text-center text-[11px] text-slate-500">
                {tx("No recent browser or device activity yet.", "Henüz tarayıcı veya cihaz aktivitesi yok.")}
              </div>
            )}
          </CardContent>
        </Card>

        <Card
          className={cn(DASHBOARD_CARD, "min-h-[138px] w-full max-w-[450px] cursor-pointer transition-all duration-300 hover:shadow-md")}
          onClick={() => setIsAbandonedCartsOpen(true)}
        >
          <CardHeader className="pb-1 pt-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-xs font-semibold text-slate-600">{tx("Abandoned carts", "Sepette bırakılanlar")}</CardTitle>
              <span className="text-[10px] font-semibold text-slate-500">{abandonedCartSummary.total}</span>
            </div>
          </CardHeader>
          <CardContent className="pb-2 pt-0">
            {hasAbandonedCartData ? (
              <div className="grid grid-cols-3 gap-2">
                {abandonedCarts.slice(0, 3).map((item) => (
                  <div key={item.id} className="rounded-lg bg-slate-50 px-2 py-2 text-center">
                    <p className="truncate text-[12px] font-medium text-slate-700">{item.customerName}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">{item.isGuest ? "Guest" : "Customer"}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-[62px] items-center justify-center rounded-lg bg-slate-50 px-3 text-center text-[11px] text-slate-500">
                {tx("No confirmed abandoned carts right now.", "Şu anda doğrulanmış terk edilmiş sepet yok.")}
              </div>
            )}
          </CardContent>
        </Card>

        <Card
          className={cn(DASHBOARD_CARD, "min-h-[138px] w-full max-w-[450px] cursor-pointer transition-all duration-300 hover:shadow-md")}
          onClick={openProductsOverlay}
        >
          <CardHeader className="pb-1 pt-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-slate-600">{tx("Products", "Ürünler")}</CardTitle>
              <div className="rounded-full bg-teal-50 p-1.5 text-teal-700">
                <Boxes className="h-3.5 w-3.5" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pb-2 pt-0">
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: tx("Today", "Bugün"), value: summary.productsAdded.today },
                { label: tx("Week", "Hafta"), value: summary.productsAdded.week },
                { label: tx("Month", "Ay"), value: summary.productsAdded.month },
                { label: tx("Year", "Yıl"), value: summary.productsAdded.year },
              ].map((item) => (
                <div key={item.label} className="rounded-lg bg-slate-50 px-2 py-2 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-4 text-slate-500">
              {tx("Total active products", "Toplam aktif ürün")}: {summary.totalProducts.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDeviceLoginsOpen} onOpenChange={setIsDeviceLoginsOpen}>
        <DialogPortal>
          <DialogOverlay />
          <DialogPrimitive.Content asChild>
            <div
              className="fixed flex flex-col overflow-hidden rounded-lg border border-[#dce3ed] bg-white shadow-lg outline-none"
              style={{
                top: "2vh",
                right: "2vw",
                bottom: "2vh",
                left: "2vw",
                zIndex: 60,
              }}
            >
              <DialogHeader className="shrink-0 border-b border-[#dce3ed] px-5 py-4 pr-14">
                <DialogTitle>{tx("Browser & device details", "Tarayıcı ve cihaz detayları")}</DialogTitle>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <div className="rounded-xl border border-[#dce3ed] bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{tx("Total live", "Canlı toplam")}</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{deviceLogins.length}</p>
                  </div>
                  <div className="rounded-xl border border-[#dce3ed] bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{tx("Top browser", "En sık tarayıcı")}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{deviceTopBrowsers[0]?.label || tx("No data", "Veri yok")}</p>
                  </div>
                  <div className="rounded-xl border border-[#dce3ed] bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{tx("Top device", "En sık cihaz")}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{deviceTopDevices[0]?.label || tx("No data", "Veri yok")}</p>
                  </div>
                  <div className="rounded-xl border border-[#dce3ed] bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{tx("Last activity", "Son aktivite")}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{formatSocialLoginDate(deviceLogins[0]?.createdAt || null)}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
                  {deviceTopBrowsers.slice(0, 3).map((item) => (
                    <div key={`browser-${item.label}`} className="rounded-xl border border-[#dce3ed] bg-white p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{tx("Browser", "Tarayıcı")}</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{item.label}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.count}</p>
                    </div>
                  ))}
                  {deviceTopDevices.slice(0, 3).map((item) => (
                    <div key={`device-${item.label}`} className="rounded-xl border border-[#dce3ed] bg-white p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{tx("Device", "Cihaz")}</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{item.label}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.count}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 space-y-3 pr-1">
                  {deviceLogins.length === 0 ? (
                    <div className="rounded-xl border border-[#dce3ed] bg-slate-50 p-4 text-sm text-slate-500">
                      {tx("No recent browser or device activity yet.", "Henüz tarayıcı veya cihaz aktivitesi yok.")}
                    </div>
                  ) : deviceLogins.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void openDeviceVisitorDetail(item)}
                      className="w-full rounded-xl border border-[#dce3ed] bg-slate-50 p-3 text-left transition-colors hover:border-slate-300 hover:bg-white"
                    >
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                            <div className="flex items-center gap-2">
                              <DeviceBadge label={item.browser} />
                              <DeviceBadge label={item.device} />
                            </div>
                          </div>
                          <p className="mt-1 truncate text-xs text-slate-500">{item.currentPath || "/"}</p>
                          <div className="mt-2 space-y-1 text-xs text-slate-600">
                            <p>
                              <span className="font-semibold text-slate-700">{tx("Browser", "Tarayıcı")}:</span>{" "}
                              {item.browser}
                            </p>
                            <p>
                              <span className="font-semibold text-slate-700">{tx("Device", "Cihaz")}:</span>{" "}
                              {item.device}
                            </p>
                            <p>
                              <span className="font-semibold text-slate-700">{tx("Country", "Ülke")}:</span>{" "}
                              {item.country}
                            </p>
                            <p>
                              <span className="font-semibold text-slate-700">{tx("Last activity", "Son aktivite")}:</span>{" "}
                              {formatSocialLoginDate(item.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-slate-300">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogClose>
            </div>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>

      <Dialog open={isAbandonedCartsOpen} onOpenChange={setIsAbandonedCartsOpen}>
        <DialogPortal>
          <DialogOverlay />
          <DialogPrimitive.Content asChild>
            <div
              className="fixed flex flex-col overflow-hidden rounded-lg border border-[#dce3ed] bg-white shadow-lg outline-none"
              style={{
                top: "2vh",
                right: "2vw",
                bottom: "2vh",
                left: "2vw",
                zIndex: 60,
              }}
            >
              <DialogHeader className="shrink-0 border-b border-[#dce3ed] px-5 py-4 pr-14">
                <DialogTitle>{tx("Abandoned cart details", "Sepette bırakılanlar detay")}</DialogTitle>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto px-5 py-4">
                <div className="min-w-[900px]">
                  <div className="grid grid-cols-4 gap-3">
                    <div className="rounded-xl border border-[#dce3ed] bg-slate-50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{tx("Total", "Toplam")}</p>
                      <p className="mt-2 text-2xl font-bold text-slate-900">{abandonedCartSummary.total}</p>
                    </div>
                    <div className="rounded-xl border border-[#dce3ed] bg-slate-50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{tx("Guests", "Misafir")}</p>
                      <p className="mt-2 text-2xl font-bold text-slate-900">{abandonedCartSummary.guestCount}</p>
                    </div>
                    <div className="rounded-xl border border-[#dce3ed] bg-slate-50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{tx("Customers", "Müşteri")}</p>
                      <p className="mt-2 text-2xl font-bold text-slate-900">{abandonedCartSummary.customerCount}</p>
                    </div>
                    <div className="rounded-xl border border-[#dce3ed] bg-slate-50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{tx("Last activity", "Son aktivite")}</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{formatSocialLoginDate(abandonedCartSummary.lastAt)}</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3 pr-1">
                    {abandonedCarts.length === 0 ? (
                      <div className="rounded-xl border border-[#dce3ed] bg-slate-50 p-4 text-sm text-slate-500">
                        {tx("No confirmed abandoned carts right now.", "Şu anda doğrulanmış terk edilmiş sepet yok.")}
                      </div>
                    ) : abandonedCarts.map((item) => (
                      <div key={item.id} className="rounded-xl border border-[#dce3ed] bg-white p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{item.customerName}</p>
                            <p className="mt-1 text-xs text-slate-500">{item.action}</p>
                            <p className="mt-1 truncate text-xs text-slate-400">{item.currentPath || "/basket"}</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-slate-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            {item.isGuest ? tx("Guest", "Misafir") : tx("Customer", "Müşteri")}
                          </span>
                        </div>
                        <p className="mt-3 text-xs text-slate-500">
                          <span className="font-semibold text-slate-700">{tx("Added at", "Eklenme")}:</span>{" "}
                          {formatSocialLoginDate(item.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-slate-300">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogClose>
            </div>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>

      <Dialog open={isDeviceVisitorDetailOpen} onOpenChange={setIsDeviceVisitorDetailOpen}>
        <DialogPortal>
          <DialogOverlay />
          <DialogPrimitive.Content asChild>
            <div
              className="fixed flex flex-col overflow-hidden rounded-lg border border-[#dce3ed] bg-white shadow-lg outline-none"
              style={{
                top: "2vh",
                right: "2vw",
                bottom: "2vh",
                left: "2vw",
                zIndex: 70,
              }}
            >
              <DialogHeader className="shrink-0 border-b border-[#dce3ed] px-5 py-4 pr-14">
                <DialogTitle>
                  {selectedDeviceVisitor
                    ? `${selectedDeviceVisitor.name} • ${tx("Visitor detail", "Ziyaretçi detayı")}`
                    : tx("Visitor detail", "Ziyaretçi detayı")}
                </DialogTitle>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {deviceVisitorDetailLoading ? (
                  <p className="text-sm text-slate-600">{tx("Loading details...", "Detaylar yükleniyor...")}</p>
                ) : !deviceVisitorDetail ? (
                  <p className="text-sm text-slate-600">{tx("Visitor detail will appear here.", "Ziyaretçi detayı burada görünecek.")}</p>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
                      <div className="rounded-xl border border-[#dce3ed] bg-slate-50 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{tx("Current page", "Anlık sayfa")}</p>
                        <p className="mt-2 truncate text-sm font-semibold text-slate-900">
                          {deviceVisitorDetail.customer.currentPath || selectedDeviceVisitor?.currentPath || "/"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {deviceVisitorDetail.customer.currentPageTitle || tx("No page title", "Sayfa başlığı yok")}
                        </p>
                      </div>
                      <div className="rounded-xl border border-[#dce3ed] bg-slate-50 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{tx("Longest stay", "En uzun kalınan")}</p>
                        <p className="mt-2 truncate text-sm font-semibold text-slate-900">
                          {deviceVisitorDetail.customer.longestStayPath || tx("Unknown", "Bilinmiyor")}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatDuration(deviceVisitorDetail.customer.longestStayMs)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-[#dce3ed] bg-slate-50 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{tx("Hovered item", "Uzerinde kalınan öge")}</p>
                        <p className="mt-2 truncate text-sm font-semibold text-slate-900">
                          {deviceVisitorDetail.customer.lastHoverLabel || tx("No hover data", "Hover verisi yok")}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {deviceVisitorDetail.customer.lastHoverType || tx("Unknown", "Bilinmiyor")}
                        </p>
                      </div>
                      <div className="rounded-xl border border-[#dce3ed] bg-slate-50 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{tx("Last action", "Son aksiyon")}</p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">
                          {deviceVisitorDetail.customer.lastAction || tx("No action", "Aksiyon yok")}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {deviceVisitorDetail.customer.lastActiveAt ? new Date(deviceVisitorDetail.customer.lastActiveAt).toLocaleString() : tx("Unknown", "Bilinmiyor")}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#dce3ed] bg-white p-4">
                      <p className="mb-3 text-sm font-semibold text-slate-900">{tx("Visited pages and engagement", "Girilen sayfalar ve etkileşim")}</p>
                      {deviceVisitorDetail.pages.length === 0 ? (
                        <p className="text-sm text-slate-500">{tx("No page activity recorded yet.", "Henüz sayfa aktivitesi kaydedilmedi.")}</p>
                      ) : (
                        <div className="space-y-3">
                          {deviceVisitorDetail.pages.map((page, index) => (
                            <div key={`${page.path}-${page.source}-${index}`} className="rounded-lg border border-[#e6ecf4] bg-slate-50 p-3">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-900">{page.path}</p>
                                  <p className="mt-1 text-xs text-slate-500">{page.title || tx("No page title", "Sayfa başlığı yok")}</p>
                                </div>
                                <div className="grid shrink-0 grid-cols-3 gap-2 text-right">
                                  <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{tx("Visits", "Giriş")}</p>
                                    <p className="text-sm font-semibold text-slate-900">{page.count}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{tx("Stay", "Kalma")}</p>
                                    <p className="text-sm font-semibold text-slate-900">{formatDuration(page.totalMs)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{tx("Last seen", "Son görülen")}</p>
                                    <p className="text-xs font-semibold text-slate-900">{new Date(page.lastAt).toLocaleString()}</p>
                                  </div>
                                </div>
                              </div>
                              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3 text-xs text-slate-600">
                                <p>
                                  <span className="font-semibold text-slate-700">{tx("Source", "Kaynak")}:</span> {page.source}
                                </p>
                                <p>
                                  <span className="font-semibold text-slate-700">{tx("Hovered text", "Uzerinde kalınan yazı")}:</span>{" "}
                                  {page.lastHoverLabel || tx("No hover data", "Hover verisi yok")}
                                </p>
                                <p>
                                  <span className="font-semibold text-slate-700">{tx("Hovered type", "Uzerinde kalınan tür")}:</span>{" "}
                                  {page.lastHoverType || tx("Unknown", "Bilinmiyor")}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-slate-300">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogClose>
            </div>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>

      <Dialog open={isProductsDetailOpen} onOpenChange={setIsProductsDetailOpen}>
        <DialogPortal>
          <DialogOverlay />
          <DialogPrimitive.Content asChild>
            <div
              className="fixed flex flex-col overflow-hidden rounded-lg border border-[#dce3ed] bg-white shadow-lg outline-none"
              style={{
                top: "2vh",
                right: "2vw",
                bottom: "2vh",
                left: "2vw",
                zIndex: 60,
              }}
            >
              <DialogHeader className="shrink-0 border-b border-[#dce3ed] px-5 py-4 pr-14">
                <DialogTitle>{tx("Products added by user", "Ürün ekleyen kullanıcılar")}</DialogTitle>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto px-5 py-4">
                <div className="min-w-[1100px]">
                  <div className="grid gap-4 xl:grid-cols-3">
                    <ProductCreatorListPanel
                      title={tx("Super Users", "Super Userlar")}
                      description={tx("Real product creation data by selected super user.", "Seçilen super user için gerçek ürün oluşturma verisi.")}
                      total={productCreatorData?.superUserSection.total || 0}
                      productsLabel={tx("products", "ürün")}
                      selectedUserId={selectedSuperUserId}
                      onSelectedUserIdChange={setSelectedSuperUserId}
                      selectUserLabel={tx("Select super user", "Super user seç")}
                      users={productCreatorData?.superUsers || []}
                      selectedPeriod={selectedSuperUserPeriod}
                      onSelectedPeriodChange={setSelectedSuperUserPeriod}
                      periodOptions={PRODUCT_PERIOD_OPTIONS}
                      isTr={isTr}
                      selectedUserLabel={selectedSuperUserOption?.label || tx("No super user selected", "Super user seçilmedi")}
                      selectedUserEmail={selectedSuperUserOption?.email || tx("Choose a super user to inspect their product activity.", "Ürün aktivitesini görmek için bir super user seçin.")}
                      loading={productCreatorLoading}
                      loadingLabel={tx("Loading products...", "Ürünler yükleniyor...")}
                      emptyLabel={tx("No products found for this super user in the selected period.", "Seçilen dönemde bu super user için ürün bulunamadı.")}
                      products={productCreatorData?.superUserSection.products || []}
                      previousLabel={tx("Previous", "Önceki")}
                      nextLabel={tx("Next", "Sonraki")}
                    />

                    <ProductCreatorListPanel
                      title={tx("Admin Users", "Admin Kullanıcılar")}
                      description={tx("Real product creation data by selected admin user.", "Seçilen admin kullanıcı için gerçek ürün oluşturma verisi.")}
                      total={productCreatorData?.adminSection.total || 0}
                      productsLabel={tx("products", "ürün")}
                      selectedUserId={selectedAdminUserId}
                      onSelectedUserIdChange={setSelectedAdminUserId}
                      selectUserLabel={tx("Select admin user", "Admin kullanıcı seç")}
                      users={productCreatorData?.adminUsers || []}
                      selectedPeriod={selectedAdminUserPeriod}
                      onSelectedPeriodChange={setSelectedAdminUserPeriod}
                      periodOptions={PRODUCT_PERIOD_OPTIONS}
                      isTr={isTr}
                      selectedUserLabel={selectedAdminUserOption?.label || tx("No admin user selected", "Admin kullanıcı seçilmedi")}
                      selectedUserEmail={selectedAdminUserOption?.email || tx("Choose an admin user to inspect their product activity.", "Ürün aktivitesini görmek için bir admin kullanıcı seçin.")}
                      loading={productCreatorLoading}
                      loadingLabel={tx("Loading products...", "Ürünler yükleniyor...")}
                      emptyLabel={tx("No products found for this admin user in the selected period.", "Seçilen dönemde bu admin kullanıcı için ürün bulunamadı.")}
                      products={productCreatorData?.adminSection.products || []}
                      previousLabel={tx("Previous", "Önceki")}
                      nextLabel={tx("Next", "Sonraki")}
                    />

                    <ProductActivityPanel
                      title={tx("Live Product Activity", "Canlı Ürün Aktivitesi")}
                      description={tx("Real-time product totals and creator breakdown from the dashboard summary source.", "Dashboard summary kaynağından gerçek zamanlı ürün toplamları ve creator dağılımı.")}
                      totalProducts={summary.totalProducts}
                      activeLabel={tx("active", "aktif")}
                      creatorBreakdownLabel={tx("Creator breakdown", "Creator dağılımı")}
                      liveLabel={tx("Live", "Canlı")}
                      noCreatorDataLabel={tx("No creator data", "Creator verisi yok")}
                      noCreatorRecordsLabel={tx("No creator records in this period.", "Bu dönemde creator kaydı yok.")}
                      cards={stableProductActivityCards}
                    />
                  </div>
                </div>
              </div>

              <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-slate-300">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogClose>
            </div>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
      <Dialog open={isOrdersDetailOpen} onOpenChange={setIsOrdersDetailOpen}>
        <DialogContent className="flex max-h-[92dvh] w-[94vw] max-w-5xl flex-col overflow-hidden border-[#dce3ed] bg-white p-0">
          <DialogHeader className="shrink-0 border-b border-[#dce3ed] px-6 py-4 pr-14">
            <DialogTitle>
              {tx("Total Orders Detail", "Toplam Sipariş Detay")}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-5 pr-1">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-[#dce3ed] bg-slate-50 p-4">
                <p className="mb-2 text-sm font-semibold text-slate-900">{tx("Orders by country", "Hangi ülkeden alındığı")}</p>
                {summary.ordersTodayByCountry.length === 0 ? (
                  <p className="text-xs text-slate-500">{tx("No country order data yet.", "Henüz ülke bazlı sipariş verisi yok.")}</p>
                ) : (
                  <div className="space-y-1.5">
                    {summary.ordersTodayByCountry.slice(0, 6).map((row) => (
                      <button
                        key={`orders-country-${row.country}`}
                        type="button"
                        onClick={() => setOrdersCountryFilter(row.country)}
                        className={cn(
                          "flex w-full items-center justify-between rounded bg-white px-2.5 py-1.5 text-xs",
                          ordersCountryFilter === row.country ? "border border-slate-300" : "border border-transparent"
                        )}
                      >
                        <span className="truncate text-slate-700">{row.country}</span>
                        <span className="font-semibold text-slate-900">{row.count}</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setOrdersCountryFilter(null)}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
                    >
                      {tx("Show all countries", "Tüm ülkeleri göster")}
                    </button>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-[#dce3ed] bg-slate-50 p-4">
                <p className="mb-2 text-sm font-semibold text-slate-900">{tx("Admin sales performance", "Ürünü ekleyen admin ve satış toplamı")}</p>
                {summary.adminSalesByCreator.length === 0 ? (
                  <p className="text-xs text-slate-500">{tx("No admin sales data yet.", "Henüz admin satış verisi yok.")}</p>
                ) : (
                  <div className="space-y-2">
                    {summary.adminSalesByCreator.slice(0, 4).map((row) => (
                      <div key={`admin-sales-${row.creator}`} className="rounded bg-white px-3 py-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{row.creator}</p>
                        <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
                          <span>{tx("Items sold", "Satılan adet")}: {row.itemsSold}</span>
                          <span className="font-semibold text-emerald-700">
                            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(row.salesTotal || 0))}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {filteredOrdersTodayDetails.length === 0 ? (
              <p className="text-sm text-slate-500">{tx("No order record for this filter.", "Bu filtre için sipariş kaydı yok.")}</p>
            ) : (
              filteredOrdersTodayDetails.map((order) => (
                <div key={order.id} className="rounded-md border border-[#e6ecf4] bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{order.orderNumber}</p>
                      <p className="text-xs text-slate-600">{order.customer} • {order.country}</p>
                    </div>
                    <span className="text-[11px] text-slate-500">{new Date(order.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {order.products.length === 0 ? (
                      <p className="text-xs text-slate-500">{tx("No product line.", "Ürün satırı yok.")}</p>
                    ) : (
                      order.products.map((item, idx) => (
                        <div key={`${order.id}-${idx}-${item.title}`} className="flex items-center justify-between rounded bg-white px-2 py-1 text-xs">
                          <span className="truncate text-slate-700">{item.title}</span>
                          <span className="ml-2 shrink-0 font-medium text-slate-900">x{item.quantity}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isCustomersDetailOpen} onOpenChange={setIsCustomersDetailOpen}>
        <DialogContent className="flex max-h-[92dvh] w-[94vw] max-w-xl flex-col overflow-hidden border-[#dce3ed] bg-white p-0">
          <DialogHeader className="shrink-0 border-b border-[#dce3ed] px-6 py-4 pr-14">
            <DialogTitle>
              {customersCountryFilter
                ? `${customersCountryFilter} • ${tx("Registered customers", "Kayıtlı müşteriler")}`
                : tx("Customers by country", "Ülkeye göre müşteriler")}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-2 pr-1">
            {filteredCustomersByCountryDetails.length === 0 ? (
              <p className="text-sm text-slate-500">{tx("No customer record for this filter.", "Bu filtre için müşteri kaydı yok.")}</p>
            ) : (
              filteredCustomersByCountryDetails.map((customer) => (
                <div key={customer.id} className="rounded-md border border-[#e6ecf4] bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">{customer.name}</p>
                  <p className="text-xs text-slate-600">{customer.email}</p>
                  <p className="text-xs text-slate-600">{customer.country}</p>
                  <p className="text-[11px] text-slate-500">
                    {tx("Registered", "Kayıt")}: {new Date(customer.createdAt).toLocaleString()}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {tx("Last login", "Son giriş")}: {customer.lastLoginAt ? new Date(customer.lastLoginAt).toLocaleString() : tx("Unknown", "Bilinmiyor")}
                  </p>
                </div>
              ))
            )}
          </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isPendingDeliveryDetailOpen} onOpenChange={setIsPendingDeliveryDetailOpen}>
        <DialogContent className="flex max-h-[92dvh] w-[94vw] max-w-lg flex-col overflow-hidden border-[#dce3ed] bg-white p-0">
          <DialogHeader className="shrink-0 border-b border-[#dce3ed] px-6 py-4 pr-14">
            <DialogTitle>{tx("Pending Delivery Detail", "Bekleyen Teslimat Detay")}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="grid gap-3">
            {[
              { key: "shipped", label: "shipped", value: summary.pendingDeliveryBreakdown.shipped },
              { key: "pending", label: "pending", value: summary.pendingDeliveryBreakdown.pending },
              { key: "cancelled", label: "cancelled", value: summary.pendingDeliveryBreakdown.cancelled },
              { key: "other", label: "other", value: summary.pendingDeliveryBreakdown.other },
            ].map((row) => (
              <div key={`delivery-${row.key}`} className="flex items-center justify-between rounded-md border border-[#e6ecf4] bg-slate-50 px-3 py-2 text-sm">
                <span className="capitalize text-slate-700">{row.label}</span>
                <span className="font-semibold text-slate-900">{row.value}</span>
              </div>
            ))}
          </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isRevenueDetailOpen} onOpenChange={setIsRevenueDetailOpen}>
        <DialogContent className="flex max-h-[92dvh] w-[94vw] max-w-lg flex-col overflow-hidden border-[#dce3ed] bg-white p-0">
          <DialogHeader className="shrink-0 border-b border-[#dce3ed] px-6 py-4 pr-14">
            <DialogTitle>{tx("Revenue Detail", "Gelir Detay")}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="grid gap-3">
            {[
              { key: "today", label: tx("Today", "Bugün"), value: summary.revenueBreakdown.today },
              { key: "week", label: tx("This week", "Bu hafta"), value: summary.revenueBreakdown.week },
              { key: "month", label: tx("This month", "Bu ay"), value: summary.revenueBreakdown.month },
            ].map((row) => (
              <div key={`revenue-${row.key}`} className="flex items-center justify-between rounded-md border border-[#e6ecf4] bg-slate-50 px-3 py-2 text-sm">
                <span className="text-slate-700">{row.label}</span>
                <span className="font-semibold text-slate-900">
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(row.value || 0))}
                </span>
              </div>
            ))}
          </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 2) Analytics + Live Map (Equal) */}
      {!isLimitedRole ? <div className="grid gap-6 md:grid-cols-2">

        <Card className={cn(DASHBOARD_CARD)}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg text-slate-900">{tx("Sales Analytic", "Satis Analizi")}</CardTitle>
              <p className="text-sm text-slate-600 font-normal">{tx("Monthly sales performance", "Aylik satis performansi")}</p>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500 shadow-sm shadow-teal-200" />
                <span className="text-slate-600">{tx("Income", "Gelir")}</span>
                <span className="font-semibold text-slate-900">{formatCompactCurrency(summary.salesAnalytics.income)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                <span className="text-slate-600">{tx("Expense", "Gider")}</span>
                <span className="font-semibold text-slate-900">{formatCompactCurrency(summary.salesAnalytics.expense)}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full mt-4">
              {chartsReady ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={summary.salesAnalytics.chart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0D9488" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#0D9488" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8' }} dy={10} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} tick={{ fill: '#94a3b8' }} dx={-10} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ color: '#334155' }}
                      labelStyle={{ color: '#94a3b8', marginBottom: '0.25rem' }}
                    />
                    <Area type="monotone" dataKey="income" stroke="#0D9488" strokeWidth={2.5} fillOpacity={1} fill="url(#colorIncome)" activeDot={{ r: 6, strokeWidth: 0, fill: '#0D9488' }} />
                    <Area type="monotone" dataKey="expense" stroke="#cbd5e1" strokeWidth={2} fillOpacity={0} fill="transparent" strokeDasharray="4 4" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full animate-pulse rounded-xl bg-slate-100" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={cn(DASHBOARD_CARD)}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg text-slate-900">{tx("Live Customer Map", "Canli Musteri Haritasi")}</CardTitle>
              <p className="text-sm text-slate-600 font-normal">{tx("Active customer countries and real-time activity.", "Aktif musteri ulkeleri ve gercek zamanli aktivite.")}</p>
            </div>
            <Globe2 className="h-5 w-5 text-teal-600" />
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-[#dce3ed] bg-[#eef2f7] p-3">
              <div className="relative h-[240px] overflow-hidden rounded-md bg-[#e8edf4]">
                {worldShapes.length === 0 ? (
                  <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-500">
                    {tx("Map geometry is unavailable right now, but live country activity is still tracked below.", "Harita geometrisi şu anda yüklenemedi, ancak canlı ülke aktivitesi aşağıda izlenmeye devam ediyor.")}
                  </div>
                ) : (
                  <>
                    <svg viewBox="0 0 1200 560" className="absolute inset-0 h-full w-full">
                      <defs>
                        <pattern id="world-grid" width="60" height="30" patternUnits="userSpaceOnUse">
                          <path d="M 60 0 L 0 0 0 30" fill="none" stroke="#d8e0ea" strokeWidth="1" />
                        </pattern>
                      </defs>
                      <rect x="0" y="0" width="1200" height="560" fill="url(#world-grid)" />
                      {worldShapes.map((shape) => {
                        const code = shape.code
                        const activeCount = code ? Number(activeCountByCountry.get(code) || 0) : 0
                        const isHover = Boolean(code && hoverCountryCode === code)
                        const palette = getTierPalette(activeCount)
                        return (
                          <path
                            key={shape.key}
                            d={shape.path}
                            fill={isHover ? "#2b6f9e" : palette.fill}
                            stroke={isHover ? "#184d75" : palette.stroke}
                            strokeWidth={isHover ? 1.4 : 0.8}
                          />
                        )
                      })}
                      {recentRoutes.map((route) => (
                        <line
                          key={route.id}
                          x1={(route.from.x / 100) * 1200}
                          y1={(route.from.y / 100) * 560}
                          x2={(route.to.x / 100) * 1200}
                          y2={(route.to.y / 100) * 560}
                          stroke="#0f172a"
                          strokeWidth="2"
                          strokeDasharray="2 9"
                          className="animate-[dashmove_10s_linear_infinite]"
                        />
                      ))}
                    </svg>
                    <svg viewBox="0 0 1200 560" className="absolute inset-0 z-10 h-full w-full">
                      {worldShapes.map((shape) => {
                        const code = shape.code
                        if (!code) return null
                        const hasActive = Number(activeCountByCountry.get(code) || 0) > 0
                        return (
                          <path
                            key={`hit-${shape.key}`}
                            d={shape.path}
                            fill="transparent"
                            onMouseEnter={() => setHoverCountryCode(code)}
                            onMouseLeave={() => setHoverCountryCode(null)}
                            onClick={() => hasActive && openCountryDetail(code)}
                            className={hasActive ? "cursor-pointer" : undefined}
                          />
                        )
                      })}
                    </svg>

                    {hoveredCountryName ? (
                      <div className="absolute left-3 top-3 z-30 rounded-md border border-teal-300 bg-white/95 px-2.5 py-1.5 shadow-sm">
                        <p className="text-xs font-semibold text-slate-900">{hoveredCountryName}</p>
                        <p className="text-[11px] text-slate-600">{hoveredActiveCustomers} {tx("active customers", "aktif musteri")}</p>
                        <p className="text-[11px] text-slate-600">{hoveredRegisteredCustomers} {tx("registered customers", "kayitli musteri")}</p>
                      </div>
                    ) : null}
                  </>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {activityCountries.length === 0 ? (
                  <span className="text-xs text-slate-500">{tx("No active country data yet.", "Henuz aktif ulke verisi yok.")}</span>
                ) : (
                  activityCountries.slice(0, 8).map((country) => (
                    <span key={country.code} className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
                      {country.name}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-[#e6ecf4] bg-white p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">{tx("Live Activity", "Canli Aktivite")}</p>
              <div className="space-y-2">
                {activityEvents.length === 0 ? (
                  <p className="text-xs text-slate-500">{tx("No live customer events.", "Canli musteri olayi yok.")}</p>
                ) : (
                  activityEvents.slice(0, 4).map((event) => (
                    <div key={event.id} className="flex items-start justify-between rounded-md bg-slate-50 px-2.5 py-2">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{event.customerName}</p>
                        <p className="text-xs text-slate-600">{event.action} • {event.countryName}</p>
                      </div>
                      <span className="text-[11px] text-slate-500">{new Date(event.createdAt).toLocaleTimeString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <style jsx>{`
          @keyframes dashmove {
            to {
              stroke-dashoffset: -200;
            }
          }
        `}</style>

      </div> : null}

      {/* 3) Products + Sales Target */}
      <div className="grid gap-6 md:grid-cols-12">

        {/* Top Selling (Wide) */}
        <Card className={cn(isLimitedRole ? "md:col-span-12" : "md:col-span-8", DASHBOARD_CARD)}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-slate-900">{tx("Top Selling Products", "Cok Satan Urunler")}</CardTitle>
            <div className="flex gap-2">
              <button className="h-8 w-8 rounded-full border border-[#dce3ed] flex items-center justify-center hover:bg-slate-50 text-slate-600 transition-colors"><ChevronLeft className="h-4 w-4" /></button>
              <button className="h-8 w-8 rounded-full border border-[#dce3ed] flex items-center justify-center hover:bg-slate-50 text-slate-600 transition-colors"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </CardHeader>
          <CardContent className="pb-6">
            <div className="rounded-lg border border-[#e6ecf4] overflow-hidden">
              <div className="grid grid-cols-12 bg-slate-50 px-4 py-3 text-xs font-semibold tracking-wide text-slate-600 uppercase">
                <div className="col-span-6">{tx("Product", "Urun")}</div>
                <div className="col-span-3">{tx("Category", "Kategori")}</div>
                <div className="col-span-2 text-right">{tx("Price", "Fiyat")}</div>
                <div className="col-span-1 text-right">{tx("Stock", "Stok")}</div>
              </div>

              {productsLoading ? (
                <div className="px-4 py-8 text-sm text-slate-500">{tx("Loading products...", "Urunler yukleniyor...")}</div>
              ) : topProducts.length === 0 ? (
                <div className="px-4 py-8 text-sm text-slate-500">{tx("No sold products found yet.", "Henüz satış görmüş ürün yok.")}</div>
              ) : (
                <div className="divide-y divide-[#edf2f8]">
                  {topProducts.map((product) => {
                    const image = parseProductImages(product.images)[0] || ""

                    return (
                      <div
                        key={product.id}
                        className="grid grid-cols-12 items-center gap-2 px-4 py-3 transition-transform duration-150 hover:scale-[1.002]"
                      >
                        <div className="col-span-6 flex items-center gap-3 min-w-0">
                          <div className="h-11 w-11 rounded-md border border-[#dce3ed] bg-slate-100 overflow-hidden shrink-0">
                            {image ? (
                              <img src={image} alt={product.title} className="h-full w-full object-cover" />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{product.title}</p>
                            <p className="text-xs text-slate-500 truncate">SKU: {product.sku?.trim() || product.slug}</p>
                          </div>
                        </div>
                        <div className="col-span-3 text-sm text-slate-700 truncate">
                          {product.categories?.[0]?.title || tx("Unassigned", "Atanmamis")}
                        </div>
                        <div className="col-span-2 text-right font-semibold text-slate-900">
                          ${Number(product.price || 0).toFixed(2)}
                        </div>
                        <div className="col-span-1 text-right text-sm text-slate-700">
                          {product.stockCount}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sales Target (Moved here) */}
        {!isLimitedRole ? <Card className={cn("md:col-span-4", DASHBOARD_CARD)}>
          <CardHeader>
            <CardTitle className="text-slate-900">{tx("Sales Target", "Satis Hedefi")}</CardTitle>
            <p className="text-sm text-slate-600 font-normal">{tx("Daily progress", "Gunluk ilerleme")}</p>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-6">
            <div className="flex h-[200px] w-full items-center justify-center rounded-xl border border-dashed border-[#dce3ed] bg-slate-50 px-6 text-center text-sm text-slate-500">
              {tx("No real sales target source is configured yet.", "Henüz gerçek satış hedefi kaynağı tanımlı değil.")}
            </div>
            <div className="w-full mt-6 space-y-4">
              <div className="flex justify-between text-sm items-center">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-500" />
                  <span className="text-slate-600">{tx("Daily Target", "Gunluk Hedef")}</span>
                </div>
                <span className="font-bold text-slate-900">{tx("No data", "Veri yok")}</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-200" />
                  <span className="text-slate-600">{tx("Monthly Target", "Aylik Hedef")}</span>
                </div>
                <span className="font-bold text-slate-900">{tx("No data", "Veri yok")}</span>
              </div>
            </div>
          </CardContent>
        </Card> : null}

      </div>

      {/* 4) Current Offers (Lower Left) */}
      {!isLimitedRole ? <div className="grid gap-6 md:grid-cols-12">
        <Card className={cn("md:col-span-6", DASHBOARD_CARD)}>
          <CardHeader>
            <CardTitle className="text-slate-900">{tx("Current Offers", "Guncel Teklifler")}</CardTitle>
            <p className="text-sm text-slate-600 font-normal">{tx("Active promotions", "Aktif kampanyalar")}</p>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="flex min-h-[160px] items-center justify-center rounded-xl border border-dashed border-[#dce3ed] bg-slate-50 px-6 text-center text-sm text-slate-500">
              {tx("No live promotion source is configured yet.", "Henüz canlı kampanya kaynağı tanımlı değil.")}
            </div>
          </CardContent>
        </Card>
      </div> : null}

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="flex max-h-[92dvh] w-[94vw] max-w-3xl flex-col overflow-hidden border-[#dce3ed] bg-white p-0">
          <DialogHeader className="shrink-0 border-b border-[#dce3ed] px-6 py-4 pr-14">
            <DialogTitle>
              {selectedCountryName ? `${selectedCountryName} • Online Müşteriler` : "Müşteri Detayı"}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-md border border-[#e6ecf4] bg-slate-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Online Kişiler ({selectedCountryCustomers.length})
              </p>
              {selectedCountryCustomers.length === 0 ? (
                <p className="text-sm text-slate-500">Online müşteri bulunamadı.</p>
              ) : (
                <div className="space-y-2">
                  {selectedCountryCustomers.map((customer) => (
                    <div
                      key={customer.actorKey}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleCustomerSelect(customer.actorKey)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          handleCustomerSelect(customer.actorKey)
                        }
                      }}
                      className={cn(
                        "w-full min-h-[92px] rounded-md border px-3 py-2 text-left transition-colors",
                        hoveredActorKey === customer.actorKey
                          ? "border-teal-300 bg-teal-50"
                          : "border-[#e6ecf4] bg-white hover:bg-slate-50"
                      )}
                    >
                      <p className="text-sm font-medium text-slate-900">{customer.customerName}</p>
                      {customer.email ? (
                        <p className="text-[11px] text-slate-600">{customer.email}</p>
                      ) : null}
                      <p className="text-[11px] text-slate-600">{customer.action}</p>
                      {customer.currentPath ? (
                        <a
                          href={toAbsolutePath(customer.currentPath)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex max-w-full truncate text-[11px] text-teal-700 underline underline-offset-2 hover:text-teal-800"
                        >
                          {customer.currentPath}
                        </a>
                      ) : null}
                      <p className="text-[11px] text-slate-500">{new Date(customer.createdAt).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-md border border-[#e6ecf4] bg-white p-3">
              {detailLoading ? (
                <p className="text-sm text-slate-600">Detaylar yükleniyor...</p>
              ) : !detailData ? (
                <p className="text-sm text-slate-600">Kişi seçildiğinde detay burada görünür.</p>
              ) : (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Bulunduğu Sayfalar
                  </p>
                  {detailData.pages.length === 0 ? (
                    <p className="text-sm text-slate-500">Kayıtlı sayfa hareketi yok.</p>
                  ) : (
                    <div className="max-h-[210px] space-y-2 overflow-y-auto pr-1">
                      {detailData.pages.map((page) => (
                        <div key={`${page.path}-${page.source}`} className="rounded-md border border-[#e6ecf4] bg-white px-3 py-2">
                          <a
                            href={toAbsolutePath(page.path)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex max-w-full truncate text-sm font-medium text-teal-700 underline underline-offset-2 hover:text-teal-800"
                          >
                            {page.path}
                          </a>
                          <p className="text-[11px] text-slate-600">
                            {page.source} • {page.count} kez
                          </p>
                          <p className="text-[11px] text-slate-500">{new Date(page.lastAt).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
