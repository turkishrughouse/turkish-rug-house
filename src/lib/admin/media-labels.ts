type MediaLikeAsset = {
  name: string
  usedIn?: string | null
}

const DUPLICATE_PREFIX_PATTERN = /^(copy(?:[\s_-]+of)?[\s_-]+)+/i

export function stripDuplicateMediaPrefix(value: string | null | undefined) {
  const clean = (value || "").replace(/\s+/g, " ").trim()
  if (!clean) return ""
  return clean.replace(DUPLICATE_PREFIX_PATTERN, "").trim()
}

export function normalizeMediaTitleForBaseName(title: string | null | undefined) {
  return stripDuplicateMediaPrefix(title)
}

export function prettifyAdminMediaLabel(asset: MediaLikeAsset) {
  const productMatch = (asset.usedIn || "").match(/^Product featured:\s*(.+)$/i)
  if (productMatch?.[1]) {
    return stripDuplicateMediaPrefix(productMatch[1]) || productMatch[1].trim()
  }

  const raw = stripDuplicateMediaPrefix(
    (asset.name || "")
      .replace(/\.(avif|webp|png|jpe?g|gif)$/i, "")
      .replace(/-(thumb|large|master)$/i, "")
      .replace(/[-_]+/g, " ")
      .trim()
  )

  if (!raw) return asset.name

  return raw
    .split(" ")
    .filter(Boolean)
    .map((part) => (/^[A-Z0-9]+$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ")
}
