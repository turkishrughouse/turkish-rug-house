import {
  buildTrendSeries,
  formatAnalyticsCurrency,
  formatAnalyticsDateTime,
  formatAnalyticsNumber,
  getAnalyticsSnapshot,
  isPaidOrder,
  resolveAnalyticsRangeKey,
} from "@/lib/admin-analytics"
import {
  AnalyticsBarList,
  AnalyticsEmptyState,
  AnalyticsPage,
  AnalyticsSection,
  AnalyticsStatCard,
  AnalyticsStatGrid,
  AnalyticsTable,
} from "@/components/admin/analytics/analytics-ui"
import type { AnalyticsPageProps } from "@/app/(admin)/dashboard/analytics/_lib/page-props"

export const dynamic = "force-dynamic"

export default async function AnalyticsOrdersPage({ searchParams }: AnalyticsPageProps) {
  const params = (await searchParams) ?? {}
  const rangeKey = resolveAnalyticsRangeKey(params?.range)
  const snapshot = await getAnalyticsSnapshot(rangeKey)
  const currency = snapshot.orders[0]?.details.currency || "USD"
  const orderTrend = buildTrendSeries(snapshot.range, snapshot.ordersInRange, () => 1)

  const statusMap = new Map<string, number>()
  const shipmentMap = new Map<string, number>()
  snapshot.ordersInRange.forEach((order) => {
    statusMap.set(order.status, (statusMap.get(order.status) || 0) + 1)
    shipmentMap.set(order.shipmentStatus, (shipmentMap.get(order.shipmentStatus) || 0) + 1)
  })
  const statusRows = Array.from(statusMap.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  const shipmentRows = Array.from(shipmentMap.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)

  const paidCount = snapshot.ordersInRange.filter((order) => isPaidOrder(order)).length
  const shippedCount = snapshot.ordersInRange.filter((order) => ["SHIPPED", "IN_TRANSIT", "DELIVERED"].includes(order.shipmentStatus)).length
  const cancelledCount = snapshot.ordersInRange.filter((order) => order.status === "CANCELLED").length
  const refundedCount = snapshot.ordersInRange.filter((order) => order.status === "REFUNDED" || order.details.refundedAmount > 0).length

  return (
    <AnalyticsPage
      title="Order Analytics"
      description="Operational order intelligence across intake, payment, fulfillment, and shipping progress."
      range={rangeKey}
    >
      <AnalyticsStatGrid>
        <AnalyticsStatCard label="Orders created" value={formatAnalyticsNumber(snapshot.ordersInRange.length)} helper={`${snapshot.range.label} live order volume`} />
        <AnalyticsStatCard label="Paid orders" value={formatAnalyticsNumber(paidCount)} helper="Orders marked paid by payment status or workflow" />
        <AnalyticsStatCard label="Shipped orders" value={formatAnalyticsNumber(shippedCount)} helper="Orders with active shipment progress" />
        <AnalyticsStatCard label="Cancelled / refunded" value={formatAnalyticsNumber(cancelledCount + refundedCount)} helper="Post-order exception workload" />
      </AnalyticsStatGrid>

      <div className="grid gap-4 xl:grid-cols-3">
        <AnalyticsSection title="Order trend" summary={`New orders over ${snapshot.range.label}.`}>
          {orderTrend.some((point) => point.value > 0) ? (
            <AnalyticsBarList rows={orderTrend.map((point) => ({ label: point.label, value: point.value }))} />
          ) : (
            <AnalyticsEmptyState title="No orders in this range" description="Order volume will appear here once live orders are created in the selected period." />
          )}
        </AnalyticsSection>
        <AnalyticsSection title="Status distribution" summary="Real current order workflow states.">
          {statusRows.length > 0 ? <AnalyticsBarList rows={statusRows} /> : <AnalyticsEmptyState title="No status data yet" description="Status distribution becomes available when orders exist." />}
        </AnalyticsSection>
        <AnalyticsSection title="Fulfillment progress" summary="Shipment lifecycle pulled from live order shipment statuses.">
          {shipmentRows.length > 0 ? <AnalyticsBarList rows={shipmentRows} /> : <AnalyticsEmptyState title="No shipment activity yet" description="Shipment progress appears after orders start moving through fulfillment." />}
        </AnalyticsSection>
      </div>

      <AnalyticsSection title="Recent order performance" summary="The latest live orders with customer, payment, and shipping context.">
        {snapshot.orders.length > 0 ? (
          <AnalyticsTable
            columns={["Order", "Customer", "Status", "Shipment", "Total", "Created"]}
            rows={snapshot.orders.slice(0, 10).map((order) => [
              order.orderNumber,
              order.customerName || order.customerEmail,
              order.status,
              order.shipmentStatus,
              formatAnalyticsCurrency(order.total, order.details.currency || currency),
              formatAnalyticsDateTime(order.createdAt),
            ])}
          />
        ) : (
          <AnalyticsEmptyState title="No orders yet" description="This page is ready; real order performance will appear automatically once the store starts receiving orders." />
        )}
      </AnalyticsSection>
    </AnalyticsPage>
  )
}
