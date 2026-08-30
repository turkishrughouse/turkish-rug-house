"use client"

import { useEffect, useState } from "react"
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
 * Grace period between the pointer leaving the trigger (or the panel) and the
 * panel closing. It covers the `sideOffset` gap between the two, where the
 * pointer is momentarily over neither element - without it, moving down into the
 * panel closes it. 200ms crosses a 6px gap at any realistic pointer speed and is
 * short enough that the panel never feels stuck open.
 */
export const CLOSE_GRACE_MS = 200

/**
 * The hover state machine, kept free of React and the DOM so it can be exercised
 * directly. `enter` and `leave` take a pointer type because hover must apply to
 * a mouse or trackpad only: touch and pen fire pointerenter immediately before
 * click, and acting on it there would fight tap-to-toggle.
 *
 * The single shared timer is what prevents flicker. Leaving the trigger only
 * *schedules* a close; entering the panel cancels it, and vice versa, so the
 * trigger -> panel move never closes the panel.
 */
export function createHoverIntent(setOpen: (open: boolean) => void, graceMs: number = CLOSE_GRACE_MS) {
    let timer: ReturnType<typeof setTimeout> | null = null

    const cancelClose = () => {
        if (timer !== null) {
            clearTimeout(timer)
            timer = null
        }
    }

    const scheduleClose = () => {
        cancelClose()
        timer = setTimeout(() => {
            timer = null
            setOpen(false)
        }, graceMs)
    }

    return {
        /** Pointer entered the trigger or the panel. */
        enter(pointerType: string) {
            if (pointerType !== "mouse") return
            cancelClose()
            setOpen(true)
        },
        /** Pointer left the trigger or the panel. */
        leave(pointerType: string) {
            if (pointerType !== "mouse") return
            scheduleClose()
        },
        cancelClose,
        isClosePending: () => timer !== null,
    }
}

/**
 * The breakdown disclosure on a KPI tile.
 *
 * Hover is the primary interaction on a pointer device: the panel opens on
 * pointer-enter, with no click required. Radix DropdownMenu has no hover intent
 * of its own, so `open` is fully controlled here and driven by pointer events on
 * both the trigger and the panel. Click and tap still toggle it, and Radix keeps
 * Escape, outside-click and keyboard opening.
 *
 * Focus is left to Radix, which moves it into the panel on open and back to the
 * trigger on close. That is what keyboard users need, and on hover it is
 * invisible: pointer-initiated focus never matches :focus-visible, so no ring
 * appears. Overriding one half of that pair would strand focus on a node that
 * has just unmounted.
 *
 * `modal={false}` matters. Radix's modal mode puts `pointer-events: none` on the
 * body while open, which would make the rest of the dashboard inert under the
 * cursor and break hovering back out again.
 */
export function DashboardMetricBreakdown({
    metricLabel,
    details,
}: {
    metricLabel: string
    details: MetricDetailRow[]
}) {
    const [open, setOpen] = useState(false)

    // A lazy initializer builds the controller exactly once, on mount, so the
    // single close timer survives every re-render. setOpen is stable, so
    // capturing it here is safe.
    const [hover] = useState(() => createHoverIntent(setOpen))

    useEffect(() => () => hover.cancelClose(), [hover])

    // No data means no affordance - never render a control that opens nothing.
    if (!details || details.length === 0) return null

    return (
        <DropdownMenu
            open={open}
            modal={false}
            onOpenChange={(next) => {
                // Covers click, tap and Escape. An explicit change always wins
                // over a hover-out close that is still pending.
                hover.cancelClose()
                setOpen(next)
            }}
        >
            <DropdownMenuTrigger
                aria-label={`${metricLabel} breakdown`}
                onPointerEnter={(event) => hover.enter(event.pointerType)}
                onPointerLeave={(event) => hover.leave(event.pointerType)}
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
                onPointerEnter={(event) => hover.enter(event.pointerType)}
                onPointerLeave={(event) => hover.leave(event.pointerType)}
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
