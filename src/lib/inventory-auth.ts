import { redirect } from "next/navigation"
import { NextRequest, NextResponse } from "next/server"
import { getAuthCookieName, getSessionUser, shouldUseSecureCookies } from "@/lib/auth"
import { canAccessPortal, isAdminRole } from "@/lib/rbac"

export async function resolveInventorySessionUser() {
  const user = await getSessionUser("inventory")
  if (!user || !isAdminRole(user.role) || !canAccessPortal(user, "inventory")) {
    return null
  }
  return user
}

export async function requireInventoryUser() {
  const user = await resolveInventorySessionUser()
  if (!user) {
    redirect("/inventory/login")
  }
  return user
}

export async function requireInventoryApiUser(req: NextRequest) {
  const user = await resolveInventorySessionUser()
  if (!user) {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = "/inventory/login"
    loginUrl.search = ""
    const res = NextResponse.redirect(loginUrl)
    res.cookies.set(getAuthCookieName("inventory"), "", {
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureCookies(req.nextUrl.hostname),
      path: "/",
      maxAge: 0,
    })
    return {
      user: null,
      unauthorized: res,
    }
  }
  return { user, unauthorized: null as NextResponse | null }
}
