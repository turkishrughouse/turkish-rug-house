const NON_PRODUCT_MEDIA_ROOTS = new Set(["categories", "pages", "profile"])

function sanitizeSegment(segment: string) {
  return segment
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function normalizeFolderPath(input: string) {
  return (input || "")
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => sanitizeSegment(segment))
    .filter((segment) => segment.length > 0)
    .join("/")
}

export function looksLikeProductSkuSegment(value: string) {
  const clean = (value || "").trim()
  if (/^\d{5,}$/i.test(clean)) return true
  return /[0-9]/.test(clean) && /^[A-Z0-9-]{5,}$/i.test(clean)
}

export function isProductSkuFolderPath(folderPath: string) {
  const safePath = normalizeFolderPath(folderPath)
  if (!safePath) return false
  const parts = safePath.split("/").filter(Boolean)
  if (parts.length < 2) return false
  if (NON_PRODUCT_MEDIA_ROOTS.has(parts[0] || "")) return false
  return looksLikeProductSkuSegment(parts[parts.length - 1] || "")
}

export function shouldUseProductSkuChildFolders(folderPath: string) {
  const safePath = normalizeFolderPath(folderPath)
  if (!safePath) return false
  const parts = safePath.split("/").filter(Boolean)
  if (parts.length < 1) return false
  if (NON_PRODUCT_MEDIA_ROOTS.has(parts[0] || "")) return false
  return !isProductSkuFolderPath(safePath)
}
