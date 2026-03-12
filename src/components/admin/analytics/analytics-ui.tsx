import Link from "next/link"
import type { ReactNode } from "react"
import { ANALYTICS_RANGE_OPTIONS, type AnalyticsRangeKey, formatAnalyticsNumber } from "@/lib/admin-analytics"

export function AnalyticsPage({
  title,
  description,
  range,
  children,
}: {
  title: string
  description: string
  range: AnalyticsRangeKey
  children: ReactNode
}) {
  return (
    <div className="flex-1 space-y-6 p-6 pt-5 text-slate-900">
      <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white px-6 py-5 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
          <p className="max-w-3xl text-sm text-slate-500">{description}</p>
        </div>
        <div className="inline-flex flex-wrap gap-2 rounded-full border border-slate-200 bg-slate-50 p-1">
          {ANALYTICS_RANGE_OPTIONS.map((option) => (
            <Link
              key={option}
              href={`?range=${option}`}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                range === option ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-900"
              }`}
            >
              {option === "7d" ? "7 days" : option === "365d" ? "12 months" : "30 days"}
            </Link>
          ))}
        </div>
      </div>
      {children}
    </div>
  )
}

export function AnalyticsStatGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{children}</div>
}

export function AnalyticsStatCard({
  label,
  value,
  helper,
}: {
  label: string
  value: string
  helper?: string
}) {
  return (
    <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      {helper ? <p className="mt-2 text-sm text-slate-500">{helper}</p> : null}
    </div>
  )
}

export function AnalyticsSection({
  title,
  summary,
  children,
}: {
  title: string
  summary?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          {summary ? <p className="text-sm text-slate-500">{summary}</p> : null}
        </div>
      </div>
      <div className="pt-4">{children}</div>
    </section>
  )
}

export function AnalyticsEmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
      <p className="text-base font-semibold text-slate-700">{title}</p>
      <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-500">{description}</p>
    </div>
  )
}

export function AnalyticsBarList({
  rows,
  formatter = formatAnalyticsNumber,
}: {
  rows: Array<{ label: string; value: number; meta?: string }>
  formatter?: (value: number) => string
}) {
  const max = rows.reduce((highest, row) => Math.max(highest, row.value), 0)
  if (rows.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const width = max > 0 ? `${Math.max(6, (row.value / max) * 100)}%` : "6%"
        return (
          <div key={`${row.label}-${row.meta || ""}`} className="space-y-1.5">
            <div className="flex items-center justify-between gap-4 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-800">{row.label}</p>
                {row.meta ? <p className="truncate text-xs text-slate-500">{row.meta}</p> : null}
              </div>
              <span className="shrink-0 font-semibold text-slate-900">{formatter(row.value)}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-slate-900" style={{ width }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function AnalyticsTable({
  columns,
  rows,
  empty,
}: {
  columns: string[]
  rows: ReactNode[][]
  empty?: ReactNode
}) {
  if (rows.length === 0) {
    return empty ? <>{empty}</> : null
  }

  return (
    <div className="overflow-hidden rounded-[22px] border border-slate-100">
      <div className="grid bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        {columns.map((column) => (
          <div key={column}>{column}</div>
        ))}
      </div>
      {rows.map((row, index) => (
        <div
          key={`row-${index}`}
          className="grid items-center gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-700"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
        >
          {row.map((cell, cellIndex) => (
            <div key={`cell-${index}-${cellIndex}`} className={cellIndex === 0 ? "font-medium text-slate-900" : ""}>
              {cell}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
