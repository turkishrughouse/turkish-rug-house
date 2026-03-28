"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { BarChart3, Boxes, DollarSign, PackageOpen, type LucideIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { DashboardPeriodKey, RoleDashboardData } from "@/lib/admin-role-dashboard"

type AdminDashboardProps = {
  data: RoleDashboardData
  lang: "en" | "tr"
}

const PERIOD_OPTIONS: Array<{ key: DashboardPeriodKey; label: { en: string; tr: string } }> = [
  { key: "week", label: { en: "Weekly", tr: "Haftalık" } },
  { key: "month", label: { en: "Monthly", tr: "Aylık" } },
  { key: "year", label: { en: "Yearly", tr: "Yıllık" } },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

function formatDate(value: string, lang: "en" | "tr") {
  return new Date(value).toLocaleDateString(lang === "tr" ? "tr-TR" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function MetricCard(props: {
  title: string
  value: string
  subtitle: string
  icon: LucideIcon
  onClick?: () => void
}) {
  const { title, value, subtitle, icon: Icon, onClick } = props
  const content = (
    <Card className="h-full rounded-3xl border border-[#dce3ed] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.06)] transition-transform duration-200 group-hover:-translate-y-0.5">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</p>
          <CardTitle className="text-3xl font-semibold tracking-tight text-slate-950">{value}</CardTitle>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
          <Icon className="h-5 w-5" />
        </div>
      </CardHeader>
      <CardContent className="pt-0 text-sm text-slate-600">{subtitle}</CardContent>
    </Card>
  )

  if (!onClick) {
    return <div className="group w-full rounded-3xl text-left">{content}</div>
  }

  return (
    <button type="button" onClick={onClick} className="group w-full rounded-3xl text-left">
      {content}
    </button>
  )
}

export function RoleBasedDashboard({ data, lang }: AdminDashboardProps) {
  const [period, setPeriod] = useState<DashboardPeriodKey>("month")
  const [detailMode, setDetailMode] = useState<"products" | "sales" | null>(null)
  const isTr = lang === "tr"
  const active = data.periods[period]
  const title = data.scope === "system"
    ? (isTr ? "Superuser Dashboard" : "Superuser Dashboard")
    : (isTr ? "Ürün Performansım" : "My Product Performance")
  const description = data.scope === "system"
    ? (isTr
      ? "Tüm sistemde eklenen ürünleri, satış miktarını ve geliri tek ekranda takip edin."
      : "Track total products, units sold, and revenue across the whole system.")
    : (isTr
      ? "Sadece sizin eklediğiniz ürünlerin performansını görün."
      : "See performance only for the products you created.")

  const topSalesRows = useMemo(() => active.salesByProduct.slice(0, 5), [active.salesByProduct])
  const creatorRows = useMemo(() => active.creatorBreakdown.slice(0, 6), [active.creatorBreakdown])

  return (
    <>
      <div className="flex-1 bg-[#f6f8fb]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8">
          <section className="rounded-[32px] border border-[#dce3ed] bg-white px-8 py-8 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  {data.scope === "system"
                    ? (isTr ? "Tüm Sistem Görünümü" : "System Scope")
                    : (isTr ? "Kişisel Ürün Alanı" : "Personal Scope")}
                </p>
                <h1 className="text-4xl font-semibold tracking-tight text-slate-950">{title}</h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
                <p className="text-sm font-medium text-slate-500">
                  {data.scope === "system"
                    ? (isTr ? `Giriş yapan kullanıcı: ${data.actorLabel}` : `Signed in as: ${data.actorLabel}`)
                    : (isTr ? `Performans sahibi: ${data.actorLabel}` : `Performance owner: ${data.actorLabel}`)}
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <div className="inline-flex rounded-2xl border border-[#dce3ed] bg-slate-50 p-1">
                  {PERIOD_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setPeriod(option.key)}
                      className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                        period === option.key
                          ? "bg-white text-slate-950 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {isTr ? option.label.tr : option.label.en}
                    </button>
                  ))}
                </div>
                <div className="text-right text-sm text-slate-500">{active.rangeLabel}</div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-5 min-[420px]:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              title={isTr ? "Products" : "Products"}
              value={formatNumber(active.productCount)}
              subtitle={
                data.scope === "system"
                  ? (isTr ? "Seçilen dönemde sistemde eklenen ürün sayısı." : "Products added system-wide in the selected period.")
                  : (isTr ? "Seçilen dönemde sizin eklediğiniz ürün sayısı." : "Products you added in the selected period.")
              }
              icon={PackageOpen}
              onClick={() => setDetailMode("products")}
            />
            <MetricCard
              title={isTr ? "Sales Quantity" : "Sales Quantity"}
              value={formatNumber(active.unitsSold)}
              subtitle={
                data.scope === "system"
                  ? (isTr ? "Geçerli siparişlerden satılan toplam adet." : "Total units sold from valid orders.")
                  : (isTr ? "Sadece sizin ürünlerinizden satılan toplam adet." : "Units sold only from your products.")
              }
              icon={Boxes}
              onClick={() => setDetailMode("sales")}
            />
            <MetricCard
              title={isTr ? "Sales Revenue" : "Sales Revenue"}
              value={formatCurrency(active.revenue)}
              subtitle={
                data.scope === "system"
                  ? (isTr ? "Seçilen dönemde sistem genelindeki toplam ciro." : "Total revenue across the system in the selected period.")
                  : (isTr ? "Sadece sizin ürünlerinizden gelen toplam ciro." : "Revenue generated only by your products.")
              }
              icon={DollarSign}
              onClick={() => setDetailMode("sales")}
            />
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.25fr_0.95fr]">
            <Card className="rounded-[28px] border border-[#dce3ed] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-semibold text-slate-950">
                    {isTr ? "Satış Detayı" : "Sales Detail"}
                  </CardTitle>
                  <p className="mt-1 text-sm text-slate-500">
                    {data.scope === "system"
                      ? (isTr ? "Ürün bazında satış miktarı ve gelir." : "Units sold and revenue by product.")
                      : (isTr ? "Sizin ürünlerinizden gelen satış özeti." : "Sales summary from your products.")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailMode("sales")}
                  className="rounded-full border border-[#dce3ed] px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
                >
                  {isTr ? "Detayı Aç" : "Open detail"}
                </button>
              </CardHeader>
              <CardContent className="space-y-4">
                {topSalesRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#dce3ed] bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
                    {isTr ? "Bu dönem için satış verisi yok." : "No sales data for this period."}
                  </div>
                ) : (
                  topSalesRows.map((row) => (
                    <div key={row.productId} className="flex items-center justify-between rounded-2xl border border-[#edf2f7] px-4 py-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950">{row.title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {row.sku || row.slug}
                          {row.lastSoldAt ? ` • ${formatDate(row.lastSoldAt, lang)}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-950">{formatNumber(row.unitsSold)}</p>
                        <p className="mt-1 text-xs text-emerald-700">{formatCurrency(row.revenue)}</p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border border-[#dce3ed] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl font-semibold text-slate-950">
                  <BarChart3 className="h-5 w-5 text-slate-600" />
                  {data.scope === "system"
                    ? (isTr ? "Admin Breakdown" : "Admin Breakdown")
                    : (isTr ? "Genel Özet" : "Overview")}
                </CardTitle>
                <p className="mt-1 text-sm text-slate-500">
                  {data.scope === "system"
                    ? (isTr ? "Admin bazında ürün ve satış görünümü." : "Creator-level product and sales performance.")
                    : (isTr ? "Katalog büyüklüğünüz ve aksiyonlar." : "Your catalog size and quick actions.")}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.scope === "system" ? (
                  creatorRows.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#dce3ed] bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
                      {isTr ? "Gösterilecek admin verisi yok." : "No creator data to show."}
                    </div>
                  ) : (
                    creatorRows.map((row) => (
                      <div key={row.creatorKey} className="rounded-2xl border border-[#edf2f7] px-4 py-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-950">{row.creatorLabel}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {isTr ? `${formatNumber(row.productCount)} ürün` : `${formatNumber(row.productCount)} products`}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-slate-950">{formatNumber(row.unitsSold)}</p>
                            <p className="mt-1 text-xs text-emerald-700">{formatCurrency(row.revenue)}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )
                ) : (
                  <>
                    <div className="rounded-2xl border border-[#edf2f7] bg-slate-50 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        {isTr ? "Toplam Katalog" : "Catalog Size"}
                      </p>
                      <p className="mt-2 text-3xl font-semibold text-slate-950">{formatNumber(data.totalCatalogProducts)}</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Link
                        href="/dashboard/products"
                        className="rounded-full bg-[#2F6F63] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#255A51]"
                      >
                        {isTr ? "Ürünleri Yönet" : "Manage products"}
                      </Link>
                      <Link
                        href="/dashboard/products/new"
                        className="rounded-full border border-[#DDE5E3] bg-[#F6F8F7] px-4 py-2 text-sm font-medium text-[#2F6F63] transition-colors hover:bg-[#EEF3F1]"
                      >
                        {isTr ? "Yeni Ürün Ekle" : "Add product"}
                      </Link>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </div>

      <Dialog open={detailMode === "sales"} onOpenChange={(open) => !open && setDetailMode(null)}>
        <DialogContent className="max-h-[88vh] max-w-5xl overflow-hidden border-[#dce3ed] bg-white p-0">
          <DialogHeader className="border-b border-[#dce3ed] px-6 py-5">
            <DialogTitle className="text-xl font-semibold text-slate-950">
              {data.scope === "system"
                ? (isTr ? "Sistem Satış Detayı" : "System Sales Detail")
                : (isTr ? "Kendi Ürün Satış Detayı" : "Own Product Sales Detail")}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-auto px-6 py-5">
            <div className="mb-4 text-sm text-slate-500">{active.rangeLabel}</div>
            {active.salesByProduct.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#dce3ed] bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
                {isTr ? "Bu dönem için satış detayı bulunmuyor." : "No sales detail for this period."}
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[#dce3ed]">
                <table className="min-w-full divide-y divide-[#dce3ed] text-sm">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">{isTr ? "Ürün" : "Product"}</th>
                      <th className="px-4 py-3 font-medium">{isTr ? "Slug / SKU" : "Slug / SKU"}</th>
                      <th className="px-4 py-3 text-right font-medium">{isTr ? "Adet" : "Units"}</th>
                      <th className="px-4 py-3 text-right font-medium">{isTr ? "Gelir" : "Revenue"}</th>
                      <th className="px-4 py-3 text-right font-medium">{isTr ? "Son Satış" : "Last Sale"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf2f7] bg-white">
                    {active.salesByProduct.map((row) => (
                      <tr key={row.productId}>
                        <td className="px-4 py-3 font-medium text-slate-900">{row.title}</td>
                        <td className="px-4 py-3 text-slate-600">{row.sku || row.slug}</td>
                        <td className="px-4 py-3 text-right text-slate-900">{formatNumber(row.unitsSold)}</td>
                        <td className="px-4 py-3 text-right text-slate-900">{formatCurrency(row.revenue)}</td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {row.lastSoldAt ? formatDate(row.lastSoldAt, lang) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={detailMode === "products"} onOpenChange={(open) => !open && setDetailMode(null)}>
        <DialogContent className="max-h-[88vh] max-w-4xl overflow-hidden border-[#dce3ed] bg-white p-0">
          <DialogHeader className="border-b border-[#dce3ed] px-6 py-5">
            <DialogTitle className="text-xl font-semibold text-slate-950">
              {data.scope === "system"
                ? (isTr ? "Eklenen Ürünler" : "Products Added")
                : (isTr ? "Eklediğim Ürünler" : "Products I Added")}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-auto px-6 py-5">
            <div className="mb-4 text-sm text-slate-500">{active.rangeLabel}</div>
            {active.createdProducts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#dce3ed] bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
                {isTr ? "Bu dönem için ürün kaydı bulunmuyor." : "No product entries for this period."}
              </div>
            ) : (
              <div className="space-y-3">
                {active.createdProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between rounded-2xl border border-[#edf2f7] px-4 py-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{product.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{product.sku || product.slug}</p>
                    </div>
                    <div className="text-sm text-slate-600">{formatDate(product.createdAt, lang)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
