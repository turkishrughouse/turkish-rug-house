"use client"

import Link from "next/link"
import { useMemo, useState, useSyncExternalStore } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts"

type ReportItem = {
  productId: string | null
  title: string
  quantity: number
  price: number
}

type ReportOrder = {
  id: string
  orderNumber: string
  createdAt: string
  total: number
  status: string
  itemsPurchased: number
  items: ReportItem[]
}

type RangeKey = "year" | "lastMonth" | "thisMonth" | "last7" | "custom"
type ReportView = "sales_by_date" | "sales_by_product" | "sales_by_category" | "coupons_by_date" | "customer_downloads"

const SALES_STATUSES = new Set(["PAID", "FULFILLED", "COMPLETED"])
const REFUNDED_STATUSES = new Set(["CANCELLED", "REFUNDED"])

function subscribeToHydration() {
  return () => {}
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function addDays(value: Date, days: number) {
  const next = new Date(value)
  next.setDate(next.getDate() + days)
  return next
}

function formatMoney(value: number) {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDayLabel(value: Date) {
  return value.toLocaleDateString("en-US", { day: "2-digit", month: "short" })
}

function formatDateInput(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`
}

function getRangeDates(range: RangeKey, customFrom: string, customTo: string) {
  const today = startOfDay(new Date())

  if (range === "last7") return { from: addDays(today, -6), to: today }
  if (range === "thisMonth") return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: today }
  if (range === "lastMonth") {
    const firstOfCurrent = new Date(today.getFullYear(), today.getMonth(), 1)
    const firstOfLast = new Date(firstOfCurrent.getFullYear(), firstOfCurrent.getMonth() - 1, 1)
    const lastOfLast = new Date(firstOfCurrent.getFullYear(), firstOfCurrent.getMonth(), 0)
    return { from: firstOfLast, to: startOfDay(lastOfLast) }
  }
  if (range === "year") return { from: new Date(today.getFullYear(), 0, 1), to: today }

  const from = customFrom ? startOfDay(new Date(customFrom)) : addDays(today, -6)
  const to = customTo ? startOfDay(new Date(customTo)) : today
  return from <= to ? { from, to } : { from: to, to: from }
}

function EmptyView({ text }: { text: string }) {
  return (
    <div className="rounded-sm border border-[#dcdcde] bg-white p-6 text-sm text-slate-600">
      {text}
    </div>
  )
}

export function OrderReportsDashboard({
  orders,
  productCategoryMap,
}: {
  orders: ReportOrder[]
  productCategoryMap: Record<string, string[]>
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentView = (searchParams.get("view") || "sales_by_date") as ReportView

  const [range, setRange] = useState<RangeKey>("last7")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [appliedCustomFrom, setAppliedCustomFrom] = useState("")
  const [appliedCustomTo, setAppliedCustomTo] = useState("")
  const chartsReady = useSyncExternalStore(subscribeToHydration, () => true, () => false)

  const { from, to } = useMemo(
    () => getRangeDates(range, appliedCustomFrom, appliedCustomTo),
    [range, appliedCustomFrom, appliedCustomTo]
  )

  const filteredOrders = useMemo(
    () => orders.filter((order) => {
      const created = startOfDay(new Date(order.createdAt))
      return created >= from && created <= to
    }),
    [orders, from, to]
  )
  const soldOrders = useMemo(() => filteredOrders.filter((order) => SALES_STATUSES.has(order.status)), [filteredOrders])
  const refundedOrders = useMemo(() => filteredOrders.filter((order) => REFUNDED_STATUSES.has(order.status)), [filteredOrders])

  const grossSales = soldOrders.reduce((sum, order) => sum + order.total, 0)
  const refundedAmount = refundedOrders.reduce((sum, order) => sum + order.total, 0)
  const netSales = grossSales - refundedAmount
  const ordersPlaced = soldOrders.length
  const itemsPurchased = soldOrders.reduce((sum, order) => sum + order.itemsPurchased, 0)

  const salesByDate = useMemo(() => {
    const map = new Map<string, number>()
    soldOrders.forEach((order) => {
      const key = formatDateInput(startOfDay(new Date(order.createdAt)))
      map.set(key, (map.get(key) || 0) + order.total)
    })
    const rows: Array<{ label: string; sales: number }> = []
    for (let cursor = new Date(from); cursor <= to; cursor = addDays(cursor, 1)) {
      const key = formatDateInput(cursor)
      rows.push({ label: formatDayLabel(cursor), sales: Number((map.get(key) || 0).toFixed(2)) })
    }
    return rows
  }, [soldOrders, from, to])

  const productRows = useMemo(() => {
    const map = new Map<string, { title: string; revenue: number; qty: number; orders: Set<string> }>()
    soldOrders.forEach((order) => {
      order.items.forEach((item) => {
        const key = item.productId || item.title
        const existing = map.get(key) || { title: item.title, revenue: 0, qty: 0, orders: new Set<string>() }
        existing.revenue += item.price * item.quantity
        existing.qty += item.quantity
        existing.orders.add(order.id)
        map.set(key, existing)
      })
    })
    return Array.from(map.values())
      .map((row) => ({ title: row.title, revenue: Number(row.revenue.toFixed(2)), qty: row.qty, orders: row.orders.size }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [soldOrders])

  const categoryRows = useMemo(() => {
    const map = new Map<string, { revenue: number; qty: number }>()
    soldOrders.forEach((order) => {
      order.items.forEach((item) => {
        const cats = item.productId ? productCategoryMap[item.productId] || ["Uncategorized"] : ["Uncategorized"]
        cats.forEach((cat) => {
          const existing = map.get(cat) || { revenue: 0, qty: 0 }
          existing.revenue += item.price * item.quantity
          existing.qty += item.quantity
          map.set(cat, existing)
        })
      })
    })
    return Array.from(map.entries())
      .map(([category, value]) => ({ category, revenue: Number(value.revenue.toFixed(2)), qty: value.qty }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [soldOrders, productCategoryMap])

  const stats = [
    { label: "gross sales in this period", value: formatMoney(grossSales), accent: "border-r-[#5da7dd]" },
    { label: "net sales in this period", value: formatMoney(netSales), accent: "border-r-[#2b95d6]" },
    { label: "orders placed", value: ordersPlaced.toLocaleString(), accent: "border-r-[#d2d8df]" },
    { label: "items purchased", value: itemsPurchased.toLocaleString(), accent: "border-r-[#d2d8df]" },
    { label: `refunded ${refundedOrders.length} orders`, value: formatMoney(refundedAmount), accent: "border-r-[#ee5f5b]" },
  ]

  const exportCsv = () => {
    const lines = ["Order Number,Date,Status,Total,Items Purchased"]
    filteredOrders.forEach((order) => {
      lines.push([order.orderNumber, new Date(order.createdAt).toLocaleDateString("en-US"), order.status, order.total.toFixed(2), order.itemsPurchased].join(","))
    })
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `order-report-${formatDateInput(from)}-${formatDateInput(to)}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  const applyCustomRange = () => {
    setAppliedCustomFrom(customFrom)
    setAppliedCustomTo(customTo)
    setRange("custom")
  }

  const setView = (view: ReportView) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("view", view)
    router.replace(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>

      <div className="inline-flex overflow-hidden rounded-sm border border-[#c3c4c7] bg-[#f0f0f1]">
        <button type="button" className="border-r border-[#c3c4c7] bg-white px-4 py-2 text-sm font-semibold text-slate-900">Orders</button>
        <Link href="/dashboard/orders/customers" className="border-r border-[#c3c4c7] px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800">Customers</Link>
        <Link href="/dashboard/products" className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800">Stock</Link>
      </div>

      <div className="border-b border-[#dcdcde] pb-3">
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          {[
            { key: "sales_by_date", label: "Sales by date" },
            { key: "sales_by_product", label: "Sales by product" },
            { key: "sales_by_category", label: "Sales by category" },
            { key: "coupons_by_date", label: "Coupons by date" },
            { key: "customer_downloads", label: "Customer downloads" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setView(tab.key as ReportView)}
              className={currentView === tab.key ? "font-semibold text-slate-900" : "text-[#2271b1] hover:text-[#135e96]"}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-sm border border-[#dcdcde] bg-white">
        <div className="flex flex-wrap items-center justify-between border-b border-[#dcdcde] bg-[#f6f7f7] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setRange("year")} className={`rounded-sm border px-3 py-1.5 text-xs font-semibold ${range === "year" ? "border-[#c3c4c7] bg-white text-slate-900" : "border-transparent text-[#2271b1]"}`}>Year</button>
            <button type="button" onClick={() => setRange("lastMonth")} className={`rounded-sm border px-3 py-1.5 text-xs font-semibold ${range === "lastMonth" ? "border-[#c3c4c7] bg-white text-slate-900" : "border-transparent text-[#2271b1]"}`}>Last month</button>
            <button type="button" onClick={() => setRange("thisMonth")} className={`rounded-sm border px-3 py-1.5 text-xs font-semibold ${range === "thisMonth" ? "border-[#c3c4c7] bg-white text-slate-900" : "border-transparent text-[#2271b1]"}`}>This month</button>
            <button type="button" onClick={() => setRange("last7")} className={`rounded-sm border px-3 py-1.5 text-xs font-semibold ${range === "last7" ? "border-[#c3c4c7] bg-white text-slate-900" : "border-transparent text-[#2271b1]"}`}>Last 7 days</button>
            <span className="ml-2 text-xs font-semibold text-slate-700">Custom:</span>
            <input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} className="h-8 rounded-sm border border-[#c3c4c7] px-2 text-xs" />
            <span className="text-xs text-slate-500">-</span>
            <input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} className="h-8 rounded-sm border border-[#c3c4c7] px-2 text-xs" />
            <button type="button" onClick={applyCustomRange} className="ml-1 h-8 rounded-sm border border-[#dba617] bg-white px-3 text-xs font-semibold text-[#c47a00]">Go</button>
          </div>
          <button type="button" onClick={exportCsv} className="inline-flex items-center gap-2 text-xs font-semibold text-[#2271b1]">
            <span aria-hidden>↓</span>
            Export CSV
          </button>
        </div>

        {currentView === "sales_by_date" ? (
          <div className="grid gap-0 md:grid-cols-[220px_minmax(0,1fr)]">
            <div className="border-r border-[#dcdcde]">
              {stats.map((stat) => (
                <div key={stat.label} className={`border-b border-[#dcdcde] border-r-4 px-3 py-2.5 ${stat.accent}`}>
                  <div className="text-2xl font-semibold leading-tight text-slate-700">{stat.value}</div>
                  <div className="text-xs text-slate-500">{stat.label}</div>
                </div>
              ))}
            </div>
            <div className="p-3">
              <div className="h-[360px] rounded-sm border border-[#dcdcde] bg-white p-2">
                {chartsReady ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={salesByDate} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                      <CartesianGrid vertical={false} stroke="#edf0f4" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#8b95a7", fontSize: 11 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: "#8b95a7", fontSize: 11 }} />
                      <Tooltip formatter={(value) => [formatMoney(Number(value ?? 0)), "Sales"]} />
                      <Line
                        type="monotone"
                        dataKey="sales"
                        stroke="#2b8fce"
                        strokeWidth={2.5}
                        dot={{ r: 4, stroke: "#e55a54", strokeWidth: 2, fill: "#ffffff" }}
                        activeDot={{ r: 5, stroke: "#e55a54", strokeWidth: 2, fill: "#ffffff" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full w-full animate-pulse rounded-sm bg-slate-100" />
                )}
              </div>
            </div>
          </div>
        ) : null}

        {currentView === "sales_by_product" ? (
          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="rounded-sm border border-[#dcdcde]">
              <div className="grid grid-cols-12 border-b border-[#dcdcde] bg-[#f6f7f7] px-3 py-2 text-xs font-semibold text-slate-600">
                <div className="col-span-5">Product</div>
                <div className="col-span-3 text-right">Revenue</div>
                <div className="col-span-2 text-right">Qty</div>
                <div className="col-span-2 text-right">Orders</div>
              </div>
              <div className="divide-y divide-[#edf0f4]">
                {productRows.length === 0 ? (
                  <div className="px-3 py-6 text-xs text-slate-500">No product sales in selected range.</div>
                ) : (
                  productRows.slice(0, 12).map((row) => (
                    <div key={row.title} className="grid grid-cols-12 px-3 py-2 text-xs">
                      <div className="col-span-5 truncate text-slate-800">{row.title}</div>
                      <div className="col-span-3 text-right font-semibold text-slate-900">{formatMoney(row.revenue)}</div>
                      <div className="col-span-2 text-right text-slate-700">{row.qty}</div>
                      <div className="col-span-2 text-right text-slate-700">{row.orders}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-sm border border-[#dcdcde] p-2">
              <div className="h-[320px]">
                {chartsReady ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={productRows.slice(0, 8)}>
                      <CartesianGrid vertical={false} stroke="#edf0f4" />
                      <XAxis dataKey="title" tick={{ fontSize: 10 }} tickFormatter={(v) => String(v).slice(0, 10)} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(value) => [formatMoney(Number(value ?? 0)), "Revenue"]} />
                      <Bar dataKey="revenue" fill="#2b8fce" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full w-full animate-pulse rounded-sm bg-slate-100" />
                )}
              </div>
            </div>
          </div>
        ) : null}

        {currentView === "sales_by_category" ? (
          <div className="rounded-sm border-0 p-4">
            <div className="rounded-sm border border-[#dcdcde]">
              <div className="grid grid-cols-12 border-b border-[#dcdcde] bg-[#f6f7f7] px-3 py-2 text-xs font-semibold text-slate-600">
                <div className="col-span-6">Category</div>
                <div className="col-span-3 text-right">Revenue</div>
                <div className="col-span-3 text-right">Qty</div>
              </div>
              <div className="divide-y divide-[#edf0f4]">
                {categoryRows.length === 0 ? (
                  <div className="px-3 py-6 text-xs text-slate-500">No category sales in selected range.</div>
                ) : (
                  categoryRows.map((row) => (
                    <div key={row.category} className="grid grid-cols-12 px-3 py-2 text-xs">
                      <div className="col-span-6 text-slate-800">{row.category}</div>
                      <div className="col-span-3 text-right font-semibold text-slate-900">{formatMoney(row.revenue)}</div>
                      <div className="col-span-3 text-right text-slate-700">{row.qty}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}

        {currentView === "coupons_by_date" ? (
          <div className="p-4">
            <EmptyView text="Coupons report is active. There is no coupon discount data recorded for the selected range yet." />
          </div>
        ) : null}

        {currentView === "customer_downloads" ? (
          <div className="p-4">
            <EmptyView text="Customer downloads report is active. No downloadable product events were found in this period." />
          </div>
        ) : null}
      </div>
    </div>
  )
}
