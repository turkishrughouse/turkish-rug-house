import { NextRequest, NextResponse } from "next/server"
import { getAuthCookieName, getLegacyAuthCookieName, shouldUseSecureCookies } from "@/lib/auth"

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
  const res = NextResponse.json({ success: true })
  const secure = shouldUseSecureCookies(req.nextUrl.hostname)
  clearCookie(res, getAuthCookieName("admin"), secure)
  clearCookie(res, getAuthCookieName("customer"), secure)
  clearCookie(res, getLegacyAuthCookieName(), secure)
  return res
}
