import { normalizeFolderPath } from "@/lib/media-sku-roots"

const ROOT_PRIORITY = [
  "patchwork-recycled",
  "special-collections",
  "shop-by-region",
  "shop-by-type",
  "area-rugs",
  "categories",
  "pages",
  "profile",
] as const

const EXPLICIT_PREFIX_ALIASES = [
  ["area-rugs/patchwork-rugs", "patchwork-recycled/patchwork-rugs"],
  ["kilim-rugs", "shop-by-region"],
  ["anatolian-rugs", "shop-by-region/anatolian-kilims"],
] as const

const SORTED_EXPLICIT_PREFIX_ALIASES = [...EXPLICIT_PREFIX_ALIASES].sort((a, b) => b[0].length - a[0].length)

function byPriority(a: string, b: string) {
  const aRoot = a.split("/")[0] || a
  const bRoot = b.split("/")[0] || b
  const aIndex = ROOT_PRIORITY.indexOf(aRoot as (typeof ROOT_PRIORITY)[number])
  const bIndex = ROOT_PRIORITY.indexOf(bRoot as (typeof ROOT_PRIORITY)[number])
  const aRank = aIndex === -1 ? ROOT_PRIORITY.length : aIndex
  const bRank = bIndex === -1 ? ROOT_PRIORITY.length : bIndex

  if (aRank !== bRank) return aRank - bRank
  if (a.length !== b.length) return a.length - b.length
  return a.localeCompare(b)
}

function rewriteExplicitAlias(input: string) {
  let current = normalizeFolderPath(input)
  if (!current) return ""

  for (let i = 0; i < 10; i += 1) {
    const matchedAlias = SORTED_EXPLICIT_PREFIX_ALIASES.find(
      ([alias]) => current === alias || current.startsWith(`${alias}/`)
    )

    if (!matchedAlias) return current

    const [alias, target] = matchedAlias
    const remainder = current === alias ? "" : current.slice(alias.length + 1)
    const rewritten = normalizeFolderPath(remainder ? `${target}/${remainder}` : target)
    if (!rewritten || rewritten === current) return current
    current = rewritten
  }

  return current
}

export function buildCanonicalFolderLookup(folderNames: string[]) {
  const normalizedNames = Array.from(
    new Set(folderNames.map((name) => normalizeFolderPath(name)).filter(Boolean))
  ).sort(byPriority)

  const existingSet = new Set(normalizedNames)
  const byRemainder = new Map<string, string[]>()

  for (const name of normalizedNames) {
    const parts = name.split("/").filter(Boolean)
    if (parts.length < 2) continue
    const remainder = parts.slice(1).join("/")
    const current = byRemainder.get(remainder) || []
    current.push(name)
    current.sort(byPriority)
    byRemainder.set(remainder, current)
  }

  return { normalizedNames, existingSet, byRemainder }
}

export function resolveCanonicalFolderPath(value: string, folderNames: string[]) {
  const current = rewriteExplicitAlias(value)
  if (!current) return ""

  const { existingSet, byRemainder } = buildCanonicalFolderLookup(folderNames)
  if (existingSet.has(current)) return current

  const parts = current.split("/").filter(Boolean)
  if (parts.length >= 2) {
    const remainder = parts.slice(1).join("/")
    const matches = byRemainder.get(remainder) || []
    if (matches.length > 0) return matches[0] || current
  }

  const prefixMatch = Array.from(existingSet)
    .filter((name) => current === name || name.startsWith(`${current}/`) || current.startsWith(`${name}/`))
    .sort(byPriority)[0]

  return prefixMatch || current
}

export function listCanonicalFolderPaths(folderNames: string[]) {
  const lookup = buildCanonicalFolderLookup(folderNames)
  const canonical = new Set<string>()

  for (const name of lookup.normalizedNames) {
    canonical.add(resolveCanonicalFolderPath(name, lookup.normalizedNames))
  }

  return Array.from(canonical).sort(byPriority)
}
