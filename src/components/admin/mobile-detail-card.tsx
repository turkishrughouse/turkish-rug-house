"use client"

import { ReactNode } from "react"

type DetailRow = {
  label: string
  value: ReactNode
}

export function AdminMobileDetailCard({
  title,
  subtitle,
  leading,
  badges,
  rows,
  actions,
}: {
  title: ReactNode
  subtitle?: ReactNode
  leading?: ReactNode
  badges?: ReactNode
  rows?: DetailRow[]
  actions?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-[#dce3ed] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <div className="flex items-start gap-3">
        {leading ? <div className="shrink-0">{leading}</div> : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2">
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-slate-900">{title}</div>
              {subtitle ? <div className="mt-1 text-sm text-slate-500">{subtitle}</div> : null}
            </div>
            {badges ? <div className="flex flex-wrap gap-2">{badges}</div> : null}
          </div>
        </div>
      </div>

      {rows && rows.length > 0 ? (
        <dl className="mt-4 space-y-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
          {rows.map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-3 text-sm">
              <dt className="shrink-0 text-slate-500">{row.label}</dt>
              <dd className="min-w-0 text-right font-medium text-slate-800">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}
