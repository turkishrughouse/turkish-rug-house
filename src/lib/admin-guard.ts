import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth-server"
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
    redirect(user.role === "SUPER_USER" ? "/superuser" : "/admin")
  }
  return user
}
