import { NextRequest, NextResponse } from "next/server"
import { getAuthCookieName, getLegacyAuthCookieName, shouldUseSecureCookies, type SessionPortal } from "@/lib/auth"

function clearCookie(res: NextResponse, cookieName: string, secure: boolean) {
  res.cookies.set(cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 0,
  })
}

export async function POST(req: NextRequest) {
  const portalParam = req.nextUrl.searchParams.get("portal")
  const portal: SessionPortal | null =
    portalParam === "admin" || portalParam === "customer" ? portalParam : null
  const res = NextResponse.json({ success: true })
  const secure = shouldUseSecureCookies(req.nextUrl.hostname)

  if (portal) {
    clearCookie(res, getAuthCookieName(portal), secure)
    if (portal === "admin") clearCookie(res, getLegacyAuthCookieName(), secure)
    return res
  }

  clearCookie(res, getAuthCookieName("admin"), secure)
  clearCookie(res, getAuthCookieName("customer"), secure)
  clearCookie(res, getLegacyAuthCookieName(), secure)
  return res
}
