import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdminApiAuth } from "@/lib/admin-guard"

export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireAdminApiAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const customerMessages = await prisma.message.findMany({
      where: {
        source: "CUSTOMER",
        deletedAt: null,
      },
      select: {
        metadata: true,
      },
    })

    const counts = new Map<string, number>()
    customerMessages.forEach((message) => {
      let country = "Unknown"
      if (message.metadata) {
        try {
          const parsed = JSON.parse(message.metadata) as { country?: string }
          const value = (parsed.country || "").trim()
          if (value) country = value
        } catch {
          // ignore malformed metadata payloads
        }
      }
      counts.set(country, (counts.get(country) || 0) + 1)
    })

    let data = Array.from(counts.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country))

    if (data.length === 0) {
      data = [{ country: "Unknown", count: 0 }]
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error("Country message stats error:", error)
    return NextResponse.json({ error: "Failed to fetch country stats" }, { status: 500 })
  }
}
