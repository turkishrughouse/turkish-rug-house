import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth-server"
import { canAdminAccessSection, isAdminRole, type AdminSection } from "@/lib/rbac"

export async function requireAdminApiUser(section?: AdminSection) {
  const user = await getSessionUser("admin")
  if (!user || !isAdminRole(user.role)) {
    return {
      user: null,
      unauthorized: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }
  if (section && !canAdminAccessSection(user, section)) {
    return {
      user,
      unauthorized: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }

  return {
    user,
    unauthorized: null,
  }
}
