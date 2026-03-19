import { redirect } from "next/navigation"
import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth-server"
import { isAdminRole } from "@/lib/rbac"

function canAccessDealerPortal(user: { role: string; adminPermissions?: string | null } | null | undefined) {
  if (!user || !isAdminRole(user.role)) return false
  return true
}

export async function requireDealerUser() {
  const user = await getSessionUser("dealer")
  if (!canAccessDealerPortal(user)) {
    redirect("/dealer/login")
  }
  return user
}

export async function requireDealerApiUser(req: NextRequest) {
  const user = await getSessionUser("dealer")
  if (!canAccessDealerPortal(user)) {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = "/dealer/login"
    loginUrl.search = ""
    return {
      user: null,
      unauthorized: NextResponse.redirect(loginUrl),
    }
  }
  return { user, unauthorized: null as NextResponse | null }
}
