import { prisma } from "@/lib/db"
import { resolveAnalyticsRangeKey } from "@/lib/admin-analytics"
import { AnalyticsEmptyState, AnalyticsPage, AnalyticsSection, AnalyticsStatCard, AnalyticsStatGrid } from "@/components/admin/analytics/analytics-ui"
import type { AnalyticsPageProps } from "@/app/(admin)/dashboard/analytics/_lib/page-props"

export const dynamic = "force-dynamic"

export default async function AnalyticsVariationsPage({ searchParams }: AnalyticsPageProps) {
  const params = (await searchParams) ?? {}
  const rangeKey = resolveAnalyticsRangeKey(params?.range)
  const [colorCount, sizeCount, styleCount, typeCount] = await Promise.all([
    prisma.color.count(),
    prisma.size.count(),
    prisma.style.count(),
    prisma.type.count(),
  ])

  return (
    <AnalyticsPage
      title="Variation Analytics"
      description="Prepared analytics shell for variation-level reporting without inventing unsupported metrics."
      range={rangeKey}
    >
      <AnalyticsStatGrid>
        <AnalyticsStatCard label="Color attributes" value={String(colorCount)} helper="Tracked as attribute options, not orderable variations" />
        <AnalyticsStatCard label="Size attributes" value={String(sizeCount)} helper="Available in catalog metadata" />
        <AnalyticsStatCard label="Style attributes" value={String(styleCount)} helper="Available in catalog metadata" />
        <AnalyticsStatCard label="Type attributes" value={String(typeCount)} helper="Available in catalog metadata" />
      </AnalyticsStatGrid>

      <AnalyticsSection title="Variation-level sales" summary="This section intentionally stays honest until true sellable variation records exist.">
        <AnalyticsEmptyState
          title="No sellable variation model is active"
          description="The current catalog stores colors, sizes, styles, and types as product attributes, but there is no live variation SKU/order model yet. This page is production-safe and ready to be extended once true variation entities are introduced."
        />
      </AnalyticsSection>
    </AnalyticsPage>
  )
}
