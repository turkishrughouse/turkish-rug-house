import { redirect } from "next/navigation"
import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { canAccessAdminSection } from "@/lib/rbac"

export async function requireAdminRoles(roles: string[]) {
  const user = await getSessionUser("admin")
  if (!user) {
    redirect("/rughouse/login")
  }
  if (!roles.includes(user.role)) {
    redirect("/rughouse/login")
  }
  return user
}

export async function requireAdminSection(section: string) {
  const user = await getSessionUser("admin")
  if (!user) {
    redirect("/rughouse/login")
  }
  if (!canAccessAdminSection(user.role, section)) {
    redirect("/rughouse/login")
  }
  return user
}

const ADMIN_ROLES = ["SUPER_USER", "ADMIN", "EDITOR", "MANAGER", "STAFF"]

export async function requireAdminApiAuth(roles: string[] = ADMIN_ROLES) {
  const user = await getSessionUser("admin")
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!roles.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  return { user }
}
