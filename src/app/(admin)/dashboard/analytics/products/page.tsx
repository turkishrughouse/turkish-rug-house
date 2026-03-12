import {
  buildTrendSeries,
  formatAnalyticsCurrency,
  formatAnalyticsDateTime,
  formatAnalyticsNumber,
  getAnalyticsSnapshot,
  getCategoryPerformance,
  getStockHealth,
  getTopCreators,
  getTopProducts,
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

export default async function AnalyticsProductsPage({
  searchParams,
}: {
  searchParams?: Promise<{ range?: string }> | { range?: string }
}) {
  const params = searchParams ? await searchParams : {}
  const rangeKey = resolveAnalyticsRangeKey(params?.range)
  const snapshot = await getAnalyticsSnapshot(rangeKey)
  const currency = snapshot.orders[0]?.details.currency || "USD"
  const productTrend = buildTrendSeries(snapshot.range, snapshot.productsInRange, () => 1)
  const topProducts = getTopProducts(snapshot.ordersInRange, 8)
  const creatorRows = getTopCreators(snapshot.productsInRange, 8)
  const categoryRows = getCategoryPerformance(snapshot.categories, snapshot.ordersInRange).slice(0, 8)
  const stock = getStockHealth(snapshot.products)
  const averageSellPrice =
    topProducts.reduce((sum, row) => sum + row.revenue, 0) / Math.max(1, topProducts.reduce((sum, row) => sum + row.quantity, 0))

  return (
    <AnalyticsPage
      title="Product Analytics"
      description="Monitor product creation, commercial performance, creator throughput, and inventory health without leaving the analytics workspace."
      range={rangeKey}
    >
      <AnalyticsStatGrid>
        <AnalyticsStatCard
          label="Products added"
          value={formatAnalyticsNumber(snapshot.productsInRange.length)}
          helper={`${snapshot.range.label} product creation volume`}
        />
        <AnalyticsStatCard
          label="Published products"
          value={formatAnalyticsNumber(snapshot.products.filter((product) => product.isPublished).length)}
          helper="Live catalog items currently available to the storefront"
        />
        <AnalyticsStatCard
          label="Low-stock products"
          value={formatAnalyticsNumber(stock.lowStockCount)}
          helper="Published products at 3 units or fewer"
        />
        <AnalyticsStatCard
          label="Average sold unit price"
          value={formatAnalyticsCurrency(Number.isFinite(averageSellPrice) ? averageSellPrice : 0, currency)}
          helper="Based on sold order items in the selected range"
        />
      </AnalyticsStatGrid>

      <div className="grid gap-4 xl:grid-cols-2">
        <AnalyticsSection
          title="Product creation trend"
          summary={`Live product creation cadence for ${snapshot.range.label}.`}
        >
          {productTrend.some((point) => point.value > 0) ? (
            <AnalyticsBarList rows={productTrend.map((point) => ({ label: point.label, value: point.value }))} />
          ) : (
            <AnalyticsEmptyState
              title="No product additions in this range"
              description="When products are created during the selected period, their trend line will appear here automatically."
            />
          )}
        </AnalyticsSection>
        <AnalyticsSection
          title="Creator contribution"
          summary="Grouped by the recorded product creator on each live product."
        >
          {creatorRows.length > 0 ? (
            <AnalyticsBarList rows={creatorRows.map((row) => ({ label: row.label, value: row.count }))} />
          ) : (
            <AnalyticsEmptyState
              title="Creator metadata unavailable"
              description="Product creator analytics will appear once products are saved with creator identifiers in the catalog."
            />
          )}
        </AnalyticsSection>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <AnalyticsSection
          title="Top-performing products"
          summary="Revenue and order contribution from real sold order items."
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
              description="Top product analytics will appear once live orders include sold catalog items."
            />
          )}
        </AnalyticsSection>
        <AnalyticsSection
          title="Category contribution"
          summary="Product and revenue distribution across live categories."
        >
          {categoryRows.length > 0 ? (
            <AnalyticsTable
              columns={["Category", "Products", "Units", "Revenue"]}
              rows={categoryRows.map((row) => [
                row.title,
                formatAnalyticsNumber(row.productCount),
                formatAnalyticsNumber(row.quantity),
                formatAnalyticsCurrency(row.revenue, currency),
              ])}
            />
          ) : (
            <AnalyticsEmptyState
              title="No category contribution yet"
              description="Category performance requires live sales or populated product-category relationships."
            />
          )}
        </AnalyticsSection>
      </div>

      <AnalyticsSection
        title="Latest products added"
        summary="Most recent live catalog additions with publish and stock state."
      >
        {snapshot.products.length > 0 ? (
          <AnalyticsTable
            columns={["Product", "SKU", "State", "Created"]}
            rows={snapshot.products.slice(0, 10).map((product) => [
              product.title,
              product.sku || "No SKU",
              product.isPublished ? (product.isStock && product.stockCount > 0 ? "Published / In stock" : "Published / Out of stock") : "Draft",
              formatAnalyticsDateTime(product.createdAt),
            ])}
          />
        ) : (
          <AnalyticsEmptyState
            title="No products yet"
            description="As products are created in the admin, this page will become a real-time catalog operations view."
          />
        )}
      </AnalyticsSection>
    </AnalyticsPage>
  )
}
