import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth"

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
