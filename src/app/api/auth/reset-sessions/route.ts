import { NextResponse } from "next/server"
import { getAuthCookieName, getLegacyAuthCookieName } from "@/lib/auth"

function clearCookie(res: NextResponse, cookieName: string) {
  res.cookies.set(cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })
}

export async function POST() {
  const res = NextResponse.json({ success: true })
  clearCookie(res, getAuthCookieName("admin"))
  clearCookie(res, getAuthCookieName("customer"))
  clearCookie(res, getLegacyAuthCookieName())
  return res
}

