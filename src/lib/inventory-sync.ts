import { prisma as db } from "@/lib/db"

type InventoryCategory = {
  id: string
  slug: string
  title: string
}

type InventorySyncInput = {
  event: "created" | "updated"
  product: {
    id: string
    slug: string
    title: string
    description?: string | null
    sku?: string | null
    price: number
    compareAtPrice?: number | null
    stockCount: number
    isStock: boolean
    isPublished: boolean
    isFeatured: boolean
    seoTitle?: string | null
    seoDescription?: string | null
    seoKeywords?: string | null
    images: string[]
    customAttributes?: Array<{ name: string; values: string[]; visible: boolean }>
    suppliers?: Array<{ name: string; number: string; company: string; phone: string; note: string }>
    categories: InventoryCategory[]
  }
}

type InventorySyncConfig = {
  enabled: boolean
  endpoint: string
  apiKey: string
  imageBaseUrl: string
  timeoutMs: number
}

const INVENTORY_SYNC_SETTINGS_KEY = "inventory_sync_config"

function normalizeBaseUrl(input?: string | null) {
  if (!input) return ""
  return input.endsWith("/") ? input.slice(0, -1) : input
}

function absolutizeImageUrl(url: string, imageBaseUrl?: string) {
  if (!url) return url
  if (/^https?:\/\//i.test(url)) return url

  const base =
    normalizeBaseUrl(imageBaseUrl) ||
    normalizeBaseUrl(process.env.INVENTORY_SYNC_IMAGE_BASE_URL) ||
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL)

  if (!base) return url
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`
}

async function getInventorySyncConfig(): Promise<InventorySyncConfig> {
  const fallback: InventorySyncConfig = {
    enabled: (process.env.INVENTORY_SYNC_ENABLED || "true").toLowerCase() !== "false",
    endpoint: process.env.INVENTORY_SYNC_ENDPOINT?.trim() || "",
    apiKey: process.env.INVENTORY_SYNC_API_KEY?.trim() || "",
    imageBaseUrl: process.env.INVENTORY_SYNC_IMAGE_BASE_URL?.trim() || "",
    timeoutMs: Number(process.env.INVENTORY_SYNC_TIMEOUT_MS || 10000) || 10000,
  }

  try {
    const row = await db.designSettings.findUnique({
      where: { key: INVENTORY_SYNC_SETTINGS_KEY },
      select: { config: true },
    })
    if (!row?.config) return fallback

    const parsed = JSON.parse(row.config) as Partial<InventorySyncConfig>
    return {
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : fallback.enabled,
      endpoint: typeof parsed.endpoint === "string" ? parsed.endpoint.trim() : fallback.endpoint,
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey.trim() : fallback.apiKey,
      imageBaseUrl: typeof parsed.imageBaseUrl === "string" ? parsed.imageBaseUrl.trim() : fallback.imageBaseUrl,
      timeoutMs:
        typeof parsed.timeoutMs === "number" && Number.isFinite(parsed.timeoutMs)
          ? parsed.timeoutMs
          : fallback.timeoutMs,
    }
  } catch {
    return fallback
  }
}

export async function syncProductToInventory(input: InventorySyncInput) {
  const cfg = await getInventorySyncConfig()
  const endpoint = cfg.endpoint
  if (!endpoint) return { skipped: true as const, reason: "missing_endpoint" }

  if (!cfg.enabled) return { skipped: true as const, reason: "disabled" }

  const timeoutMs = cfg.timeoutMs
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : 10000)

  try {
    const apiKey = cfg.apiKey
    const payload = {
      source: "rughouse",
      event: input.event,
      occurredAt: new Date().toISOString(),
      product: {
        ...input.product,
        images: input.product.images.map((url) => absolutizeImageUrl(url, cfg.imageBaseUrl)),
      },
    }

    const headers: Record<string, string> = {
      "content-type": "application/json",
    }
    if (apiKey) {
      headers.authorization = `Bearer ${apiKey}`
      headers["x-api-key"] = apiKey
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
        cache: "no-store",
      })

      if (!response.ok) {
        const body = await response.text().catch(() => "")
        return {
          skipped: false as const,
          success: false as const,
          error: `Inventory sync failed (${response.status}): ${body.slice(0, 500)}`,
        }
      }

      return { skipped: false as const, success: true as const }
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.name === "AbortError"
            ? `Inventory sync timed out after ${timeoutMs}ms`
            : error.message
          : "Unknown inventory sync error"

      return {
        skipped: false as const,
        success: false as const,
        error: reason,
      }
    }
  } finally {
    clearTimeout(timeout)
  }
}
