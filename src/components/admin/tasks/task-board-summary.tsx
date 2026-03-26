"use client"

import { Activity, AlertTriangle, CheckCircle2, PauseCircle, TimerReset, UserMinus } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TaskSummary } from "@/components/admin/tasks/task-board-types"
import type { TaskSummaryFilterKey } from "@/lib/tasks"

const SUMMARY_ITEMS: Array<{
  key: TaskSummaryFilterKey
  label: string
  valueKey: keyof TaskSummary
  icon: typeof Activity
  tone: string
}> = [
  { key: "BACKLOG", label: "Backlog", valueKey: "backlog", icon: TimerReset, tone: "border-slate-200 bg-white text-slate-900" },
  { key: "IN_PROGRESS", label: "In Progress", valueKey: "inProgress", icon: Activity, tone: "border-sky-200 bg-sky-50 text-sky-900" },
  { key: "PAUSED", label: "Paused", valueKey: "paused", icon: PauseCircle, tone: "border-amber-200 bg-amber-50 text-amber-900" },
  { key: "COMPLETED_TODAY", label: "Completed Today", valueKey: "completedToday", icon: CheckCircle2, tone: "border-emerald-200 bg-emerald-50 text-emerald-900" },
  { key: "UNASSIGNED", label: "Unassigned", valueKey: "unassigned", icon: UserMinus, tone: "border-violet-200 bg-violet-50 text-violet-900" },
  { key: "HIGH_PRIORITY", label: "High Priority", valueKey: "highPriority", icon: AlertTriangle, tone: "border-rose-200 bg-rose-50 text-rose-900" },
]

export function TaskBoardSummary({
  summary,
  activeKey,
  onSelect,
}: {
  summary: TaskSummary
  activeKey: TaskSummaryFilterKey | null
  onSelect: (key: TaskSummaryFilterKey | null) => void
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
      {SUMMARY_ITEMS.map((item) => {
        const Icon = item.icon
        const active = activeKey === item.key
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(active ? null : item.key)}
            className={cn(
              "rounded-2xl border px-4 py-4 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(15,23,42,0.08)]",
              item.tone,
              active && "ring-2 ring-slate-900/10",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] opacity-80">{item.label}</span>
              <Icon className="h-4 w-4 opacity-80" />
            </div>
            <div className="mt-4 text-3xl font-semibold tracking-tight">{summary[item.valueKey]}</div>
          </button>
        )
      })}
    </div>
  )
}
