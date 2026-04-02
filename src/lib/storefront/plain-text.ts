const ENTITY_MAP: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
}

function decodeHtmlEntities(input: string) {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (_, entity: string) => {
    const normalized = entity.toLowerCase()
    if (normalized in ENTITY_MAP) return ENTITY_MAP[normalized]
    if (normalized.startsWith("#x")) {
      const parsed = Number.parseInt(normalized.slice(2), 16)
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : " "
    }
    if (normalized.startsWith("#")) {
      const parsed = Number.parseInt(normalized.slice(1), 10)
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : " "
    }
    return " "
  })
}

export function toPlainTextSnippet(input: string | null | undefined) {
  if (!input) return ""
  return decodeHtmlEntities(input)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}
