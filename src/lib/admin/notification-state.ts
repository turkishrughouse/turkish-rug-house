"use client"

const SEEN_ORDER_IDS_KEY = "rughouse_admin_seen_order_ids"
const MAX_SEEN_ORDER_IDS = 500

function parseSeenOrderIds(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is string => typeof value === "string" && value.length > 0)
  } catch {
    return []
  }
}

export function getSeenOrderIds(): Set<string> {
  if (typeof window === "undefined") return new Set()
  const list = parseSeenOrderIds(window.localStorage.getItem(SEEN_ORDER_IDS_KEY))
  return new Set(list)
}

export function markOrderAsSeen(orderId: string) {
  if (typeof window === "undefined" || !orderId) return
  const current = parseSeenOrderIds(window.localStorage.getItem(SEEN_ORDER_IDS_KEY))
  if (current.includes(orderId)) return

  const next = [orderId, ...current].slice(0, MAX_SEEN_ORDER_IDS)
  window.localStorage.setItem(SEEN_ORDER_IDS_KEY, JSON.stringify(next))
}

export function getUnreadOpenOrderCount(openOrderIds: string[]) {
  const seen = getSeenOrderIds()
  return openOrderIds.filter((id) => !seen.has(id)).length
}
