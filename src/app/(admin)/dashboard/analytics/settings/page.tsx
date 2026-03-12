import Link from "next/link"
import { resolveAnalyticsRangeKey } from "@/lib/admin-analytics"
import { getSiteSettings } from "@/lib/site-settings"
import { AnalyticsPage, AnalyticsSection, AnalyticsStatCard, AnalyticsStatGrid } from "@/components/admin/analytics/analytics-ui"
import type { AnalyticsPageProps } from "@/app/(admin)/dashboard/analytics/_lib/page-props"

export const dynamic = "force-dynamic"

export default async function AnalyticsSettingsPage({ searchParams }: AnalyticsPageProps) {
  const params = (await searchParams) ?? {}
  const rangeKey = resolveAnalyticsRangeKey(params?.range)
  const settings = await getSiteSettings()

  return (
    <AnalyticsPage
      title="Analytics Settings"
      description="Operational controls and live configuration signals that affect analytics completeness, refresh behavior, and reporting quality."
      range={rangeKey}
    >
      <AnalyticsStatGrid>
        <AnalyticsStatCard label="Default currency" value={settings.defaultCurrency} helper="Primary revenue and pricing display currency" />
        <AnalyticsStatCard label="Taxes" value={settings.enableTaxes ? "Enabled" : "Disabled"} helper="Affects tax analytics completeness" />
        <AnalyticsStatCard label="Coupons" value={settings.enableCoupons ? "Enabled" : "Disabled"} helper="Affects future coupon analytics readiness" />
        <AnalyticsStatCard label="Out-of-stock hiding" value={settings.hideOutOfStockOnShop ? "Enabled" : "Disabled"} helper="Influences storefront inventory visibility" />
      </AnalyticsStatGrid>

      <div className="grid gap-4 xl:grid-cols-2">
        <AnalyticsSection title="Reporting controls" summary="Current settings that influence what analytics can observe.">
          <div className="space-y-3 text-sm text-slate-600">
            <div className="rounded-[22px] border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="font-semibold text-slate-900">Tax capture</p>
              <p className="mt-1">Taxes are currently {settings.enableTaxes ? "enabled" : "disabled"}, so tax reports only populate when checkout writes positive tax amounts.</p>
            </div>
            <div className="rounded-[22px] border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="font-semibold text-slate-900">Coupon tracking readiness</p>
              <p className="mt-1">Coupons are {settings.enableCoupons ? "enabled" : "disabled"}, but a redemption ledger is still required before coupon analytics can show performance safely.</p>
            </div>
            <div className="rounded-[22px] border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="font-semibold text-slate-900">Refresh mode</p>
              <p className="mt-1">Analytics pages are configured as dynamic server views so admin metrics refresh from current records instead of stale demo content.</p>
            </div>
          </div>
        </AnalyticsSection>
        <AnalyticsSection title="Useful admin links" summary="Existing control surfaces related to analytics quality.">
          <div className="space-y-3 text-sm">
            <Link href="/dashboard/orders/settings" className="block rounded-[22px] border border-slate-100 bg-slate-50 px-4 py-3 font-medium text-slate-900 transition hover:border-slate-200 hover:bg-white">
              Order settings
              <p className="mt-1 font-normal text-slate-500">Taxes, coupons, currency, shipping, checkout, and payment options.</p>
            </Link>
            <Link href="/dashboard/settings" className="block rounded-[22px] border border-slate-100 bg-slate-50 px-4 py-3 font-medium text-slate-900 transition hover:border-slate-200 hover:bg-white">
              Global admin settings
              <p className="mt-1 font-normal text-slate-500">System-wide behavior, branding, and broader storefront controls.</p>
            </Link>
            <Link href="/dashboard/orders" className="block rounded-[22px] border border-slate-100 bg-slate-50 px-4 py-3 font-medium text-slate-900 transition hover:border-slate-200 hover:bg-white">
              Orders management
              <p className="mt-1 font-normal text-slate-500">Operational detail view for the order data surfaced throughout analytics.</p>
            </Link>
          </div>
        </AnalyticsSection>
      </div>
    </AnalyticsPage>
  )
}
