function stripDangerousBlocks(input: string) {
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
}

function stripEventHandlers(input: string) {
  return input.replace(/\son[a-z]+="[^"]*"/gi, "").replace(/\son[a-z]+='[^']*'/gi, "")
}

function clampFontSizes(input: string) {
  return input.replace(/font-size\s*:\s*(\d+(?:\.\d+)?)(px|pt|rem|em)/gi, (_, rawValue: string, unit: string) => {
    const value = Number(rawValue)
    if (!Number.isFinite(value)) return ""
    const safeValue = Math.min(32, Math.max(12, value))
    return `font-size:${safeValue}${unit}`
  })
}

export function normalizeRichTextHtml(input: string | null | undefined) {
  const source = (input || "").trim()
  if (!source) return ""
  const safe = clampFontSizes(stripEventHandlers(stripDangerousBlocks(source)))
  return safe
}
