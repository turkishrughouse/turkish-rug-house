import "server-only"

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import {
    CANCELLED_ORDER_STATUSES,
    PAID_ORDER_STATUSES,
} from "@/lib/admin-analytics"
import { getLiveVisitorEvents } from "@/lib/live-visitor-activity"
import { getCardProductImageCandidates } from "@/lib/product-images"

/**
 * Data layer for the admin dashboard.
 *
 * Every figure here is aggregated in PostgreSQL. The previous dashboard summary
 * endpoint pulled the whole Order, Product and User tables into Node and counted
 * them in JavaScript, which is fine at 0 orders and unusable at 100k. Nothing in
 * this module loads an unbounded row set: each query either aggregates, or is
 * explicitly LIMIT-ed.
 *
 * Revenue semantics are deliberately identical to `@/lib/admin-analytics`, whose
 * status sets are imported rather than restated so the dashboard and the
 * analytics pages can never drift apart.
 */

export const DASHBOARD_RANGE_KEYS = ["7d", "30d", "12m"] as const
export type DashboardRangeKey = (typeof DASHBOARD_RANGE_KEYS)[number]

export type DashboardRange = {
    key: DashboardRangeKey
    label: string
    from: Date
    to: Date
    /** Day buckets for 7d/30d, month buckets for 12m. */
    granularity: "day" | "month"
}

export type DashboardTrendPoint = {
    label: string
    value: number
}

export type DashboardTopProduct = {
    id: string
    title: string
    units: number
    revenue: number
    imageCandidates: string[]
}

export type DashboardRecentOrder = {
    id: string
    orderNumber: string
    customer: string
    total: number
    status: string
    createdAt: Date
}

export type DashboardAbandonedCheckout = {
    id: string
    customerName: string
    isGuest: boolean
    minutesSince: number
}

export type DashboardSnapshot = {
    range: DashboardRange
    revenue: { gross: number; refunds: number; net: number }
    orders: { total: number; paid: number; pending: number; cancelled: number }
    averageOrderValue: number
    customers: { total: number; new: number; returning: number }
    /** Deliberately NOT date filtered - this is an operational "act now" number. */
    openOrders: number
    trend: DashboardTrendPoint[]
    topProducts: DashboardTopProduct[]
    recentOrders: DashboardRecentOrder[]
    inventory: { published: number; draft: number; outOfStock: number; total: number }
    abandoned: {
        supported: boolean
        count: number
        items: DashboardAbandonedCheckout[]
        windowLabel: string
    }
    liveVisitors: { count: number; topCountries: Array<{ name: string; count: number }> }
}

const CANCELLED = Array.from(CANCELLED_ORDER_STATUSES)
const PAID = Array.from(PAID_ORDER_STATUSES)

/**
 * The live-visitor store keeps roughly an hour of in-memory state and is cleared
 * on every process restart, so "abandoned checkout" is a right-now signal. It
 * cannot be recomputed for a past week or month, and the UI says so.
 */
const ABANDONMENT_LOOKBACK_MS = 2 * 60 * 60 * 1000
const ABANDONMENT_THRESHOLD_MS = 30 * 60 * 1000

function startOfDay(value: Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function endOfDay(value: Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999)
}

function toNumber(value: unknown) {
    const num = Number(value)
    return Number.isFinite(num) ? num : 0
}

export function resolveDashboardRangeKey(value: string | undefined | null): DashboardRangeKey {
    const raw = String(value || "").trim().toLowerCase()
    if (raw === "7d") return "7d"
    // `365d` is the key the /dashboard/analytics pages use for the same window;
    // accepting it keeps links between the two sections from silently resetting.
    if (raw === "12m" || raw === "365d" || raw === "12mo") return "12m"
    return "30d"
}

export function getDashboardRange(key: DashboardRangeKey): DashboardRange {
    const today = startOfDay(new Date())
    const to = endOfDay(today)

    if (key === "12m") {
        const from = new Date(today.getFullYear(), today.getMonth() - 11, 1)
        return { key, label: "Last 12 months", from, to, granularity: "month" }
    }

    const days = key === "7d" ? 7 : 30
    const from = new Date(today)
    from.setDate(from.getDate() - (days - 1))
    return {
        key,
        label: key === "7d" ? "Last 7 days" : "Last 30 days",
        from: startOfDay(from),
        to,
        granularity: "day",
    }
}

export function formatRangeBounds(range: DashboardRange) {
    const format = (value: Date) =>
        value.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    return `${format(range.from)} – ${format(range.to)}`
}

/**
 * `Order.detailsJson` is a TEXT column written by JSON.stringify, so casting it
 * to jsonb is safe for every row this application creates. A hand-edited row
 * would make the cast throw and take the whole dashboard down with it, so the
 * headline query falls back to a status-only refund figure instead of 500ing.
 */
const REFUND_EXPR_WITH_JSON = Prisma.sql`
    CASE
      WHEN COALESCE((NULLIF(o."detailsJson", '')::jsonb ->> 'refundedAmount')::numeric, 0) > 0
        THEN COALESCE((NULLIF(o."detailsJson", '')::jsonb ->> 'refundedAmount')::numeric, 0)
      WHEN upper(o."status") = 'REFUNDED' THEN o."total"
      ELSE 0
    END`

const REFUND_EXPR_STATUS_ONLY = Prisma.sql`
    CASE WHEN upper(o."status") = 'REFUNDED' THEN o."total" ELSE 0 END`

const GROSS_EXPR = Prisma.sql`
    CASE WHEN upper(o."status") IN (${Prisma.join(CANCELLED)}) THEN 0 ELSE o."total" END`

type HeadlineRow = {
    orders_total: number
    orders_paid: number
    orders_pending: number
    orders_cancelled: number
    gross_revenue: number
    refunds: number
    net_revenue: number
}

function headlineQuery(from: Date, to: Date, refundExpr: Prisma.Sql) {
    return prisma.$queryRaw<HeadlineRow[]>`
        WITH scoped AS (
          SELECT
            o."status" AS status,
            ${GROSS_EXPR} AS gross,
            ${refundExpr} AS refund
          FROM "Order" o
          WHERE o."createdAt" >= ${from} AND o."createdAt" <= ${to}
        )
        SELECT
          COUNT(*)::int AS orders_total,
          COUNT(*) FILTER (WHERE upper(status) IN (${Prisma.join(PAID)}))::int AS orders_paid,
          COUNT(*) FILTER (WHERE upper(status) = 'PENDING')::int AS orders_pending,
          COUNT(*) FILTER (WHERE upper(status) IN (${Prisma.join(CANCELLED)}))::int AS orders_cancelled,
          COALESCE(SUM(gross), 0)::float8 AS gross_revenue,
          COALESCE(SUM(refund), 0)::float8 AS refunds,
          COALESCE(SUM(GREATEST(gross - refund, 0)), 0)::float8 AS net_revenue
        FROM scoped`
}

async function getHeadline(from: Date, to: Date) {
    try {
        const [row] = await headlineQuery(from, to, REFUND_EXPR_WITH_JSON)
        return { row, refundsIncludePartial: true }
    } catch (error) {
        console.error("[dashboard-metrics] refund JSON parse failed, using status-only refunds", error)
        const [row] = await headlineQuery(from, to, REFUND_EXPR_STATUS_ONLY)
        return { row, refundsIncludePartial: false }
    }
}

function trendQuery(range: DashboardRange) {
    const unit = range.granularity === "month" ? "month" : "day"
    const step = range.granularity === "month" ? Prisma.sql`interval '1 month'` : Prisma.sql`interval '1 day'`

    // generate_series produces every bucket in the window, so a period with no
    // sales renders as an explicit zero instead of a hole in the chart.
    return prisma.$queryRaw<Array<{ bucket: Date; value: number }>>`
        WITH buckets AS (
          SELECT generate_series(
            date_trunc(${unit}, ${range.from}::timestamp),
            date_trunc(${unit}, ${range.to}::timestamp),
            ${step}
          ) AS bucket
        ),
        agg AS (
          SELECT
            date_trunc(${unit}, o."createdAt") AS bucket,
            SUM(GREATEST(${GROSS_EXPR} - ${REFUND_EXPR_STATUS_ONLY}, 0)) AS value
          FROM "Order" o
          WHERE o."createdAt" >= ${range.from} AND o."createdAt" <= ${range.to}
          GROUP BY 1
        )
        SELECT b.bucket AS bucket, COALESCE(a.value, 0)::float8 AS value
        FROM buckets b
        LEFT JOIN agg a ON a.bucket = b.bucket
        ORDER BY b.bucket`
}

export async function getDashboardSnapshot(rangeKey: DashboardRangeKey): Promise<DashboardSnapshot> {
    const range = getDashboardRange(rangeKey)
    const { from, to } = range

    const [
        headline,
        trendRows,
        customerRows,
        openOrderRows,
        topProductRows,
        recentOrderRows,
        inventoryRows,
        liveEvents,
    ] = await Promise.all([
        getHeadline(from, to),

        trendQuery(range),

        // One pass for "how many customers ordered" plus the new/returning split.
        // A customer is new when their earliest non-cancelled order falls inside
        // the window. Guests are keyed on lower-cased email so one person placing
        // two guest orders counts once.
        prisma.$queryRaw<Array<{ total: number; new_customers: number }>>`
            WITH in_range AS (
              SELECT DISTINCT COALESCE(NULLIF(o."userId", ''), lower(o."customerEmail")) AS k
              FROM "Order" o
              WHERE o."createdAt" >= ${from} AND o."createdAt" <= ${to}
                AND upper(o."status") NOT IN (${Prisma.join(CANCELLED)})
            ),
            first_order AS (
              SELECT COALESCE(NULLIF(o."userId", ''), lower(o."customerEmail")) AS k,
                     MIN(o."createdAt") AS first_at
              FROM "Order" o
              WHERE upper(o."status") NOT IN (${Prisma.join(CANCELLED)})
              GROUP BY 1
            )
            SELECT
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE f.first_at >= ${from})::int AS new_customers
            FROM in_range i
            JOIN first_order f ON f.k = i.k`,

        // Operational, not date filtered: anything still owed to a customer.
        prisma.$queryRaw<Array<{ count: number }>>`
            SELECT COUNT(*)::int AS count
            FROM "Order" o
            WHERE upper(o."status") NOT IN (${Prisma.join([...CANCELLED, "REFUNDED"])})
              AND upper(o."shipmentStatus") <> 'DELIVERED'`,

        prisma.$queryRaw<Array<{ productId: string; units: number; revenue: number }>>`
            SELECT
              oi."productId" AS "productId",
              SUM(oi."quantity")::int AS units,
              SUM(oi."quantity" * oi."price")::float8 AS revenue
            FROM "OrderItem" oi
            JOIN "Order" o ON o."id" = oi."orderId"
            WHERE oi."productId" IS NOT NULL
              AND o."createdAt" >= ${from} AND o."createdAt" <= ${to}
              AND upper(o."status") NOT IN (${Prisma.join(CANCELLED)})
            GROUP BY oi."productId"
            ORDER BY revenue DESC, units DESC
            LIMIT 5`,

        prisma.order.findMany({
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
                id: true,
                orderNumber: true,
                customerName: true,
                customerEmail: true,
                total: true,
                status: true,
                createdAt: true,
            },
        }),

        prisma.$queryRaw<Array<{ published: number; draft: number; out_of_stock: number; total: number }>>`
            SELECT
              COUNT(*) FILTER (WHERE "isPublished")::int AS published,
              COUNT(*) FILTER (WHERE NOT "isPublished")::int AS draft,
              COUNT(*) FILTER (WHERE "stockCount" <= 0 OR NOT "isStock")::int AS out_of_stock,
              COUNT(*)::int AS total
            FROM "Product"
            WHERE "deletedAt" IS NULL`,

        getLiveVisitorEvents(ABANDONMENT_LOOKBACK_MS, 200).catch(() => []),
    ])

    const head = headline.row
    const netRevenue = toNumber(head?.net_revenue)
    const paidOrders = toNumber(head?.orders_paid)

    const trend: DashboardTrendPoint[] = trendRows.map((row) => {
        const date = row.bucket instanceof Date ? row.bucket : new Date(row.bucket)
        return {
            label:
                range.granularity === "month"
                    ? date.toLocaleDateString("en-US", { month: "short" })
                    : date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            value: Number(toNumber(row.value).toFixed(2)),
        }
    })

    let topProducts: DashboardTopProduct[] = []
    if (topProductRows.length > 0) {
        const products = await prisma.product.findMany({
            where: { id: { in: topProductRows.map((row) => row.productId) } },
            select: { id: true, title: true, images: true },
        })
        const byId = new Map(products.map((product) => [product.id, product]))
        topProducts = topProductRows
            .map((row) => {
                const product = byId.get(row.productId)
                if (!product) return null
                return {
                    id: product.id,
                    title: product.title,
                    units: toNumber(row.units),
                    revenue: toNumber(row.revenue),
                    // thumb-first: never pull a master render into a 40px cell.
                    imageCandidates: getCardProductImageCandidates(product.images),
                }
            })
            .filter((row): row is DashboardTopProduct => row !== null)
    }

    const now = Date.now()
    const abandonedItems = liveEvents
        .filter((event) => {
            if (!event.action.toLowerCase().startsWith("added to cart")) return false
            if (event.currentPath?.startsWith("/checkout")) return false
            const at = new Date(event.createdAt).getTime()
            if (Number.isNaN(at)) return false
            return now - at >= ABANDONMENT_THRESHOLD_MS
        })
        .slice(0, 5)
        .map((event) => ({
            id: event.id,
            customerName: event.customerName,
            isGuest: event.actorKey.startsWith("guest:"),
            minutesSince: Math.max(0, Math.round((now - new Date(event.createdAt).getTime()) / 60000)),
        }))

    const countryCounts = new Map<string, number>()
    for (const event of liveEvents) {
        const name = event.countryName || "Unknown"
        countryCounts.set(name, (countryCounts.get(name) || 0) + 1)
    }

    const inventory = inventoryRows[0]
    const customerRow = customerRows[0]
    const totalCustomers = toNumber(customerRow?.total)
    const newCustomers = toNumber(customerRow?.new_customers)

    return {
        range,
        revenue: {
            gross: toNumber(head?.gross_revenue),
            refunds: toNumber(head?.refunds),
            net: netRevenue,
        },
        orders: {
            total: toNumber(head?.orders_total),
            paid: paidOrders,
            pending: toNumber(head?.orders_pending),
            cancelled: toNumber(head?.orders_cancelled),
        },
        // Denominator is paid orders, so unpaid carts never deflate the average.
        averageOrderValue: paidOrders > 0 ? netRevenue / paidOrders : 0,
        customers: {
            total: totalCustomers,
            new: newCustomers,
            returning: Math.max(0, totalCustomers - newCustomers),
        },
        openOrders: toNumber(openOrderRows[0]?.count),
        trend,
        topProducts,
        recentOrders: recentOrderRows.map((order) => ({
            id: order.id,
            orderNumber: order.orderNumber,
            customer: order.customerName?.trim() || order.customerEmail,
            total: toNumber(order.total),
            status: String(order.status || "PENDING").toUpperCase(),
            createdAt: order.createdAt,
        })),
        inventory: {
            published: toNumber(inventory?.published),
            draft: toNumber(inventory?.draft),
            outOfStock: toNumber(inventory?.out_of_stock),
            total: toNumber(inventory?.total),
        },
        abandoned: {
            supported: true,
            count: abandonedItems.length,
            items: abandonedItems,
            windowLabel: "Live signal · last 2 hours, not date filtered",
        },
        liveVisitors: {
            count: liveEvents.length,
            topCountries: Array.from(countryCounts.entries())
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
                .slice(0, 4),
        },
    }
}
