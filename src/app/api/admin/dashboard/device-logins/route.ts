import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { isAdminRole } from "@/lib/rbac"
import { getLiveVisitorDeviceEvents } from "@/lib/live-visitor-activity"

async function requireAdminUser() {
  const user = await getSessionUser("admin")
  if (!user || !isAdminRole(user.role)) return null
  return user
}

export async function GET() {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const items = getLiveVisitorDeviceEvents(60 * 60 * 1000, 60)

  const browserCounts = new Map<string, number>()
  const deviceCounts = new Map<string, number>()
  for (const item of items) {
    browserCounts.set(item.browser, (browserCounts.get(item.browser) || 0) + 1)
    deviceCounts.set(item.device, (deviceCounts.get(item.device) || 0) + 1)
  }

  return NextResponse.json({
    total: items.length,
    topBrowsers: Array.from(browserCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, count]) => ({ label, count })),
    topDevices: Array.from(deviceCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, count]) => ({ label, count })),
    items: items.map((item) => ({
      id: item.id,
      actorKey: item.actorKey,
      name: item.customerName,
      browser: item.browser,
      device: item.device,
      country: item.countryName,
      currentPath: item.currentPath || "",
      createdAt: item.createdAt,
    })),
  })
}
