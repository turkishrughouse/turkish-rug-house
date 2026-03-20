export type AdminColorScheme =
  | "default"
  | "light"
  | "modern"
  | "blue"
  | "coffee"
  | "ectoplasm"
  | "midnight"
  | "ocean"
  | "sunrise"

export const ADMIN_SCHEME_STORAGE_KEY = "rughouse_admin_scheme"
export const ADMIN_SCHEME_COOKIE_KEY = "rughouse_admin_scheme"

export type AdminTheme = {
  sidebarBg: string
  headerBg: string
  headerText: string
  headerMuted: string
  headerHoverBg: string
  headerInputBg: string
  headerInputBorder: string
  navDivider: string
  navText: string
  navHoverBg: string
  navHoverText: string
  navActiveBg: string
  navActiveText: string
}

export const ADMIN_COLOR_SCHEMES: Array<{ id: AdminColorScheme; label: string; colors: string[] }> = [
  { id: "default", label: "Default", colors: ["#1d2327", "#2c3338", "#2271b1", "#72aee6"] },
  { id: "light", label: "Light", colors: ["#f0f0f1", "#dcdcde", "#d54e21", "#00a0d2"] },
  { id: "modern", label: "Modern", colors: ["#1e1e1e", "#3858e9", "#6c7ae0", "#72aee6"] },
  { id: "blue", label: "Blue", colors: ["#0f4c75", "#3282b8", "#5da9dd", "#8fd3ff"] },
  { id: "coffee", label: "Coffee", colors: ["#46403c", "#59524c", "#c7a589", "#9ea476"] },
  { id: "ectoplasm", label: "Ectoplasm", colors: ["#523f6d", "#a3b745", "#d46f15", "#46b450"] },
  { id: "midnight", label: "Midnight", colors: ["#25282b", "#363b3f", "#69a8bb", "#e14d43"] },
  { id: "ocean", label: "Ocean", colors: ["#627c83", "#738e96", "#9ebaa0", "#aa9d88"] },
  { id: "sunrise", label: "Sunrise", colors: ["#b43c38", "#cf4944", "#dd823b", "#ccaf0b"] },
]

export const ADMIN_THEME_MAP: Record<AdminColorScheme, AdminTheme> = {
  default: {
    sidebarBg: "#1d2327",
    headerBg: "#2c3338",
    headerText: "#ffffff",
    headerMuted: "#d1d9e0",
    headerHoverBg: "rgba(255,255,255,0.14)",
    headerInputBg: "rgba(255,255,255,0.1)",
    headerInputBorder: "rgba(255,255,255,0.28)",
    navDivider: "rgba(255,255,255,0.12)",
    navText: "#c3c4c7",
    navHoverBg: "#2f3a40",
    navHoverText: "#ffffff",
    navActiveBg: "#2271b1",
    navActiveText: "#ffffff",
  },
  light: {
    sidebarBg: "#f1f5f9",
    headerBg: "#ffffff",
    headerText: "#0f172a",
    headerMuted: "#64748b",
    headerHoverBg: "#eef2f7",
    headerInputBg: "#ffffff",
    headerInputBorder: "#dce3ed",
    navDivider: "#dce3ed",
    navText: "#334155",
    navHoverBg: "#e2e8f0",
    navHoverText: "#0f172a",
    navActiveBg: "#dbeafe",
    navActiveText: "#0f172a",
  },
  modern: {
    sidebarBg: "#1e1e1e",
    headerBg: "#23282d",
    headerText: "#f8fafc",
    headerMuted: "#cbd5e1",
    headerHoverBg: "rgba(255,255,255,0.12)",
    headerInputBg: "rgba(255,255,255,0.08)",
    headerInputBorder: "rgba(255,255,255,0.24)",
    navDivider: "rgba(255,255,255,0.12)",
    navText: "#f0f6fc",
    navHoverBg: "#2f3742",
    navHoverText: "#ffffff",
    navActiveBg: "#3858e9",
    navActiveText: "#ffffff",
  },
  blue: {
    sidebarBg: "#0f4c75",
    headerBg: "#3282b8",
    headerText: "#f8fbff",
    headerMuted: "#e0f1ff",
    headerHoverBg: "rgba(255,255,255,0.16)",
    headerInputBg: "rgba(255,255,255,0.14)",
    headerInputBorder: "rgba(255,255,255,0.34)",
    navDivider: "rgba(255,255,255,0.2)",
    navText: "#e7f3ff",
    navHoverBg: "#25628c",
    navHoverText: "#ffffff",
    navActiveBg: "#5da9dd",
    navActiveText: "#0b2f4a",
  },
  coffee: {
    sidebarBg: "#46403c",
    headerBg: "#59524c",
    headerText: "#fff7ee",
    headerMuted: "#f0dfcf",
    headerHoverBg: "rgba(255,255,255,0.14)",
    headerInputBg: "rgba(255,255,255,0.1)",
    headerInputBorder: "rgba(255,255,255,0.3)",
    navDivider: "rgba(255,255,255,0.16)",
    navText: "#f4eee8",
    navHoverBg: "#665e57",
    navHoverText: "#ffffff",
    navActiveBg: "#c7a589",
    navActiveText: "#2f241b",
  },
  ectoplasm: {
    sidebarBg: "#523f6d",
    headerBg: "#614a80",
    headerText: "#f8f5ff",
    headerMuted: "#e6defa",
    headerHoverBg: "rgba(255,255,255,0.14)",
    headerInputBg: "rgba(255,255,255,0.1)",
    headerInputBorder: "rgba(255,255,255,0.3)",
    navDivider: "rgba(255,255,255,0.16)",
    navText: "#efe9ff",
    navHoverBg: "#74599a",
    navHoverText: "#ffffff",
    navActiveBg: "#a3b745",
    navActiveText: "#1f2e06",
  },
  midnight: {
    sidebarBg: "#25282b",
    headerBg: "#363b3f",
    headerText: "#f8fafc",
    headerMuted: "#d4dbe3",
    headerHoverBg: "rgba(255,255,255,0.14)",
    headerInputBg: "rgba(255,255,255,0.1)",
    headerInputBorder: "rgba(255,255,255,0.3)",
    navDivider: "rgba(255,255,255,0.16)",
    navText: "#f5f7fa",
    navHoverBg: "#495158",
    navHoverText: "#ffffff",
    navActiveBg: "#69a8bb",
    navActiveText: "#0f2530",
  },
  ocean: {
    sidebarBg: "#627c83",
    headerBg: "#738e96",
    headerText: "#f7fbfc",
    headerMuted: "#e5f0f3",
    headerHoverBg: "rgba(255,255,255,0.16)",
    headerInputBg: "rgba(255,255,255,0.12)",
    headerInputBorder: "rgba(255,255,255,0.34)",
    navDivider: "rgba(255,255,255,0.2)",
    navText: "#f1f7f8",
    navHoverBg: "#537179",
    navHoverText: "#ffffff",
    navActiveBg: "#9ebaa0",
    navActiveText: "#243536",
  },
  sunrise: {
    sidebarBg: "#b43c38",
    headerBg: "#cf4944",
    headerText: "#fff8f5",
    headerMuted: "#ffe1d5",
    headerHoverBg: "rgba(255,255,255,0.16)",
    headerInputBg: "rgba(255,255,255,0.12)",
    headerInputBorder: "rgba(255,255,255,0.34)",
    navDivider: "rgba(255,255,255,0.2)",
    navText: "#fff4ed",
    navHoverBg: "#d85f47",
    navHoverText: "#ffffff",
    navActiveBg: "#dd823b",
    navActiveText: "#3d1600",
  },
}

export function getAdminTheme(scheme: string | null | undefined): AdminTheme {
  if (!scheme) return ADMIN_THEME_MAP.light
  const key = scheme as AdminColorScheme
  return ADMIN_THEME_MAP[key] || ADMIN_THEME_MAP.light
}

export function isAdminColorScheme(value: string | null | undefined): value is AdminColorScheme {
  if (!value) return false
  return value in ADMIN_THEME_MAP
}

export function persistAdminColorScheme(scheme: string | null | undefined): void {
  if (typeof window === "undefined" || !isAdminColorScheme(scheme)) return
  window.localStorage.setItem(ADMIN_SCHEME_STORAGE_KEY, scheme)
  document.cookie = `${ADMIN_SCHEME_COOKIE_KEY}=${scheme}; path=/; max-age=31536000; samesite=lax`
}

export function applyAdminThemeToElement(target: HTMLElement, scheme: string | null | undefined): void {
  const theme = getAdminTheme(scheme)
  target.style.setProperty("--admin-sidebar-bg", theme.sidebarBg)
  target.style.setProperty("--admin-header-bg", theme.headerBg)
  target.style.setProperty("--admin-header-text", theme.headerText)
  target.style.setProperty("--admin-header-muted", theme.headerMuted)
  target.style.setProperty("--admin-header-hover-bg", theme.headerHoverBg)
  target.style.setProperty("--admin-header-input-bg", theme.headerInputBg)
  target.style.setProperty("--admin-header-input-border", theme.headerInputBorder)
  target.style.setProperty("--admin-nav-divider", theme.navDivider)
  target.style.setProperty("--admin-nav-text", theme.navText)
  target.style.setProperty("--admin-nav-hover-bg", theme.navHoverBg)
  target.style.setProperty("--admin-nav-hover-text", theme.navHoverText)
  target.style.setProperty("--admin-nav-active-bg", theme.navActiveBg)
  target.style.setProperty("--admin-nav-active-text", theme.navActiveText)
}
