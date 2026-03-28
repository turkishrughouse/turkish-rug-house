"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"

type SearchProduct = {
  id: string
  title: string
  slug: string
}

type AdminHeaderSearchProps = {
  placeholder: string
}

export function AdminHeaderSearch({ placeholder }: AdminHeaderSearchProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchProduct[]>([])
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [])

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      return
    }

    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/products/search?q=${encodeURIComponent(trimmed)}`, { cache: "no-store" })
        const json = await res.json().catch(() => null as null | { products?: SearchProduct[] })
        if (!res.ok) return
        const next = json?.products || []
        setResults(next)
        setOpen(true)
      } catch {
        setResults([])
      }
    }, 180)

    return () => window.clearTimeout(timer)
  }, [query])

  const showEmpty = useMemo(() => query.trim().length > 0 && open && results.length === 0, [open, query, results.length])

  return (
    <div ref={rootRef} className="relative w-full min-w-0 lg:w-96 lg:max-w-[24rem]">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 admin-header-action" />
      <Input
        id="admin-global-search"
        type="search"
        value={query}
        onChange={(event) => {
          const nextValue = event.target.value
          setQuery(nextValue)
          if (!nextValue.trim()) {
            setResults([])
            setOpen(false)
          }
        }}
        onFocus={() => {
          if (query.trim()) setOpen(true)
        }}
        placeholder={placeholder}
        className="pl-10 admin-header-input-theme focus-visible:ring-2 focus-visible:ring-slate-200 focus-visible:border-slate-300"
      />
      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-lg border border-[#dce3ed] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.12)]">
          {results.map((product) => (
            <Link
              key={product.id}
              href={`/dashboard/products/${product.id}`}
              onClick={() => setOpen(false)}
              className="block border-b border-[#eef2f7] px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 last:border-b-0"
            >
              {product.title}
            </Link>
          ))}
          {showEmpty ? (
            <div className="px-4 py-3 text-sm text-slate-500">No products found</div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
