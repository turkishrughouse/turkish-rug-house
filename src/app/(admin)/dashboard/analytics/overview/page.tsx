import {
  buildTrendSeries,
  calculatePercentChange,
  formatAnalyticsCurrency,
  formatAnalyticsDateTime,
  formatAnalyticsNumber,
  getAnalyticsSnapshot,
  getCategoryPerformance,
  getDistinctCustomerCount,
  getNearRealtimeTimestamp,
  getOrderNetAmount,
  getRecentActivity,
  getTopProducts,
  isAnalyticsEmpty,
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

export default async function AnalyticsOverviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ range?: string }> | { range?: string }
}) {
  const params = searchParams ? await searchParams : {}
  const rangeKey = resolveAnalyticsRangeKey(params?.range)
  const snapshot = await getAnalyticsSnapshot(rangeKey)
  const currency = snapshot.orders[0]?.details.currency || "USD"
  const revenue = snapshot.ordersInRange.reduce((sum, order) => sum + getOrderNetAmount(order), 0)
  const previousRevenue = snapshot.previousOrdersInRange.reduce((sum, order) => sum + getOrderNetAmount(order), 0)
  const customers = getDistinctCustomerCount(snapshot.ordersInRange)
  const previousCustomers = getDistinctCustomerCount(snapshot.previousOrdersInRange)
  const productsAdded = snapshot.productsInRange.length
  const previousProductsAdded = snapshot.previousProductsInRange.length
  const itemsSold = snapshot.ordersInRange.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0)
  const previousItemsSold = snapshot.previousOrdersInRange.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0)
  const revenueTrend = buildTrendSeries(snapshot.range, snapshot.ordersInRange, (order) => getOrderNetAmount(order))
  const orderTrend = buildTrendSeries(snapshot.range, snapshot.ordersInRange, () => 1)
  const categoryPerformance = getCategoryPerformance(snapshot.categories, snapshot.ordersInRange).slice(0, 6)
  const topProducts = getTopProducts(snapshot.ordersInRange, 6)
  const recentActivity = getRecentActivity(snapshot)

  return (
    <AnalyticsPage
      title="Analytics Overview"
      description="High-level business performance built from current orders, catalog, customer, and fulfillment records."
      range={rangeKey}
    >
      <AnalyticsStatGrid>
        <AnalyticsStatCard
          label="Net revenue"
          value={formatAnalyticsCurrency(revenue, currency)}
          helper={`${calculatePercentChange(revenue, previousRevenue)}% vs previous period`}
        />
        <AnalyticsStatCard
          label="Orders"
          value={formatAnalyticsNumber(snapshot.ordersInRange.length)}
          helper={`${calculatePercentChange(snapshot.ordersInRange.length, snapshot.previousOrdersInRange.length)}% vs previous period`}
        />
        <AnalyticsStatCard
          label="Customers"
          value={formatAnalyticsNumber(customers)}
          helper={`${calculatePercentChange(customers, previousCustomers)}% vs previous period`}
        />
        <AnalyticsStatCard
          label="Products added"
          value={formatAnalyticsNumber(productsAdded)}
          helper={`${calculatePercentChange(productsAdded, previousProductsAdded)}% vs previous period`}
        />
      </AnalyticsStatGrid>

      {isAnalyticsEmpty(snapshot.orders, snapshot.products) ? (
        <AnalyticsSection title="Overview state" summary="This analytics area is live and waiting for real activity.">
          <AnalyticsEmptyState
            title="No analytics activity yet"
            description="Orders, product creation, customer growth, and revenue trends will appear here automatically once real records start flowing through the store."
          />
        </AnalyticsSection>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <AnalyticsSection
              title="Revenue trend"
              summary={`${snapshot.range.label} revenue from non-cancelled orders, net of recorded refunds.`}
            >
              <AnalyticsBarList
                rows={revenueTrend.map((point) => ({ label: point.label, value: point.value }))}
                formatter={(value) => formatAnalyticsCurrency(value, currency)}
              />
            </AnalyticsSection>
            <AnalyticsSection
              title="Order velocity"
              summary={`${snapshot.range.label} order intake based on real order creation timestamps.`}
            >
              <AnalyticsBarList rows={orderTrend.map((point) => ({ label: point.label, value: point.value }))} />
            </AnalyticsSection>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <AnalyticsSection
              title="Category contribution"
              summary="Revenue and order contribution grouped by real catalog categories."
            >
              {categoryPerformance.length > 0 ? (
                <AnalyticsTable
                  columns={["Category", "Products", "Orders", "Revenue"]}
                  rows={categoryPerformance.map((row) => [
                    row.title,
                    formatAnalyticsNumber(row.productCount),
                    formatAnalyticsNumber(row.orderCount),
                    formatAnalyticsCurrency(row.revenue, currency),
                  ])}
                />
              ) : (
                <AnalyticsEmptyState
                  title="No category sales yet"
                  description="Category contribution will appear as soon as sold order items can be tied back to products in live categories."
                />
              )}
            </AnalyticsSection>
            <AnalyticsSection
              title="Top products"
              summary={`Best-selling products for ${snapshot.range.label}.`}
            >
              {topProducts.length > 0 ? (
                <AnalyticsTable
                  columns={["Product", "Units", "Orders", "Revenue"]}
                  rows={topProducts.map((row) => [
                    row.title,
                    formatAnalyticsNumber(row.quantity),
                    formatAnalyticsNumber(row.orders),
                    formatAnalyticsCurrency(row.revenue, currency),
                  ])}
                />
              ) : (
                <AnalyticsEmptyState
                  title="No product sales yet"
                  description="Top-performing products will populate automatically when paid or fulfilled orders start landing."
                />
              )}
            </AnalyticsSection>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <AnalyticsSection
              title="Recent order activity"
              summary={`Near real-time snapshot refreshed from live records at ${formatAnalyticsDateTime(getNearRealtimeTimestamp())}.`}
            >
              {recentActivity.recentOrders.length > 0 ? (
                <AnalyticsTable
                  columns={["Order", "Customer", "Status", "Total"]}
                  rows={recentActivity.recentOrders.map((order) => [
                    order.orderNumber,
                    order.customerName || order.customerEmail,
                    order.status,
                    formatAnalyticsCurrency(order.total, order.details.currency),
                  ])}
                />
              ) : (
                <AnalyticsEmptyState
                  title="No recent orders"
                  description="Recent order activity will appear here when the store receives live order records."
                />
              )}
            </AnalyticsSection>
            <AnalyticsSection
              title="Recent catalog activity"
              summary={`Includes ${formatAnalyticsNumber(itemsSold)} units sold and ${formatAnalyticsNumber(previousItemsSold)} in the previous comparison window.`}
            >
              {recentActivity.recentProducts.length > 0 ? (
                <AnalyticsTable
                  columns={["Product", "SKU", "Published", "Created"]}
                  rows={recentActivity.recentProducts.map((product) => [
                    product.title,
                    product.sku || "No SKU",
                    product.isPublished ? "Published" : "Draft",
                    formatAnalyticsDateTime(product.createdAt),
                  ])}
                />
              ) : (
                <AnalyticsEmptyState
                  title="No recent products"
                  description="Product activity will appear here when admins add or update real catalog records."
                />
              )}
            </AnalyticsSection>
          </div>
        </>
      )}
    </AnalyticsPage>
  )
}
