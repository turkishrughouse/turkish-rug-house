export const ADMIN_ROLES = ["SUPER_USER", "ADMIN", "EDITOR", "MANAGER", "STAFF"] as const
export type AdminRole = (typeof ADMIN_ROLES)[number]

export function isAdminRole(role: string | null | undefined): role is AdminRole {
  return (
    role === "SUPER_USER" ||
    role === "ADMIN" ||
    role === "EDITOR" ||
    role === "MANAGER" ||
    role === "STAFF"
  )
}

export function canAccessAdminSection(role: string, section: string) {
  if (role === "SUPER_USER") return true
  if (role === "ADMIN") {
    return ["dashboard", "analytics", "products", "orders", "pages"].includes(section)
  }
  if (role === "EDITOR") {
    return ["dashboard", "analytics", "products"].includes(section)
  }
  if (role === "MANAGER") {
    return ["dashboard", "analytics", "products", "orders", "messages", "media", "users", "settings"].includes(section)
  }
  if (role === "STAFF") {
    return ["dashboard", "analytics", "products", "orders", "messages", "media"].includes(section)
  }
  return false
}
