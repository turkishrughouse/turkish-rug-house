"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

type CollectionCategory = {
  id: string
  title: string
  slug: string
  image?: string | null
}

export function ShopByCollectionSection({
  title,
  categories,
}: {
  title: string
  categories: CollectionCategory[]
}) {
  const visibleCount = 3
  const maxStart = Math.max(0, categories.length - visibleCount)
  const [start, setStart] = useState(0)

  const visible = useMemo(
    () => categories.slice(start, start + visibleCount),
    [categories, start]
  )

  const canPrev = start > 0
  const canNext = start < maxStart

  if (!categories.length) return null

  return (
    <section className="container mx-auto px-4 py-14">
      <div className="mb-7 flex items-center justify-between">
        <h2 className="text-4xl font-light tracking-tight text-slate-800">{title}</h2>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => canPrev && setStart((prev) => Math.max(0, prev - 1))}
          className={`absolute left-2 top-1/2 z-20 hidden h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border text-4xl leading-none transition-all duration-200 md:flex ${
            canPrev
              ? "border-[#ddd6c8] bg-[#efe9dc]/55 text-slate-700/65 opacity-55 hover:bg-[#e4dac8] hover:text-slate-800 hover:opacity-100"
              : "cursor-not-allowed border-slate-200 bg-slate-100/40 text-slate-400/70 opacity-35"
          }`}
          aria-label="Previous collections"
        >
          ‹
        </button>

        <button
          type="button"
          onClick={() => canNext && setStart((prev) => Math.min(maxStart, prev + 1))}
          className={`absolute right-2 top-1/2 z-20 hidden h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border text-4xl leading-none transition-all duration-200 md:flex ${
            canNext
              ? "border-[#ddd6c8] bg-[#efe9dc]/55 text-slate-700/65 opacity-55 hover:bg-[#e4dac8] hover:text-slate-800 hover:opacity-100"
              : "cursor-not-allowed border-slate-200 bg-slate-100/40 text-slate-400/70 opacity-35"
          }`}
          aria-label="Next collections"
        >
          ›
        </button>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {visible.map((category) => (
            <Link
              key={category.id}
              href={`/category/${category.slug}`}
              className="group relative block overflow-hidden bg-[#ede8dc]"
            >
              <div className="aspect-[3/3.15] w-full overflow-hidden">
                {category.image ? (
                  <>
                    <img
                      src={category.image}
                      alt={category.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
                  </>
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-semibold uppercase tracking-[0.08em] text-slate-600">
                    {category.title}
                  </div>
                )}
              </div>

              <div className="pointer-events-none absolute bottom-0 left-0 z-10 w-full p-5">
                <div className="max-w-[80%]">
                  <p className="text-left text-base font-semibold uppercase tracking-wide text-white">
                    {category.title}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
