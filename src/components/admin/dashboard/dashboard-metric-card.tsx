import type { LucideIcon } from "lucide-react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

export type MetricDetailRow = {
    label: string
    value: string
}

/**
 * Compact KPI tile for the admin dashboard.
 *
 * The optional disclosure uses a native <details>, so the card stays a server
 * component and the breakdown works without JavaScript. Pass `details` only when
 * there is genuinely useful secondary information - an empty chevron is worse
 * than no chevron.
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
                <details className="group mt-3 border-t border-[#eef2f7] pt-2">
                    <summary className="flex cursor-pointer list-none items-center justify-between rounded-sm text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                        <span>Breakdown</span>
                        <ChevronDown
                            className="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-180"
                            aria-hidden="true"
                        />
                    </summary>
                    <dl className="mt-2 space-y-1">
                        {details.map((row) => (
                            <div key={row.label} className="flex items-baseline justify-between gap-3">
                                <dt className="truncate text-[11px] text-slate-500">{row.label}</dt>
                                <dd className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-800">
                                    {row.value}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </details>
            ) : null}
        </div>
    )
}
