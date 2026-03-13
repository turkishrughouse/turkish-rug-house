"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { SlidersHorizontal, X } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

type FilterItem = {
  label: string
  href: string
  active?: boolean
  count?: number
  colorHex?: string
}

type FilterSection = {
  id: string
  title: string
  items: FilterItem[]
  defaultOpen?: boolean
  colorGrid?: boolean
}

type ActiveChip = {
  key: string
  label: string
  href: string
}

export function MobileFilterDrawer({
  categoryPath,
  resultCount,
  sections,
  activeChips,
}: {
  categoryPath: string
  resultCount: number
  sections: FilterSection[]
  activeChips: ActiveChip[]
}) {
  const [open, setOpen] = useState(false)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.map((section) => [section.id, Boolean(section.defaultOpen)]))
  )

  const statusSection = useMemo(() => sections.find((section) => section.id === "status"), [sections])
  const restSections = useMemo(() => sections.filter((section) => section.id !== "status"), [sections])

  return (
    <div className="space-y-4 lg:hidden">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-slate-900 px-4 text-sm font-semibold text-white"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filter
          </button>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{resultCount} products</p>
            <p className="text-xs text-slate-500">Compact mobile filtering</p>
          </div>
        </div>

        {activeChips.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {activeChips.map((chip) => (
              <Link
                key={chip.key}
                href={chip.href}
                className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800"
              >
                {chip.label}
              </Link>
            ))}
            <Link href={categoryPath} className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600">
              Clear
            </Link>
          </div>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="left-0 top-auto bottom-0 h-[88vh] max-w-none translate-x-0 translate-y-0 rounded-t-[28px] border-0 bg-white p-0 shadow-2xl sm:h-[82vh]">
          <DialogTitle className="sr-only">Product filters</DialogTitle>
          <div className="flex h-full flex-col">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0f766e]">Filters</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{resultCount} matching products</p>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {statusSection ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">{statusSection.title}</p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {statusSection.items.map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        className={`rounded-xl border px-3 py-3 text-sm font-medium ${item.active ? "border-teal-200 bg-teal-50 text-teal-800" : "border-slate-200 bg-white text-slate-700"}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span>{item.label}</span>
                          <span className={`h-2.5 w-2.5 rounded-full ${item.active ? "bg-teal-600" : "bg-slate-300"}`} />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 space-y-3">
                {restSections.map((section) => {
                  const isOpen = openSections[section.id] ?? false
                  return (
                    <div key={section.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <button
                        type="button"
                        onClick={() => setOpenSections((current) => ({ ...current, [section.id]: !isOpen }))}
                        className="flex w-full items-center justify-between px-4 py-4 text-left"
                        aria-expanded={isOpen}
                        aria-controls={`filter-section-${section.id}`}
                      >
                        <span className="text-sm font-semibold text-slate-900">{section.title}</span>
                        <span className="text-xs text-slate-400">{isOpen ? "Hide" : "Show"}</span>
                      </button>
                      {isOpen ? (
                        <div id={`filter-section-${section.id}`} className={`border-t border-slate-100 p-4 ${section.colorGrid ? "grid grid-cols-2 gap-2" : "space-y-2"}`}>
                          {section.items.map((item) => (
                            <Link
                              key={`${section.id}-${item.label}`}
                              href={item.href}
                              className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm ${item.active ? "border-teal-200 bg-teal-50 text-teal-800" : "border-slate-200 bg-white text-slate-700"}`}
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                {item.colorHex ? <span className="h-3 w-3 shrink-0 rounded-full border border-slate-300" style={{ backgroundColor: item.colorHex }} /> : null}
                                <span className="truncate">{item.label}</span>
                              </span>
                              {typeof item.count === "number" ? (
                                <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500">{item.count}</span>
                              ) : null}
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="sticky bottom-0 border-t border-slate-200 bg-white px-5 py-4">
              <div className="flex gap-3">
                <Link href={categoryPath} className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-slate-200 text-sm font-semibold text-slate-700">
                  Clear
                </Link>
                <button type="button" onClick={() => setOpen(false)} className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
