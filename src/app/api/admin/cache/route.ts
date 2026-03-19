import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth-server"
import { isAdminRole } from "@/lib/rbac"
import { runCacheCleanup } from "@/lib/cache-maintenance"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  const user = await getSessionUser("admin")
  if (!user || !isAdminRole(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    await runCacheCleanup()
    return NextResponse.json({ success: true, message: "Cache cleared." })
  } catch (error) {
    console.error("[admin/cache] clear failed:", error)
    return NextResponse.json({ error: "Failed to clear cache" }, { status: 500 })
  }
}
