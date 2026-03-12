import { resolveAnalyticsRangeKey } from "@/lib/admin-analytics"
import { getSiteSettings } from "@/lib/site-settings"
import { AnalyticsEmptyState, AnalyticsPage, AnalyticsSection, AnalyticsStatCard, AnalyticsStatGrid } from "@/components/admin/analytics/analytics-ui"
import type { AnalyticsPageProps } from "@/app/(admin)/dashboard/analytics/_lib/page-props"

export const dynamic = "force-dynamic"

export default async function AnalyticsCouponsPage({ searchParams }: AnalyticsPageProps) {
  const params = (await searchParams) ?? {}
  const rangeKey = resolveAnalyticsRangeKey(params?.range)
  const settings = await getSiteSettings()

  return (
    <AnalyticsPage
      title="Coupon Analytics"
      description="Production-safe coupon reporting shell built on current system capabilities."
      range={rangeKey}
    >
      <AnalyticsStatGrid>
        <AnalyticsStatCard label="Coupons enabled" value={settings.enableCoupons ? "Enabled" : "Disabled"} helper="Live setting from store configuration" />
        <AnalyticsStatCard label="Sequential coupons" value={settings.sequentialCoupons ? "Enabled" : "Disabled"} helper="Whether multiple coupons can stack in sequence" />
        <AnalyticsStatCard label="Coupon dataset" value="Not active" helper="No live coupon redemption table is currently present in the database" />
        <AnalyticsStatCard label="Analytics state" value="Safe empty" helper="No fake coupon metrics are rendered" />
      </AnalyticsStatGrid>

      <AnalyticsSection title="Coupon usage" summary="This page stays honest until a real coupon ledger exists.">
        <AnalyticsEmptyState
          title="No coupon redemption analytics source is available yet"
          description="Store settings show whether coupons are enabled, but there is no current database model that records coupon issuance, redemption, discount attribution, or performance by order. This page is ready for that data source when it is introduced."
        />
      </AnalyticsSection>
    </AnalyticsPage>
  )
}
