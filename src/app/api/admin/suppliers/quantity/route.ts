import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdminApiAuth } from "@/lib/admin-guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const auth = await requireAdminApiAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json().catch(() => ({}))
    const prefixes = Array.isArray(body?.prefixes) ? body.prefixes : []
    const stringPrefixes = prefixes.filter((value: unknown): value is string => typeof value === "string")
    const normalizedPrefixes: string[] = Array.from(new Set(stringPrefixes
      .map((value: string) => value.trim().toUpperCase())
      .filter((value: string) => Boolean(value))))

    if (normalizedPrefixes.length === 0) {
      return NextResponse.json({ counts: {} })
    }

    const counts: Record<string, number> = {}
    for (const prefix of normalizedPrefixes) {
      const rows = await prisma.$queryRaw<Array<{ count: bigint | number }>>`
        SELECT COUNT(*) as count
        FROM "Product"
        WHERE "sku" IS NOT NULL
          AND UPPER("sku") LIKE UPPER(${`${prefix}%`})
          AND "deletedAt" IS NULL
      `
      counts[prefix] = Number(rows[0]?.count || 0)
    }

    return NextResponse.json({ counts })
  } catch (error) {
    console.error("POST /api/admin/suppliers/quantity error:", error)
    return NextResponse.json({ error: "Failed to load supplier quantities" }, { status: 500 })
  }
}
