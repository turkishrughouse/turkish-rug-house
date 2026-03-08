"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { PageBanner } from "@/components/storefront/page-banner"
import {
  SUPPORT_CATEGORIES,
  getSupportCategoryLabel,
  getSupportCategorySlug,
  parseSupportCategory,
  type SupportCategory,
} from "@/lib/support"

type FaqItem = {
  id: string
  category: SupportCategory
  categorySlug: string
  question: string
  answerShort: string
  answerLong: string
  tags: string[]
  isFeatured: boolean
}

function simpleMarkdown(text: string) {
  const lines = text.split("\n")
  return lines.map((line, index) => {
    const trimmed = line.trim()
    if (!trimmed) return <div key={`sp-${index}`} className="h-2" />
    if (trimmed.startsWith("## ")) return <h4 key={`h2-${index}`} className="text-base font-semibold">{trimmed.slice(3)}</h4>
    if (trimmed.startsWith("- ")) return <p key={`li-${index}`}>• {trimmed.slice(2)}</p>
    return <p key={`p-${index}`}>{trimmed}</p>
  })
}

export function HelpCenterPage({
  bannerTitle = "Help Center",
  bannerSubtitle = "Find quick answers to common questions.",
  bannerImage = null,
}: {
  bannerTitle?: string
  bannerSubtitle?: string
  bannerImage?: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [faqs, setFaqs] = useState<FaqItem[]>([])
  const [allCategoryFaqs, setAllCategoryFaqs] = useState<FaqItem[]>([])
  const [loading, setLoading] = useState(false)
  const [openFaqId, setOpenFaqId] = useState<string | null>(null)
  const selectedCategory = parseSupportCategory(searchParams.get("category"))
  const searchQuery = (searchParams.get("query") || "").trim()
  const [queryInput, setQueryInput] = useState(searchQuery)

  useEffect(() => {
    setQueryInput(searchQuery)
  }, [searchQuery])

  useEffect(() => {
    const fetchFaqs = async () => {
      setLoading(true)
      const params = new URLSearchParams()
      if (selectedCategory) params.set("category", getSupportCategorySlug(selectedCategory))
      if (searchQuery) params.set("query", searchQuery)
      const res = await fetch(`/api/faqs?${params.toString()}`, { cache: "no-store" })
      const json = (await res.json().catch(() => null)) as { faqs?: FaqItem[] } | null
      setFaqs(json?.faqs || [])
      setLoading(false)
    }
    void fetchFaqs()
  }, [selectedCategory, searchQuery])

  useEffect(() => {
    if (!selectedCategory) {
      setAllCategoryFaqs([])
      return
    }
    const fetchCategoryFaqs = async () => {
      const res = await fetch(`/api/faqs?category=${getSupportCategorySlug(selectedCategory)}`, { cache: "no-store" })
      const json = (await res.json().catch(() => null)) as { faqs?: FaqItem[] } | null
      setAllCategoryFaqs(json?.faqs || [])
    }
    void fetchCategoryFaqs()
  }, [selectedCategory])

  const updateParams = (next: { category?: SupportCategory | null; query?: string }) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next.category === null) params.delete("category")
    else if (next.category) params.set("category", getSupportCategorySlug(next.category))
    if (next.query === undefined) {
      // no-op
    } else if (next.query.trim().length === 0) {
      params.delete("query")
    } else {
      params.set("query", next.query.trim())
    }
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  const openFaq = useMemo(() => faqs.find((item) => item.id === openFaqId) || null, [faqs, openFaqId])
  const related = useMemo(() => {
    if (!openFaq) return [] as FaqItem[]
    const pool = allCategoryFaqs.length > 0 ? allCategoryFaqs : faqs.filter((item) => item.category === openFaq.category)
    return pool
      .filter((item) => item.id !== openFaq.id)
      .map((item) => ({
        item,
        score: item.tags.filter((tag) => openFaq.tags.includes(tag)).length,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((entry) => entry.item)
  }, [allCategoryFaqs, faqs, openFaq])

  return (
    <div>
      <PageBanner
        title={bannerTitle}
        subtitle={bannerSubtitle}
        image={bannerImage}
        size="tall"
        className="min-h-[320px] md:min-h-[380px]"
      />
      <section className="bg-[#f5f7fb]">
        <div className="mx-auto w-full max-w-[1240px] px-5 py-8 md:px-6">
          <input
            value={queryInput}
            onChange={(event) => {
              setQueryInput(event.target.value)
              updateParams({ query: event.target.value })
            }}
            className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600"
            placeholder="Search for answers..."
          />
          <div className="mt-6 grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
            <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Categories</p>
              <div className="mt-3 flex flex-wrap gap-2 lg:flex-col">
                <button
                  type="button"
                  onClick={() => updateParams({ category: null })}
                  className={`rounded-md border px-3 py-2 text-sm text-left ${!selectedCategory ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
                >
                  All topics
                </button>
                {SUPPORT_CATEGORIES.map((category) => (
                  <button
                    key={category.value}
                    type="button"
                    onClick={() => updateParams({ category: category.value })}
                    className={`rounded-md border px-3 py-2 text-sm text-left ${
                      selectedCategory === category.value
                        ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                        : "border-slate-300 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </aside>

            <main className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              {loading ? <p className="text-sm text-slate-500">Loading answers...</p> : null}
              {!loading && faqs.length === 0 ? (
                <p className="text-sm text-slate-500">No results found. Try another keyword or category.</p>
              ) : null}

              <div className="space-y-3">
                {faqs.map((faq) => {
                  const isOpen = openFaqId === faq.id
                  return (
                    <article key={faq.id} className="rounded-xl border border-slate-200 p-4">
                      <button
                        type="button"
                        onClick={() => setOpenFaqId((prev) => (prev === faq.id ? null : faq.id))}
                        className="w-full text-left"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {getSupportCategoryLabel(faq.category)}
                        </p>
                        <h2 className="mt-1 text-base font-semibold text-slate-900">{faq.question}</h2>
                        <p className="mt-2 text-sm text-slate-600">{faq.answerShort}</p>
                      </button>

                      {isOpen ? (
                        <div className="mt-4 space-y-3 border-t border-slate-200 pt-4 text-sm leading-6 text-slate-700">
                          {simpleMarkdown(faq.answerLong)}
                          {related.length > 0 ? (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Related questions</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {related.map((item) => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setOpenFaqId(item.id)}
                                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                                  >
                                    {item.question}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  )
                })}
              </div>

            </main>
          </div>
        </div>
      </section>
    </div>
  )
}
