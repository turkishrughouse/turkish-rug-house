"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { SlidersHorizontal, X } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { resolveColorSwatch } from "@/lib/storefront/color-swatches"

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
  variant?: "checkbox" | "pill" | "swatch"
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
      <div className="rounded-[24px] border border-[#e7dfd4] bg-[#f7f3ed] p-4 text-[#4d453b] shadow-[0_14px_36px_rgba(31,22,16,0.08)]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#dcc6a2] bg-[#f4ead9] px-4 text-sm font-semibold text-[#3c3127]"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filter
          </button>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#2c261f]">{resultCount} products</p>
            <p className="text-xs text-[#8f877a]">Browse with filters</p>
          </div>
        </div>

        {activeChips.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {activeChips.map((chip) => (
              <Link
                key={chip.key}
                href={chip.href}
                onClick={() => setOpen(false)}
                className="inline-flex items-center rounded-full border border-[#dcc6a2] bg-[#f4ead9] px-3 py-1 text-xs font-medium text-[#3c3127]"
              >
                {chip.label}
              </Link>
            ))}
            <Link href={categoryPath} onClick={() => setOpen(false)} className="inline-flex items-center rounded-full border border-[#e7dfd4] bg-[#fffdfa] px-3 py-1 text-xs font-medium text-[#7d7468]">
              Clear
            </Link>
          </div>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="left-0 top-auto bottom-0 h-[88vh] max-h-[88dvh] max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-t-[28px] border-0 bg-[#fcfaf6] p-0 text-[#4d453b] shadow-2xl sm:h-[82vh] sm:max-h-[82dvh]">
          <DialogTitle className="sr-only">Product filters</DialogTitle>
          <div className="flex h-full min-h-0 flex-col">
            <div className="sticky top-0 z-10 border-b border-[#e7dfd4] bg-[#fcfaf6] px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#b08a55]">Filters</p>
                  <p className="mt-2 text-lg font-semibold text-[#2c261f]">{resultCount} matching products</p>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e7dfd4] text-[#8f877a]">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 [WebkitOverflowScrolling:touch]">
              {statusSection ? (
                <div className="rounded-2xl border border-[#e7dfd4] bg-[#fffdfa] p-4">
                  <p className="text-sm font-semibold text-[#2c261f]">{statusSection.title}</p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {statusSection.items.map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={`rounded-xl border px-3 py-3 text-sm font-medium ${item.active ? "border-[#dcc6a2] bg-[#f4ead9] text-[#3c3127]" : "border-[#e7dfd4] bg-[#fffdfa] text-[#70675c]"}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span>{item.label}</span>
                          <span className={`h-2.5 w-2.5 rounded-full ${item.active ? "bg-[#caa56a]" : "bg-[#d6cec2]"}`} />
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
                    <div key={section.id} className="overflow-hidden rounded-2xl border border-[#e7dfd4] bg-[#fffdfa]">
                      <button
                        type="button"
                        onClick={() => setOpenSections((current) => ({ ...current, [section.id]: !isOpen }))}
                        className="flex w-full items-center justify-between px-4 py-4 text-left"
                        aria-expanded={isOpen}
                        aria-controls={`filter-section-${section.id}`}
                      >
                        <span className="text-sm font-semibold text-[#2c261f]">{section.title}</span>
                        <span className="text-xs text-[#8b8277]">{isOpen ? "Hide" : "Show"}</span>
                      </button>
                      {isOpen ? (
                        <div
                          id={`filter-section-${section.id}`}
                          className={`border-t border-[#eee6db] p-4 ${
                            section.variant === "swatch" ? "grid grid-cols-3 gap-x-3 gap-y-4" :
                            section.variant === "pill" ? "flex flex-wrap gap-2" :
                            "space-y-2"
                          }`}
                        >
                          {section.items.map((item) => (
                            <Link
                              key={`${section.id}-${item.label}`}
                              href={item.href}
                              onClick={() => setOpen(false)}
                              className={
                                section.variant === "swatch"
                                  ? `rounded-[22px] border px-2 py-2.5 text-center transition-all duration-200 ${item.active ? "border-[#caa56a] bg-[#fcf7ef] shadow-[0_0_0_2px_rgba(255,255,255,0.96),0_0_0_5px_rgba(202,165,106,0.38),0_10px_22px_rgba(202,165,106,0.16)]" : "border-[#e7dfd4] bg-[#fffdfa] shadow-[0_8px_18px_rgba(48,38,26,0.06)]"}`
                                  : section.variant === "pill"
                                    ? `inline-flex items-center rounded-full border px-3 py-2 text-sm ${item.active ? "border-[#dcc6a2] bg-[#f4ead9] text-[#3c3127]" : "border-[#e7dfd4] bg-[#fffdfa] text-[#70675c]"}`
                                    : `flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm ${item.active ? "border-[#dcc6a2] bg-[#f4ead9] text-[#3c3127]" : "border-[#e7dfd4] bg-[#fffdfa] text-[#70675c]"}`
                              }
                            >
                              {section.variant === "swatch" ? (
                                <span className="block">
                                  {(() => {
                                    const swatch = resolveColorSwatch({
                                      label: item.label,
                                      hex: item.colorHex,
                                    })
                                    return (
                                      <span className="mx-auto block h-[3.35rem] w-[3.35rem] rounded-[18px] border shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]" style={{ background: swatch.background, borderColor: swatch.borderColor || "rgba(58,45,32,0.12)" }} />
                                    )
                                  })()}
                                  <span className="mt-2.5 block truncate text-[13px] font-semibold leading-5 text-[#4a4138]">{item.label}</span>
                                  {typeof item.count === "number" ? (
                                    <span className="mt-0.5 block text-[11px] font-medium text-[#8e8578]">{item.count}</span>
                                  ) : null}
                                </span>
                              ) : (
                                <>
                                  <span className="flex min-w-0 items-center gap-2">
                                    {section.variant === "checkbox" ? (
                                      <span className={`inline-flex h-5 w-5 items-center justify-center rounded border ${item.active ? "border-[#caa56a] bg-[#caa56a]" : "border-[#d7cec2] bg-transparent"}`}>
                                        {item.active ? <span className="h-2 w-2 rounded-sm bg-white" /> : null}
                                      </span>
                                    ) : null}
                                    {item.colorHex ? (() => {
                                      const swatch = resolveColorSwatch({ label: item.label, hex: item.colorHex })
                                      return <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-[#d7cec2]" style={{ background: swatch.background, borderColor: swatch.borderColor || "#d7cec2" }} />
                                    })() : null}
                                    <span className="truncate">{item.label}</span>
                                  </span>
                                  {typeof item.count === "number" ? (
                                    <span className="rounded-full border border-[#e4dbcf] bg-[#f5f1ea] px-2 py-0.5 text-[11px] text-[#938c82]">{item.count}</span>
                                  ) : null}
                                </>
                              )}
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="sticky bottom-0 border-t border-[#e7dfd4] bg-[#fcfaf6] px-5 py-4">
              <div className="flex gap-3">
                <Link href={categoryPath} onClick={() => setOpen(false)} className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-[#e7dfd4] bg-[#fffdfa] text-sm font-semibold text-[#70675c]">
                  Clear
                </Link>
                <button type="button" onClick={() => setOpen(false)} className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-[#f4ead9] text-sm font-semibold text-[#3c3127]">
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
