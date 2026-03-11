export const PRODUCT_SKU_FOLDER_ROOTS = ["by-type", "cushion-covers", "by-age", "by-area"] as const

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

export function shouldUseProductSkuFolder(folderPath: string) {
  const safePath = normalizeFolderPath(folderPath)
  if (!safePath) return false
  const parts = safePath.split("/").filter(Boolean)
  if (parts.length < 2) return false
  return PRODUCT_SKU_FOLDER_ROOTS.includes(parts[0] as (typeof PRODUCT_SKU_FOLDER_ROOTS)[number])
}
