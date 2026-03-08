"use client"

import Link from "next/link"
import { useState } from "react"
import { clearSavedSearches, readSavedSearches, removeSavedSearch, type SavedSearchItem } from "@/lib/storefront/saved-searches"

export default function SavedSearchesPage() {
  const [items, setItems] = useState<SavedSearchItem[]>(() => readSavedSearches())

  const removeOne = (id: string) => {
    removeSavedSearch(id)
    setItems(readSavedSearches())
  }

  const clearAll = () => {
    clearSavedSearches()
    setItems([])
  }

  return (
    <section className="border-t border-slate-200 bg-[#f5f7fb]">
      <div className="mx-auto w-full max-w-[1080px] px-6 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Saved Searches</h1>
              <p className="text-sm text-slate-600">Your recent search history from the site search bar.</p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/account" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                Back to account
              </Link>
              <button
                type="button"
                onClick={clearAll}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Clear all
              </button>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {items.length === 0 ? (
              <p className="text-sm text-slate-500">No saved searches yet.</p>
            ) : (
              items.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.query}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.type} • {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={item.href} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100">
                      Open result
                    </Link>
                    <button
                      type="button"
                      onClick={() => removeOne(item.id)}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
