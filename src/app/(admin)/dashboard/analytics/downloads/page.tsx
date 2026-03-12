import { resolveAnalyticsRangeKey } from "@/lib/admin-analytics"
import { getSiteSettings } from "@/lib/site-settings"
import { AnalyticsEmptyState, AnalyticsPage, AnalyticsSection, AnalyticsStatCard, AnalyticsStatGrid } from "@/components/admin/analytics/analytics-ui"
import type { AnalyticsPageProps } from "@/app/(admin)/dashboard/analytics/_lib/page-props"

export const dynamic = "force-dynamic"

export default async function AnalyticsDownloadsPage({ searchParams }: AnalyticsPageProps) {
  const params = (await searchParams) ?? {}
  const rangeKey = resolveAnalyticsRangeKey(params?.range)
  const settings = await getSiteSettings()

  return (
    <AnalyticsPage
      title="Downloads Analytics"
      description="Future-ready digital delivery analytics without inventing activity that the platform does not currently track."
      range={rangeKey}
    >
      <AnalyticsStatGrid>
        <AnalyticsStatCard label="Digital downloads tracked" value="No" helper="No live download entitlement or event table exists yet" />
        <AnalyticsStatCard label="Erasure cleanup rule" value={settings.removeDownloadsOnErasureRequest ? "Enabled" : "Disabled"} helper="Current privacy setting from store configuration" />
        <AnalyticsStatCard label="Analytics state" value="Prepared" helper="Safe shell ready for digital product expansion" />
        <AnalyticsStatCard label="Current behavior" value="Empty state" helper="No placeholder download counts are shown" />
      </AnalyticsStatGrid>

      <AnalyticsSection title="Download activity" summary="Reserved for live digital fulfillment data.">
        <AnalyticsEmptyState
          title="No download tracking source is active"
          description="The current store does not record downloadable product entitlements, delivery events, or customer download activity. This page is cleanly prepared for those records when digital products become part of the platform."
        />
      </AnalyticsSection>
    </AnalyticsPage>
  )
}
