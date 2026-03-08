"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

type ReviewCard = {
  id: string
  customerName: string
  quote: string
  rating: number
  photoUrl: string
  productTitle: string
  productSlug: string
}

export function CustomerReviewsShowcase({
  title,
  subtitle,
  reviews,
}: {
  title: string
  subtitle: string
  reviews: ReviewCard[]
}) {
  const visibleCount = 3
  const [start, setStart] = useState(0)
  const maxStart = Math.max(0, reviews.length - visibleCount)
  const canPrev = start > 0
  const canNext = start < maxStart

  const visible = useMemo(() => reviews.slice(start, start + visibleCount), [reviews, start])

  if (!reviews.length) return null

  return (
    <section className="bg-[#e7e2d8] py-14">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_3fr]">
          <div className="flex flex-col justify-between">
            <div>
              <div className="mb-5 flex items-center gap-2 text-[#1d4f44]">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={`review-star-${i}`} className="text-3xl leading-none">★</span>
                ))}
              </div>
              <h2 className="max-w-[340px] text-5xl font-light leading-[1.03] tracking-tight text-slate-900">{title}</h2>
              <p className="mt-5 max-w-[280px] text-2xl leading-tight text-slate-700">{subtitle}</p>
            </div>

            <div className="mt-8 hidden items-center gap-3 lg:flex">
              <button
                type="button"
                onClick={() => canPrev && setStart((prev) => Math.max(0, prev - 1))}
                className={`inline-flex h-16 w-16 items-center justify-center rounded-full border text-5xl leading-none transition ${
                  canPrev
                    ? "border-[#d6cebd] bg-[#eee8dc] text-slate-700/65 hover:text-slate-900"
                    : "cursor-not-allowed border-slate-300 bg-[#f4f0e7] text-slate-400/60"
                }`}
                aria-label="Previous reviews"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => canNext && setStart((prev) => Math.min(maxStart, prev + 1))}
                className={`inline-flex h-16 w-16 items-center justify-center rounded-full border text-5xl leading-none transition ${
                  canNext
                    ? "border-[#d6cebd] bg-[#eee8dc] text-slate-700/65 hover:text-slate-900"
                    : "cursor-not-allowed border-slate-300 bg-[#f4f0e7] text-slate-400/60"
                }`}
                aria-label="Next reviews"
              >
                ›
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {visible.map((review) => (
              <article key={review.id} className="group/card overflow-hidden rounded-[26px] bg-white/90 shadow-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-xl">
                <div className="aspect-[4/3] w-full overflow-hidden bg-slate-200">
                  <img src={review.photoUrl} alt={`${review.customerName} home rug`} className="h-full w-full object-cover transition-transform duration-300 group-hover/card:scale-105" />
                </div>
                <div className="space-y-2.5 p-4 text-center">
                  <p className="text-sm leading-snug text-slate-700">&ldquo;{review.quote}&rdquo;</p>
                  <p className="text-base leading-none text-slate-600">- {review.customerName}</p>
                  <Link
                    href={`/product/${review.productSlug}`}
                    className="inline-block text-[13px] font-bold uppercase tracking-tight text-slate-800 hover:text-slate-950"
                  >
                    Shop {review.productTitle}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
