import { looksLikeProductSkuSegment } from "@/lib/media-sku-roots"

const INTERNAL_MEDIA_ROOTS = new Set([
  ".cache",
  "cache",
  "categories",
  "pages",
  "profile",
  "learn",
  "collections",
  "cushion-covers",
  "pillow-covers",
])

type DropdownTree = {
  topFolders: string[]
  subfoldersByTop: Map<string, string[]>
}

export function buildMediaDropdownTree(folderNames: string[]): DropdownTree {
  const subfoldersByTop = new Map<string, Set<string>>()

  for (const folderName of folderNames) {
    const parts = folderName.split("/").filter(Boolean)
    const top = parts[0] || ""
    const directChild = parts[1] || ""

    if (!top || INTERNAL_MEDIA_ROOTS.has(top)) continue

    if (!subfoldersByTop.has(top)) subfoldersByTop.set(top, new Set())

    if (!directChild || looksLikeProductSkuSegment(directChild)) continue
    subfoldersByTop.get(top)?.add(`${top}/${directChild}`)
  }

  const topFolders = Array.from(subfoldersByTop.keys()).sort((a, b) => a.localeCompare(b))
  const normalizedSubfoldersByTop = new Map<string, string[]>(
    Array.from(subfoldersByTop.entries()).map(([top, children]) => [
      top,
      Array.from(children).sort((a, b) => a.localeCompare(b)),
    ])
  )

  return {
    topFolders,
    subfoldersByTop: normalizedSubfoldersByTop,
  }
}
