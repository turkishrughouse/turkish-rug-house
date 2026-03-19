export const ADMIN_ROLES = ["SUPER_USER", "ADMIN", "EDITOR", "MANAGER", "STAFF"] as const
export type AdminRole = (typeof ADMIN_ROLES)[number]

export const ADMIN_SECTIONS = [
  "dashboard",
  "analytics",
  "products",
  "inventory",
  "orders",
  "design",
  "pages",
  "blog",
  "messages",
  "media",
  "users",
  "settings",
] as const

export type AdminSection = (typeof ADMIN_SECTIONS)[number]

export function normalizeAdminRole(role: string | null | undefined): AdminRole | null {
  const upper = String(role || "").toUpperCase().trim()
  if (upper === "SUPER_USER" || upper === "ADMIN" || upper === "EDITOR" || upper === "MANAGER" || upper === "STAFF") {
    return upper as AdminRole
  }
  return null
}

export function isAdminRole(role: string | null | undefined): role is AdminRole {
  return normalizeAdminRole(role) !== null
}

export function canAccessAdminSection(role: string, section: string) {
  const normalized = normalizeAdminRole(role)
  if (!normalized) return false

  // SUPER_USER: full panel, all sections enabled.
  if (normalized === "SUPER_USER") {
    return (ADMIN_SECTIONS as readonly string[]).includes(section)
  }

  // Other admin roles: keep scope minimal (dashboard, products, settings).
  const allowedForStandardAdmins = ["dashboard", "products", "settings"]
  return allowedForStandardAdmins.includes(section)
}

export function canAdminAccessSection(
  user: { role?: string | null | undefined } | null | undefined,
  section: AdminSection
) {
  const role = user?.role
  if (!role || !isAdminRole(role)) return false
  return canAccessAdminSection(role, section)
}

export type PortalKey = "dealer" | "admin"

export function canAccessPortal(
  user: { role?: string | null | undefined } | null | undefined,
  portal: PortalKey
) {
  const role = user?.role
  if (!role || !isAdminRole(role)) return false

  // Keep portal rules minimal and explicit.
  if (portal === "admin") return true
  if (portal === "dealer") return true
  return false
}
