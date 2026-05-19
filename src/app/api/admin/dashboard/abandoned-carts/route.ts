import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { isAdminRole } from "@/lib/rbac"
import { getLiveVisitorEvents } from "@/lib/live-visitor-activity"

async function requireAdminUser() {
  const user = await getSessionUser("admin")
  if (!user || !isAdminRole(user.role)) return null
  return user
}

export async function GET() {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const now = Date.now()
  const abandonmentWindowMs = 30 * 60 * 1000

  const items = await getLiveVisitorEvents(2 * 60 * 60 * 1000, 200)
    .filter((event) => {
      const action = event.action.toLowerCase()
      if (!action.startsWith("added to cart")) return false
      if (event.currentPath?.startsWith("/checkout")) return false
      const eventTime = new Date(event.createdAt).getTime()
      if (Number.isNaN(eventTime)) return false
      return now - eventTime >= abandonmentWindowMs
    })
    .slice(0, 24)

  const guestCount = items.filter((item) => item.actorKey.startsWith("guest:")).length
  const customerCount = Math.max(0, items.length - guestCount)
  const lastAt = items[0]?.createdAt || null

  return NextResponse.json({
    total: items.length,
    guestCount,
    customerCount,
    lastAt,
    items: items.map((item) => ({
      id: item.id,
      actorKey: item.actorKey,
      customerName: item.customerName,
      action: item.action,
      currentPath: item.currentPath || "",
      createdAt: item.createdAt,
      isGuest: item.actorKey.startsWith("guest:"),
    })),
  })
}
