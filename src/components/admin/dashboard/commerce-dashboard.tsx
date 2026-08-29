import type { ReactNode } from "react"
import Link from "next/link"
import {
    Boxes,
    DollarSign,
    Radio,
    ShoppingBag,
    ShoppingCart,
    Timer,
    TrendingUp,
    Users,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { StorefrontProductImage } from "@/components/storefront/storefront-product-image"
import { DashboardMetricCard } from "@/components/admin/dashboard/dashboard-metric-card"
import { RevenueChart } from "@/components/admin/dashboard/revenue-chart"
import { formatAnalyticsCurrency, formatAnalyticsNumber } from "@/lib/admin-analytics"
import {
    DASHBOARD_RANGE_KEYS,
    formatRangeBounds,
    type DashboardRangeKey,
    type DashboardSnapshot,
} from "@/lib/admin/dashboard-metrics"
import { cn } from "@/lib/utils"

const RANGE_LABELS: Record<DashboardRangeKey, string> = {
    "7d": "7 days",
    "30d": "30 days",
    "12m": "12 months",
}

const CARD = "rounded-xl border border-[#dce3ed] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
const SECTION_LABEL = "text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"

function SectionCard({
    title,
    meta,
    action,
    children,
    className,
}: {
    title: string
    meta?: string
    action?: ReactNode
    children: ReactNode
    className?: string
}) {
    return (
        <section className={cn(CARD, "flex flex-col p-5", className)}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className={SECTION_LABEL}>{title}</h2>
                {action}
            </div>
            {meta ? <p className="mt-1 text-[11px] text-slate-500">{meta}</p> : null}
            <div className="mt-4">{children}</div>
        </section>
    )
}

function EmptyState({ children }: { children: ReactNode }) {
    return (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-[#dce3ed] bg-slate-50 px-4 py-8 text-center text-xs text-slate-500">
            {children}
        </div>
    )
}

function statusBadgeVariant(status: string) {
    if (status === "PAID" || status === "DELIVERED" || status === "COMPLETED") return "success" as const
    if (status === "CANCELLED" || status === "REFUNDED" || status === "TRASHED") return "destructive" as const
    return "secondary" as const
}

function RangeSelector({ active }: { active: DashboardRangeKey }) {
    // Plain links, so the range lives in the URL and refresh / back / forward all
    // behave the way the rest of the admin does. No client JavaScript needed.
    return (
        <nav aria-label="Dashboard date range" className="inline-flex rounded-lg border border-[#dce3ed] bg-white p-0.5">
            {DASHBOARD_RANGE_KEYS.map((key) => {
                const isActive = key === active
                return (
                    <Link
                        key={key}
                        href={`/dashboard?range=${key}`}
                        scroll={false}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
                            isActive
                                ? "bg-slate-900 text-white"
                                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        )}
                    >
                        {RANGE_LABELS[key]}
                    </Link>
                )
            })}
        </nav>
    )
}

/**
 * Turkish Rug House commerce overview.
 *
 * Everything on this screen is derived from real order, product and live-visitor
 * records; there are no sample values and no placeholder targets. Where a number
 * cannot be trusted for the selected range - abandoned checkouts and live
 * visitors are only ever a right-now signal - the card says so on its face
 * rather than implying the range applies.
 */
export function CommerceDashboard({ snapshot }: { snapshot: DashboardSnapshot }) {
    const { range, revenue, orders, customers, inventory, abandoned, liveVisitors } = snapshot
    const hasRevenue = snapshot.trend.some((point) => point.value > 0)

    return (
        <div className="mx-auto w-full max-w-7xl space-y-6 p-6 lg:p-8">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        {range.label} · {formatRangeBounds(range)}
                    </p>
                </div>
                <RangeSelector active={range.key} />
            </header>

            {/* KPI row */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                <DashboardMetricCard
                    icon={DollarSign}
                    label="Net Revenue"
                    value={formatAnalyticsCurrency(revenue.net)}
                    helper="Paid orders less refunds"
                    details={[
                        { label: "Gross sales", value: formatAnalyticsCurrency(revenue.gross) },
                        { label: "Refunds", value: formatAnalyticsCurrency(revenue.refunds) },
                        { label: "Net revenue", value: formatAnalyticsCurrency(revenue.net) },
                    ]}
                />
                <DashboardMetricCard
                    icon={ShoppingBag}
                    label="Total Orders"
                    value={formatAnalyticsNumber(orders.total)}
                    helper="Placed in this period"
                    details={[
                        { label: "Paid", value: formatAnalyticsNumber(orders.paid) },
                        { label: "Pending", value: formatAnalyticsNumber(orders.pending) },
                        { label: "Cancelled", value: formatAnalyticsNumber(orders.cancelled) },
                    ]}
                />
                <DashboardMetricCard
                    icon={TrendingUp}
                    label="Avg. Order Value"
                    value={formatAnalyticsCurrency(snapshot.averageOrderValue)}
                    helper="Net revenue per paid order"
                />
                <DashboardMetricCard
                    icon={Users}
                    label="Customers"
                    value={formatAnalyticsNumber(customers.total)}
                    helper="Ordered in this period"
                    details={[
                        { label: "New", value: formatAnalyticsNumber(customers.new) },
                        { label: "Returning", value: formatAnalyticsNumber(customers.returning) },
                    ]}
                />
                <DashboardMetricCard
                    icon={Timer}
                    label="Pending Orders"
                    value={formatAnalyticsNumber(snapshot.openOrders)}
                    helper="Open now, not date filtered"
                />
                <DashboardMetricCard
                    icon={ShoppingCart}
                    label="Abandoned Checkouts"
                    value={formatAnalyticsNumber(abandoned.count)}
                    helper="Live signal, not date filtered"
                />
            </div>

            {/* Revenue + top products */}
            <div className="grid items-start gap-4 lg:grid-cols-12">
                <SectionCard
                    title="Revenue over time"
                    meta={`Net revenue by ${range.granularity === "month" ? "month" : "day"} · ${range.label}`}
                    className="lg:col-span-8"
                >
                    {hasRevenue ? (
                        <RevenueChart points={snapshot.trend} />
                    ) : (
                        <div className="flex h-[260px] flex-col items-center justify-center rounded-lg border border-dashed border-[#dce3ed] bg-slate-50 px-6 text-center">
                            <p className="text-sm font-medium text-slate-600">No revenue recorded in this period</p>
                            <p className="mt-1 text-xs text-slate-500">
                                {snapshot.trend.length} {range.granularity === "month" ? "months" : "days"} charted, all at
                                {" "}
                                {formatAnalyticsCurrency(0)}.
                            </p>
                        </div>
                    )}
                </SectionCard>

                <SectionCard
                    title="Top products"
                    meta={`By net sales · ${range.label}`}
                    className="lg:col-span-4"
                >
                    {snapshot.topProducts.length === 0 ? (
                        <EmptyState>No product sales in this period.</EmptyState>
                    ) : (
                        <ul className="space-y-1">
                            {snapshot.topProducts.map((product) => (
                                <li key={product.id}>
                                    <Link
                                        href={`/dashboard/products/${product.id}`}
                                        className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                    >
                                        <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-[#dce3ed] bg-white">
                                            <StorefrontProductImage
                                                candidates={product.imageCandidates}
                                                alt={product.title}
                                                fill
                                                sizes="40px"
                                                className="object-center"
                                            />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-xs font-medium text-slate-900">
                                                {product.title}
                                            </span>
                                            <span className="block text-[11px] text-slate-500">
                                                {formatAnalyticsNumber(product.units)} sold
                                            </span>
                                        </span>
                                        <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-900">
                                            {formatAnalyticsCurrency(product.revenue)}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </SectionCard>
            </div>

            {/* Recent orders + abandoned checkouts */}
            <div className="grid items-start gap-4 lg:grid-cols-12">
                <SectionCard
                    title="Recent orders"
                    meta="Five most recent, across all time"
                    action={
                        <Link
                            href="/dashboard/orders"
                            className="rounded-sm text-[11px] font-medium text-slate-600 underline-offset-4 hover:text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                            View all
                        </Link>
                    }
                    className="lg:col-span-7"
                >
                    {snapshot.recentOrders.length === 0 ? (
                        <EmptyState>No orders yet.</EmptyState>
                    ) : (
                        <div className="-mx-1 overflow-x-auto">
                            <table className="w-full min-w-[420px] border-collapse text-left">
                                <thead>
                                    <tr className="text-[10px] uppercase tracking-wide text-slate-400">
                                        <th className="px-1 pb-2 font-medium">Order</th>
                                        <th className="px-1 pb-2 font-medium">Customer</th>
                                        <th className="px-1 pb-2 text-right font-medium">Amount</th>
                                        <th className="px-1 pb-2 font-medium">Status</th>
                                        <th className="px-1 pb-2 text-right font-medium">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#eef2f7]">
                                    {snapshot.recentOrders.map((order) => (
                                        <tr key={order.id} className="text-xs">
                                            <td className="px-1 py-2">
                                                <Link
                                                    href={`/dashboard/orders/${order.id}`}
                                                    className="rounded-sm font-medium text-slate-900 underline-offset-4 hover:text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                                >
                                                    {order.orderNumber}
                                                </Link>
                                            </td>
                                            <td className="max-w-[160px] truncate px-1 py-2 text-slate-600">
                                                {order.customer}
                                            </td>
                                            <td className="px-1 py-2 text-right tabular-nums text-slate-900">
                                                {formatAnalyticsCurrency(order.total)}
                                            </td>
                                            <td className="px-1 py-2">
                                                <Badge variant={statusBadgeVariant(order.status)} className="text-[10px]">
                                                    {order.status}
                                                </Badge>
                                            </td>
                                            <td className="whitespace-nowrap px-1 py-2 text-right text-slate-500">
                                                {order.createdAt.toLocaleDateString("en-US", {
                                                    month: "short",
                                                    day: "numeric",
                                                })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </SectionCard>

                <SectionCard
                    title="Abandoned checkouts"
                    meta={abandoned.windowLabel}
                    className="lg:col-span-5"
                >
                    {abandoned.items.length === 0 ? (
                        <EmptyState>No confirmed abandoned checkouts right now.</EmptyState>
                    ) : (
                        <ul className="divide-y divide-[#eef2f7]">
                            {abandoned.items.map((item) => (
                                <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                                    <div className="min-w-0">
                                        <p className="truncate text-xs font-medium text-slate-900">{item.customerName}</p>
                                        <p className="text-[11px] text-slate-500">{item.isGuest ? "Guest" : "Customer"}</p>
                                    </div>
                                    <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
                                        {item.minutesSince}m ago
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </SectionCard>
            </div>

            {/* Inventory + live traffic */}
            <div className="grid items-start gap-4 lg:grid-cols-12">
                <SectionCard
                    title="Inventory"
                    meta={`${formatAnalyticsNumber(inventory.total)} products in the catalogue`}
                    action={
                        <Link
                            href="/dashboard/products"
                            className="rounded-sm text-[11px] font-medium text-slate-600 underline-offset-4 hover:text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                            Manage
                        </Link>
                    }
                    className="lg:col-span-7"
                >
                    <dl className="grid grid-cols-3 gap-3">
                        {[
                            { label: "Published", value: inventory.published, icon: Boxes },
                            { label: "Draft", value: inventory.draft, icon: Boxes },
                            { label: "Out of stock", value: inventory.outOfStock, icon: Boxes },
                        ].map((item) => (
                            <div key={item.label} className="rounded-lg bg-slate-50 px-3 py-3">
                                <dt className="text-[11px] font-medium text-slate-500">{item.label}</dt>
                                <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                                    {formatAnalyticsNumber(item.value)}
                                </dd>
                            </div>
                        ))}
                    </dl>
                    <p className="mt-3 text-[11px] leading-4 text-slate-500">
                        Every rug is a single piece, so stock is 1 by design — a low-stock threshold would flag the whole
                        catalogue and is deliberately not shown.
                    </p>
                </SectionCard>

                <SectionCard
                    title="Live visitors"
                    meta="Currently browsing · real-time only, cleared on restart"
                    className="lg:col-span-5"
                >
                    <div className="flex items-baseline gap-2">
                        <Radio className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                        <span className="text-2xl font-semibold tabular-nums text-slate-900">
                            {formatAnalyticsNumber(liveVisitors.count)}
                        </span>
                        <span className="text-[11px] text-slate-500">on the site now</span>
                    </div>
                    {liveVisitors.topCountries.length > 0 ? (
                        <ul className="mt-3 space-y-1">
                            {liveVisitors.topCountries.map((country) => (
                                <li key={country.name} className="flex items-center justify-between gap-3 text-[11px]">
                                    <span className="truncate text-slate-600">{country.name}</span>
                                    <span className="shrink-0 font-semibold tabular-nums text-slate-800">
                                        {country.count}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="mt-3 text-[11px] text-slate-500">No visitors tracked in the last hour.</p>
                    )}
                </SectionCard>
            </div>
        </div>
    )
}
