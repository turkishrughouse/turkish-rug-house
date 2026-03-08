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

  const items = getLiveVisitorEvents(60 * 60 * 1000, 200)
    .filter((event) => event.action.toLowerCase().startsWith("added to cart"))
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
