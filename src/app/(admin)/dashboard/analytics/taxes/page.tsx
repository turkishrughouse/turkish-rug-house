import {
  formatAnalyticsCurrency,
  formatAnalyticsNumber,
  getAnalyticsSnapshot,
  getTaxCountryBreakdown,
  resolveAnalyticsRangeKey,
} from "@/lib/admin-analytics"
import { getSiteSettings } from "@/lib/site-settings"
import { AnalyticsEmptyState, AnalyticsPage, AnalyticsSection, AnalyticsStatCard, AnalyticsStatGrid, AnalyticsTable } from "@/components/admin/analytics/analytics-ui"
import type { AnalyticsPageProps } from "@/app/(admin)/dashboard/analytics/_lib/page-props"

export const dynamic = "force-dynamic"

export default async function AnalyticsTaxesPage({ searchParams }: AnalyticsPageProps) {
  const params = (await searchParams) ?? {}
  const rangeKey = resolveAnalyticsRangeKey(params?.range)
  const [snapshot, settings] = await Promise.all([getAnalyticsSnapshot(rangeKey), getSiteSettings()])
  const currency = snapshot.orders[0]?.details.currency || "USD"
  const taxTotal = snapshot.ordersInRange.reduce((sum, order) => sum + order.details.taxAmount, 0)
  const taxedOrders = snapshot.ordersInRange.filter((order) => order.details.taxAmount > 0)
  const taxCountries = getTaxCountryBreakdown(snapshot.ordersInRange)

  return (
    <AnalyticsPage
      title="Tax Analytics"
      description="Track tax capture only from real order tax metadata and remain empty when tax collection is inactive."
      range={rangeKey}
    >
      <AnalyticsStatGrid>
        <AnalyticsStatCard label="Taxes enabled" value={settings.enableTaxes ? "Enabled" : "Disabled"} helper="Live store tax setting" />
        <AnalyticsStatCard label="Tax collected" value={formatAnalyticsCurrency(taxTotal, currency)} helper={`${snapshot.range.label} total`} />
        <AnalyticsStatCard label="Taxed orders" value={formatAnalyticsNumber(taxedOrders.length)} helper="Orders carrying a positive tax amount" />
        <AnalyticsStatCard label="Average tax per taxed order" value={formatAnalyticsCurrency(taxTotal / Math.max(1, taxedOrders.length), currency)} helper="Based only on orders with tax data" />
      </AnalyticsStatGrid>

      <AnalyticsSection title="Tax by destination" summary="Country-level tax totals from live order metadata.">
        {taxCountries.length > 0 ? (
          <AnalyticsTable
            columns={["Country", "Orders", "Tax total"]}
            rows={taxCountries.map((row) => [
              row.country,
              formatAnalyticsNumber(row.orders),
              formatAnalyticsCurrency(row.tax, currency),
            ])}
          />
        ) : (
          <AnalyticsEmptyState
            title="No live tax records yet"
            description="Taxes are either disabled or not yet being written to orders. As soon as tax amounts are recorded at checkout, this page will start populating automatically."
          />
        )}
      </AnalyticsSection>
    </AnalyticsPage>
  )
}
