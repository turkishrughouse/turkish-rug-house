export function getSiteUrl() {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.SITE_URL ||
    process.env.APP_URL ||
    "https://turkishrughouse.com"

  const normalized = configured.replace(/\/+$/, "")
  if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(normalized)) {
    return "https://turkishrughouse.com"
  }

  return normalized
}

export function toAbsoluteSiteUrl(path: string) {
  if (!path) return getSiteUrl()
  if (path.startsWith("http://") || path.startsWith("https://")) return path
  return `${getSiteUrl()}${path.startsWith("/") ? path : `/${path}`}`
}
