const CANONICAL_MEDIA_ROOTS = new Set([
  "shop-by-type",
  "shop-by-region",
  "area-rugs",
  "patchwork-recycled",
  "categories",
  "pages",
  "profile",
])

const EXPLICIT_FOLDER_ALIASES = new Map<string, string>([
  ["anatolian-rugs", "shop-by-region/anatolian-kilims"],
])

const EXPLICIT_ROOT_ALIASES = new Map<string, string>([
  ["kilim-rugs", "shop-by-region"],
])

function normalizeFolderPath(value: string) {
  return (value || "").trim().replace(/^\/+|\/+$/g, "")
}

function applyExplicitAliases(value: string) {
  const normalized = normalizeFolderPath(value)
  if (!normalized) return ""
  const exact = EXPLICIT_FOLDER_ALIASES.get(normalized)
  if (exact) return exact

  const [root, ...rest] = normalized.split("/")
  const mappedRoot = EXPLICIT_ROOT_ALIASES.get(root || "")
  if (!mappedRoot) return normalized
  return [mappedRoot, ...rest].filter(Boolean).join("/")
}

export function buildCanonicalFolderLookup(folderNames: string[]) {
  const normalizedFolders = Array.from(
    new Set(folderNames.map((folder) => normalizeFolderPath(folder)).filter(Boolean))
  )

  const lookup = new Map<string, string>()
  for (const folder of normalizedFolders) {
    lookup.set(folder, folder)
  }

  const groups = new Map<string, string[]>()
  for (const folder of normalizedFolders) {
    const parts = folder.split("/").filter(Boolean)
    const remainder = parts.slice(1).join("/")
    const groupKey = remainder || `__root__:${parts[0] || folder}`
    const list = groups.get(groupKey) || []
    list.push(folder)
    groups.set(groupKey, list)
  }

  for (const candidates of groups.values()) {
    const canonical =
      candidates.find((folder) => CANONICAL_MEDIA_ROOTS.has(folder.split("/")[0] || "")) ||
      candidates[0]
    for (const folder of candidates) {
      lookup.set(folder, canonical)
    }
  }

  for (const folder of normalizedFolders) {
    lookup.set(folder, applyExplicitAliases(lookup.get(folder) || folder))
  }

  let changed = true
  while (changed) {
    changed = false
    for (const [folder, mapped] of lookup.entries()) {
      const next = applyExplicitAliases(lookup.get(mapped) || mapped)
      if (next !== mapped) {
        lookup.set(folder, next)
        changed = true
      }
    }
  }

  return lookup
}

export function resolveCanonicalFolderPath(value: string, folderNames: string[]) {
  const normalized = normalizeFolderPath(value)
  if (!normalized) return normalized

  const lookup = buildCanonicalFolderLookup(folderNames)
  let current = applyExplicitAliases(lookup.get(normalized) || normalized)

  for (let index = 0; index < 5; index += 1) {
    const next = applyExplicitAliases(lookup.get(current) || current)
    if (next === current) break
    current = next
  }

  return current
}

export function listCanonicalFolderPaths(folderNames: string[]) {
  return Array.from(
    new Set(
      folderNames
        .map((folder) => resolveCanonicalFolderPath(folder, folderNames))
        .filter(Boolean)
    )
  )
}
