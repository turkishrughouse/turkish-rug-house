import { NextRequest, NextResponse } from "next/server"
import { getAuthCookieName, getLegacyAuthCookieName, type SessionPortal } from "@/lib/auth"

function clearCookie(res: NextResponse, cookieName: string) {
  res.cookies.set(cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })
}

export async function POST(req: NextRequest) {
  const portalParam = req.nextUrl.searchParams.get("portal")
  const portal: SessionPortal | null =
    portalParam === "admin" || portalParam === "customer" ? portalParam : null
  const res = NextResponse.json({ success: true })

  if (portal) {
    clearCookie(res, getAuthCookieName(portal))
    if (portal === "admin") clearCookie(res, getLegacyAuthCookieName())
    return res
  }

  clearCookie(res, getAuthCookieName("admin"))
  clearCookie(res, getAuthCookieName("customer"))
  clearCookie(res, getLegacyAuthCookieName())
  return res
}
