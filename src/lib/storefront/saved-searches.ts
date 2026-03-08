"use client"

export type SavedSearchItem = {
  id: string
  query: string
  href: string
  type: "Category" | "Page" | "Product"
  createdAt: string
}

const STORAGE_KEY = "rughouse_saved_searches"
const LIMIT = 40

function isSavedSearchItem(value: unknown): value is SavedSearchItem {
  if (!value || typeof value !== "object") return false
  const item = value as Record<string, unknown>
  return (
    typeof item.id === "string" &&
    typeof item.query === "string" &&
    typeof item.href === "string" &&
    typeof item.type === "string" &&
    typeof item.createdAt === "string"
  )
}

export function readSavedSearches(): SavedSearchItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isSavedSearchItem)
  } catch {
    return []
  }
}

export function saveSearch(item: Omit<SavedSearchItem, "id" | "createdAt">) {
  if (typeof window === "undefined") return
  const current = readSavedSearches()
  const query = item.query.trim()
  if (!query) return

  const next: SavedSearchItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    query,
    href: item.href,
    type: item.type,
    createdAt: new Date().toISOString(),
  }

  const withoutSame = current.filter(
    (entry) => !(entry.query.toLowerCase() === query.toLowerCase() && entry.href === item.href)
  )
  const merged = [next, ...withoutSame].slice(0, LIMIT)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
}

export function removeSavedSearch(id: string) {
  if (typeof window === "undefined") return
  const next = readSavedSearches().filter((item) => item.id !== id)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export function clearSavedSearches() {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([]))
}

