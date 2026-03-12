import {
  buildTrendSeries,
  formatAnalyticsCurrency,
  formatAnalyticsNumber,
  getAnalyticsSnapshot,
  getOrderGrossAmount,
  getOrderNetAmount,
  getOrderRefundAmount,
  getPaymentMethodBreakdown,
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

export const dynamic = "force-dynamic"

export default async function AnalyticsRevenuePage({
  searchParams,
}: {
  searchParams?: Promise<{ range?: string }> | { range?: string }
}) {
  const params = searchParams ? await searchParams : {}
  const rangeKey = resolveAnalyticsRangeKey(params?.range)
  const snapshot = await getAnalyticsSnapshot(rangeKey)
  const currency = snapshot.orders[0]?.details.currency || "USD"
  const grossRevenue = snapshot.ordersInRange.reduce((sum, order) => sum + getOrderGrossAmount(order), 0)
  const refundedRevenue = snapshot.ordersInRange.reduce((sum, order) => sum + getOrderRefundAmount(order), 0)
  const netRevenue = snapshot.ordersInRange.reduce((sum, order) => sum + getOrderNetAmount(order), 0)
  const taxCaptured = snapshot.ordersInRange.reduce((sum, order) => sum + order.details.taxAmount, 0)
  const revenueTrend = buildTrendSeries(snapshot.range, snapshot.ordersInRange, (order) => getOrderNetAmount(order))
  const paymentRows = getPaymentMethodBreakdown(snapshot.ordersInRange).slice(0, 8)
  const topRevenueOrders = [...snapshot.ordersInRange]
    .sort((a, b) => getOrderNetAmount(b) - getOrderNetAmount(a))
    .slice(0, 8)
  const averageOrderValue = netRevenue / Math.max(1, snapshot.ordersInRange.length)

  return (
    <AnalyticsPage
      title="Revenue Analytics"
      description="Track gross revenue, refunds, taxes, payment mix, and order value trends from live commerce records."
      range={rangeKey}
    >
      <AnalyticsStatGrid>
        <AnalyticsStatCard label="Gross revenue" value={formatAnalyticsCurrency(grossRevenue, currency)} helper="Excludes cancelled orders" />
        <AnalyticsStatCard label="Net revenue" value={formatAnalyticsCurrency(netRevenue, currency)} helper="After recorded refund impact" />
        <AnalyticsStatCard label="Refund impact" value={formatAnalyticsCurrency(refundedRevenue, currency)} helper="Recorded from refunded orders and refund metadata" />
        <AnalyticsStatCard label="Average order value" value={formatAnalyticsCurrency(averageOrderValue, currency)} helper={`Taxes captured: ${formatAnalyticsCurrency(taxCaptured, currency)}`} />
      </AnalyticsStatGrid>

      <div className="grid gap-4 xl:grid-cols-2">
        <AnalyticsSection
          title="Revenue trend"
          summary={`${snapshot.range.label} net revenue by live order timestamp.`}
        >
          {revenueTrend.some((point) => point.value > 0) ? (
            <AnalyticsBarList
              rows={revenueTrend.map((point) => ({ label: point.label, value: point.value }))}
              formatter={(value) => formatAnalyticsCurrency(value, currency)}
            />
          ) : (
            <AnalyticsEmptyState
              title="No revenue in this range"
              description="Revenue trend data will appear as soon as there are non-cancelled live orders in the selected period."
            />
          )}
        </AnalyticsSection>
        <AnalyticsSection
          title="Payment methods"
          summary="Grouped by the payment method stored on each order."
        >
          {paymentRows.length > 0 ? (
            <AnalyticsTable
              columns={["Method", "Orders", "Revenue"]}
              rows={paymentRows.map((row) => [
                row.method,
                formatAnalyticsNumber(row.count),
                formatAnalyticsCurrency(row.revenue, currency),
              ])}
            />
          ) : (
            <AnalyticsEmptyState
              title="No payment mix yet"
              description="Payment method analytics will populate once real orders record a payment method at checkout."
            />
          )}
        </AnalyticsSection>
      </div>

      <AnalyticsSection
        title="Highest-value orders"
        summary="Top revenue-contributing orders in the selected date window."
      >
        {topRevenueOrders.length > 0 ? (
          <AnalyticsTable
            columns={["Order", "Customer", "Payment", "Net revenue"]}
            rows={topRevenueOrders.map((order) => [
              order.orderNumber,
              order.customerName || order.customerEmail,
              order.details.paymentMethod || "Unknown",
              formatAnalyticsCurrency(getOrderNetAmount(order), order.details.currency),
            ])}
          />
        ) : (
          <AnalyticsEmptyState
            title="No orders to rank"
            description="Once live revenue exists, the highest-value orders will appear here for fast finance review."
          />
        )}
      </AnalyticsSection>
    </AnalyticsPage>
  )
}
