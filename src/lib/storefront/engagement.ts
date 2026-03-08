export type EngagementItem = {
  productId: string
  slug: string
  title: string
  image: string
  price: number
}

export type EngagementKey = "rughouse_compare" | "rughouse_wishlist"

const ENGAGEMENT_EVENT = "rughouse:engagement-updated"

function readRawList(key: EngagementKey): EngagementItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry): entry is EngagementItem => {
      return Boolean(
        entry &&
          typeof entry.productId === "string" &&
          typeof entry.slug === "string" &&
          typeof entry.title === "string" &&
          typeof entry.image === "string" &&
          typeof entry.price === "number"
      )
    })
  } catch {
    return []
  }
}

function writeRawList(key: EngagementKey, list: EngagementItem[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(key, JSON.stringify(list))
  window.dispatchEvent(new CustomEvent(ENGAGEMENT_EVENT))
}

export function getEngagementEventName() {
  return ENGAGEMENT_EVENT
}

export function readEngagementList(key: EngagementKey) {
  return readRawList(key)
}

export function addEngagementItem(key: EngagementKey, item: EngagementItem) {
  const list = readRawList(key)
  if (list.some((entry) => entry.productId === item.productId)) {
    return { added: false as const }
  }
  writeRawList(key, [...list, item])
  return { added: true as const }
}

export function removeEngagementItem(key: EngagementKey, productId: string) {
  const list = readRawList(key)
  writeRawList(
    key,
    list.filter((entry) => entry.productId !== productId)
  )
}
