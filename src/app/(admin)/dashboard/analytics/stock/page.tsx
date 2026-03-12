import {
  formatAnalyticsCurrency,
  formatAnalyticsNumber,
  getAnalyticsSnapshot,
  getStockHealth,
  resolveAnalyticsRangeKey,
} from "@/lib/admin-analytics"
import { AnalyticsBarList, AnalyticsEmptyState, AnalyticsPage, AnalyticsSection, AnalyticsStatCard, AnalyticsStatGrid, AnalyticsTable } from "@/components/admin/analytics/analytics-ui"

export const dynamic = "force-dynamic"

export default async function AnalyticsStockPage({
  searchParams,
}: {
  searchParams?: Promise<{ range?: string }> | { range?: string }
}) {
  const params = searchParams ? await searchParams : {}
  const rangeKey = resolveAnalyticsRangeKey(params?.range)
  const snapshot = await getAnalyticsSnapshot(rangeKey)
  const stock = getStockHealth(snapshot.products)
  const stockValue = snapshot.products
    .filter((product) => product.isPublished)
    .reduce((sum, product) => sum + product.price * Math.max(0, product.stockCount), 0)

  return (
    <AnalyticsPage
      title="Stock Analytics"
      description="Current inventory health, low-stock risk, and out-of-stock exposure sourced from the live product catalog."
      range={rangeKey}
    >
      <AnalyticsStatGrid>
        <AnalyticsStatCard label="Published products" value={formatAnalyticsNumber(stock.publishedCount)} helper="Live catalog items" />
        <AnalyticsStatCard label="In stock" value={formatAnalyticsNumber(stock.inStockCount)} helper="Published products with positive stock" />
        <AnalyticsStatCard label="Low stock" value={formatAnalyticsNumber(stock.lowStockCount)} helper="Published products at 3 units or fewer" />
        <AnalyticsStatCard label="Stock value" value={formatAnalyticsCurrency(stockValue, "USD")} helper="Price x quantity across published products" />
      </AnalyticsStatGrid>

      <div className="grid gap-4 xl:grid-cols-2">
        <AnalyticsSection title="Low-stock watchlist" summary="Products that may need replenishment soon.">
          {stock.lowStockProducts.length > 0 ? (
            <AnalyticsTable
              columns={["Product", "SKU", "Units left", "State"]}
              rows={stock.lowStockProducts.map((product) => [
                product.title,
                product.sku || "No SKU",
                formatAnalyticsNumber(product.stockCount),
                product.isPublished ? "Published" : "Draft",
              ])}
            />
          ) : (
            <AnalyticsEmptyState title="No low-stock products" description="Inventory looks healthy right now. This area will surface risk automatically when stock falls to critical levels." />
          )}
        </AnalyticsSection>
        <AnalyticsSection title="Out-of-stock exposure" summary="Published products currently unavailable for sale.">
          {stock.outOfStockProducts.length > 0 ? (
            <AnalyticsTable
              columns={["Product", "SKU", "Units", "Published"]}
              rows={stock.outOfStockProducts.map((product) => [
                product.title,
                product.sku || "No SKU",
                formatAnalyticsNumber(product.stockCount),
                product.isPublished ? "Yes" : "No",
              ])}
            />
          ) : (
            <AnalyticsEmptyState title="No out-of-stock products" description="This table will populate automatically if any live catalog item runs out of stock." />
          )}
        </AnalyticsSection>
      </div>

      <AnalyticsSection title="Highest on-hand quantities" summary="Useful for inventory balance and merchandising review.">
        {snapshot.products.length > 0 ? (
          <AnalyticsBarList
            rows={snapshot.products
              .slice()
              .sort((a, b) => b.stockCount - a.stockCount)
              .slice(0, 10)
              .map((product) => ({
                label: product.title,
                value: product.stockCount,
                meta: product.sku || "No SKU",
              }))}
          />
        ) : (
          <AnalyticsEmptyState title="No product stock records yet" description="Once products exist in the catalog, stock distribution will be available here." />
        )}
      </AnalyticsSection>
    </AnalyticsPage>
  )
}
