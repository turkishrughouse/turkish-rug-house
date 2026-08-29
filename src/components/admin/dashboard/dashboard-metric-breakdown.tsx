"use client"

import { ChevronDown } from "lucide-react"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type MetricDetailRow = {
    label: string
    value: string
}

/**
 * The breakdown disclosure on a KPI tile.
 *
 * This was a native <details>/<summary>, which gave a trigger styled with
 * `display: flex` - overriding the `list-item` display a summary needs to stay a
 * disclosure control - and which could not satisfy the close-on-Escape and
 * close-on-outside-click behaviour the card needs anyway.
 *
 * Radix DropdownMenu (already a dependency, already wrapped in components/ui)
 * provides all of it: the trigger is a real <button>, so Enter and Space open it,
 * Escape and an outside click close it, and focus returns to the trigger. The
 * panel is portalled, so opening it never resizes the card or shifts the grid.
 *
 * Click/tap only. Radix DropdownMenu has no hover intent, and bolting hover onto
 * it produces flicker when the pointer crosses the gap between trigger and panel,
 * so the reliable interaction is the only interaction.
 */
export function DashboardMetricBreakdown({
    metricLabel,
    details,
}: {
    metricLabel: string
    details: MetricDetailRow[]
}) {
    // No data means no affordance - never render a control that opens nothing.
    if (!details || details.length === 0) return null

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                aria-label={`${metricLabel} breakdown`}
                className="group mt-3 flex w-full items-center justify-between rounded-sm border-t border-[#eef2f7] pt-2 text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 data-[state=open]:text-slate-900"
            >
                <span>Breakdown</span>
                <ChevronDown
                    className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180"
                    aria-hidden="true"
                />
            </DropdownMenuTrigger>

            <DropdownMenuContent
                align="start"
                sideOffset={6}
                className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[11rem] border-[#dce3ed] bg-white p-2 shadow-[0_8px_20px_rgba(15,23,42,0.08)]"
            >
                <DropdownMenuLabel className="px-1 pb-1.5 pt-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {metricLabel}
                </DropdownMenuLabel>
                <dl className="space-y-1">
                    {details.map((row) => (
                        <div key={row.label} className="flex items-baseline justify-between gap-4 px-1 py-0.5">
                            <dt className="truncate text-[11px] text-slate-500">{row.label}</dt>
                            <dd className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-900">
                                {row.value}
                            </dd>
                        </div>
                    ))}
                </dl>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
