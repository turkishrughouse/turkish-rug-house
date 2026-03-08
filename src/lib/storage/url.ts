const UPLOAD_PREFIX = "/uploads/"

function getPublicBaseUrl() {
  const value =
    process.env.NEXT_PUBLIC_UPLOAD_PUBLIC_BASE_URL ||
    process.env.UPLOAD_PUBLIC_BASE_URL ||
    ""
  return value.trim().replace(/\/+$/, "")
}

export function getImageUrl(urlOrPath: string | null | undefined) {
  const value = (urlOrPath || "").trim()
  if (!value) return ""
  if (value.startsWith("http://") || value.startsWith("https://")) return value
  const uploadsIndex = value.indexOf(UPLOAD_PREFIX)
  if (uploadsIndex >= 0) {
    const relative = value.slice(uploadsIndex + UPLOAD_PREFIX.length).replace(/^\/+/, "")
    const base = getPublicBaseUrl()
    return base ? `${base}${UPLOAD_PREFIX}${relative}` : `${UPLOAD_PREFIX}${relative}`
  }
  return value
}

export function isManagedUploadUrl(urlOrPath: string | null | undefined) {
  const value = (urlOrPath || "").trim()
  if (!value) return false
  return value.includes(UPLOAD_PREFIX)
}
