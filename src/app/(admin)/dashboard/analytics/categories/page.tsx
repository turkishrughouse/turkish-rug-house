import {
  formatAnalyticsCurrency,
  formatAnalyticsNumber,
  getAnalyticsSnapshot,
  getCategoryPerformance,
  resolveAnalyticsRangeKey,
} from "@/lib/admin-analytics"
import { AnalyticsBarList, AnalyticsEmptyState, AnalyticsPage, AnalyticsSection, AnalyticsStatCard, AnalyticsStatGrid, AnalyticsTable } from "@/components/admin/analytics/analytics-ui"
import type { AnalyticsPageProps } from "@/app/(admin)/dashboard/analytics/_lib/page-props"

export const dynamic = "force-dynamic"

export default async function AnalyticsCategoriesPage({ searchParams }: AnalyticsPageProps) {
  const params = (await searchParams) ?? {}
  const rangeKey = resolveAnalyticsRangeKey(params?.range)
  const snapshot = await getAnalyticsSnapshot(rangeKey)
  const currency = snapshot.orders[0]?.details.currency || "USD"
  const performance = getCategoryPerformance(snapshot.categories, snapshot.ordersInRange)
  const rootCategories = snapshot.categories.filter((category) => !category.parentId).length
  const activeCategories = snapshot.categories.filter((category) => category.productIds.length > 0).length
  const sellingCategories = performance.filter((category) => category.revenue > 0).length

  return (
    <AnalyticsPage
      title="Category Analytics"
      description="Understand how category structure contributes to products, units sold, and revenue."
      range={rangeKey}
    >
      <AnalyticsStatGrid>
        <AnalyticsStatCard label="Total categories" value={formatAnalyticsNumber(snapshot.categories.length)} helper="All live catalog categories" />
        <AnalyticsStatCard label="Root categories" value={formatAnalyticsNumber(rootCategories)} helper="Top-level catalog groups" />
        <AnalyticsStatCard label="Categories with products" value={formatAnalyticsNumber(activeCategories)} helper="Non-empty categories based on current product assignments" />
        <AnalyticsStatCard label="Revenue-active categories" value={formatAnalyticsNumber(sellingCategories)} helper={`${snapshot.range.label} categories with recorded sales`} />
      </AnalyticsStatGrid>

      <div className="grid gap-4 xl:grid-cols-2">
        <AnalyticsSection title="Category revenue contribution" summary="Revenue-bearing categories in the selected range.">
          {performance.some((category) => category.revenue > 0) ? (
            <AnalyticsBarList
              rows={performance.filter((category) => category.revenue > 0).slice(0, 8).map((category) => ({
                label: category.title,
                value: category.revenue,
                meta: `${category.productCount} products · ${category.orderCount} orders`,
              }))}
              formatter={(value) => formatAnalyticsCurrency(value, currency)}
            />
          ) : (
            <AnalyticsEmptyState
              title="No category sales yet"
              description="Real category revenue contribution appears once sold products are tied to live category assignments."
            />
          )}
        </AnalyticsSection>
        <AnalyticsSection title="Category coverage" summary="Category size based on assigned products.">
          {snapshot.categories.length > 0 ? (
            <AnalyticsBarList
              rows={snapshot.categories
                .slice()
                .sort((a, b) => b.productIds.length - a.productIds.length)
                .slice(0, 8)
                .map((category) => ({
                  label: category.title,
                  value: category.productIds.length,
                  meta: category.parentTitle ? `Child of ${category.parentTitle}` : "Top-level category",
                }))}
            />
          ) : (
            <AnalyticsEmptyState title="No categories yet" description="Category coverage will appear when the catalog contains live category records." />
          )}
        </AnalyticsSection>
      </div>

      <AnalyticsSection title="Category performance table" summary="Products, units, orders, and revenue by category.">
        {performance.length > 0 ? (
          <AnalyticsTable
            columns={["Category", "Products", "Units", "Orders", "Revenue"]}
            rows={performance.map((category) => [
              category.title,
              formatAnalyticsNumber(category.productCount),
              formatAnalyticsNumber(category.quantity),
              formatAnalyticsNumber(category.orderCount),
              formatAnalyticsCurrency(category.revenue, currency),
            ])}
          />
        ) : (
          <AnalyticsEmptyState title="No category performance yet" description="This table will populate automatically as real catalog and order data grows." />
        )}
      </AnalyticsSection>
    </AnalyticsPage>
  )
}
