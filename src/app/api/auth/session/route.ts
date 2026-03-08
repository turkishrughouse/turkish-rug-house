import { NextRequest, NextResponse } from "next/server"
import { getSessionUser, type SessionPortal } from "@/lib/auth"

export async function GET(req: NextRequest) {
  try {
    const portalParam = req.nextUrl.searchParams.get("portal")
    const portal: SessionPortal = portalParam === "admin" ? "admin" : "customer"
    const user = await getSessionUser(portal)
    if (!user) {
      return NextResponse.json({ authenticated: false })
    }
    return NextResponse.json({ authenticated: true, user })
  } catch (error) {
    console.error("Session error:", error)
    return NextResponse.json({ authenticated: false }, { status: 500 })
  }
}
