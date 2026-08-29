import type { LucideIcon } from "lucide-react"

import {
    DashboardMetricBreakdown,
    type MetricDetailRow,
} from "@/components/admin/dashboard/dashboard-metric-breakdown"
import { cn } from "@/lib/utils"

export type { MetricDetailRow }

/**
 * Compact KPI tile for the admin dashboard.
 *
 * The tile itself stays a server component - only the breakdown disclosure is
 * client-side, so the icon can still be passed straight through as a component
 * reference. Pass `details` only when there is genuinely useful secondary
 * information: with none, no trigger is rendered at all, because a chevron that
 * opens nothing is worse than no chevron.
 */
export function DashboardMetricCard({
    icon: Icon,
    label,
    value,
    helper,
    details,
    className,
}: {
    icon: LucideIcon
    label: string
    value: string
    helper: string
    details?: MetricDetailRow[]
    className?: string
}) {
    return (
        <div
            className={cn(
                "flex flex-col rounded-xl border border-[#dce3ed] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
                className
            )}
        >
            <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                <p className="truncate text-xs font-medium text-slate-500">{label}</p>
            </div>

            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
            <p className="mt-1 text-[11px] leading-4 text-slate-500">{helper}</p>

            {details && details.length > 0 ? (
                <DashboardMetricBreakdown metricLabel={label} details={details} />
            ) : null}
        </div>
    )
}
