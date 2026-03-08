import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma as db } from "@/lib/db"
import { getSessionUser } from "@/lib/auth"

const INVENTORY_SYNC_SETTINGS_KEY = "inventory_sync_config"

const configSchema = z.object({
  enabled: z.boolean().default(true),
  endpoint: z.string().trim().optional().default(""),
  apiKey: z.string().trim().optional().default(""),
  imageBaseUrl: z.string().trim().optional().default(""),
  timeoutMs: z.coerce.number().int().min(1000).max(120000).default(10000),
})

type InventorySyncConfig = z.infer<typeof configSchema>

function fallbackConfig(): InventorySyncConfig {
  return {
    enabled: (process.env.INVENTORY_SYNC_ENABLED || "true").toLowerCase() !== "false",
    endpoint: process.env.INVENTORY_SYNC_ENDPOINT?.trim() || "",
    apiKey: process.env.INVENTORY_SYNC_API_KEY?.trim() || "",
    imageBaseUrl: process.env.INVENTORY_SYNC_IMAGE_BASE_URL?.trim() || "",
    timeoutMs: Number(process.env.INVENTORY_SYNC_TIMEOUT_MS || 10000) || 10000,
  }
}

async function requireAdmin() {
  const user = await getSessionUser("admin")
  if (!user) return null
  return user
}

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const fallback = fallbackConfig()
  try {
    const row = await db.designSettings.findUnique({
      where: { key: INVENTORY_SYNC_SETTINGS_KEY },
      select: { config: true, updatedAt: true },
    })
    if (!row?.config) {
      return NextResponse.json({
        ...fallback,
        hasApiKey: Boolean(fallback.apiKey),
        apiKeyMasked: fallback.apiKey ? "••••••••" : "",
        updatedAt: null,
      })
    }

    const parsed = configSchema.parse(JSON.parse(row.config))
    return NextResponse.json({
      ...parsed,
      hasApiKey: Boolean(parsed.apiKey),
      apiKeyMasked: parsed.apiKey ? "••••••••" : "",
      updatedAt: row.updatedAt,
    })
  } catch (error) {
    console.error("Inventory integration GET failed:", error)
    return NextResponse.json({ error: "Failed to load integration config" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const incoming = configSchema.partial().parse(body)

    const existing = await db.designSettings.findUnique({
      where: { key: INVENTORY_SYNC_SETTINGS_KEY },
      select: { config: true },
    })

    const prev = existing?.config ? configSchema.parse(JSON.parse(existing.config)) : fallbackConfig()
    const merged: InventorySyncConfig = {
      ...prev,
      ...incoming,
      endpoint: (incoming.endpoint ?? prev.endpoint).trim(),
      apiKey: (incoming.apiKey ?? prev.apiKey).trim(),
      imageBaseUrl: (incoming.imageBaseUrl ?? prev.imageBaseUrl).trim(),
      timeoutMs: incoming.timeoutMs ?? prev.timeoutMs,
      enabled: incoming.enabled ?? prev.enabled,
    }

    const saved = await db.designSettings.upsert({
      where: { key: INVENTORY_SYNC_SETTINGS_KEY },
      create: { key: INVENTORY_SYNC_SETTINGS_KEY, config: JSON.stringify(merged) },
      update: { config: JSON.stringify(merged) },
      select: { updatedAt: true },
    })

    return NextResponse.json({
      ...merged,
      hasApiKey: Boolean(merged.apiKey),
      apiKeyMasked: merged.apiKey ? "••••••••" : "",
      updatedAt: saved.updatedAt,
    })
  } catch (error) {
    console.error("Inventory integration PATCH failed:", error)
    return NextResponse.json({ error: "Failed to save integration config" }, { status: 500 })
  }
}
