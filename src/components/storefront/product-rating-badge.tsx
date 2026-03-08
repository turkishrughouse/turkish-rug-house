"use client"

import { useEffect, useState } from "react"
import { Star } from "lucide-react"

type Summary = { average: number; count: number }

const cache = new Map<string, Summary>()
const listeners = new Map<string, Array<(summary: Summary) => void>>()
let queue = new Set<string>()
let timer: ReturnType<typeof setTimeout> | null = null

function flushQueue() {
  const ids = Array.from(queue)
  queue = new Set()
  timer = null
  if (!ids.length) return

  fetch(`/api/public/reviews?productIds=${encodeURIComponent(ids.join(","))}`, { cache: "no-store" })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error("fetch failed"))))
    .then((data) => {
      const summaries: Record<string, Summary> = data?.summaries || {}
      ids.forEach((id) => {
        const summary = summaries[id] || { average: 0, count: 0 }
        cache.set(id, summary)
        const cbs = listeners.get(id) || []
        cbs.forEach((cb) => cb(summary))
        listeners.delete(id)
      })
    })
    .catch(() => {
      ids.forEach((id) => {
        const fallback = { average: 0, count: 0 }
        cache.set(id, fallback)
        const cbs = listeners.get(id) || []
        cbs.forEach((cb) => cb(fallback))
        listeners.delete(id)
      })
    })
}

function subscribeSummary(productId: string, cb: (summary: Summary) => void) {
  if (cache.has(productId)) {
    cb(cache.get(productId)!)
    return () => {}
  }

  const current = listeners.get(productId) || []
  listeners.set(productId, [...current, cb])
  queue.add(productId)
  if (!timer) timer = setTimeout(flushQueue, 40)

  return () => {
    const arr = listeners.get(productId) || []
    listeners.set(productId, arr.filter((fn) => fn !== cb))
  }
}

export function ProductRatingBadge({ productId }: { productId: string }) {
  const [summary, setSummary] = useState<Summary>({ average: 0, count: 0 })

  useEffect(() => {
    return subscribeSummary(productId, setSummary)
  }, [productId])

  return (
    <div className="absolute right-2 top-2 z-20 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-sm backdrop-blur">
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
      <span>{summary.average.toFixed(1)}</span>
      <span className="text-slate-500">({summary.count})</span>
    </div>
  )
}
