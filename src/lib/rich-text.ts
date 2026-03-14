function stripDangerousBlocks(input: string) {
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
}

function stripEventHandlers(input: string) {
  return input.replace(/\son[a-z]+="[^"]*"/gi, "").replace(/\son[a-z]+='[^']*'/gi, "")
}

function clampFontSizeValue(rawValue: string, unit: string) {
  const value = Number(rawValue)
  if (!Number.isFinite(value)) return null
  const safeValue = Math.min(32, Math.max(12, value))
  return `${safeValue}${unit}`
}

function clampFontSizes(input: string) {
  return input.replace(/font-size\s*:\s*(\d+(?:\.\d+)?)(px|pt|rem|em)/gi, (_, rawValue: string, unit: string) => {
    const safeValue = clampFontSizeValue(rawValue, unit)
    if (!safeValue) return ""
    return `font-size:${safeValue}`
  })
}

function clampLineHeights(input: string) {
  return input.replace(/line-height\s*:\s*(\d+(?:\.\d+)?)(px|pt|rem|em|%|)/gi, (_, rawValue: string, unit: string) => {
    const value = Number(rawValue)
    if (!Number.isFinite(value)) return ""
    if (unit === "%") {
      const safePercent = Math.min(180, Math.max(120, value))
      return `line-height:${safePercent}%`
    }
    if (!unit) {
      const safeUnitless = Math.min(1.8, Math.max(1.2, value))
      return `line-height:${safeUnitless}`
    }
    const safeValue = Math.min(40, Math.max(14, value))
    return `line-height:${safeValue}${unit}`
  })
}

function normalizeLegacyFontTags(input: string) {
  return input
    .replace(/<font\b([^>]*)size=["']?(\d+)["']?([^>]*)>/gi, (_, before: string, rawSize: string, after: string) => {
      const mappedSize = clampFontSizeValue(String(8 + Number(rawSize) * 4), "px") || "16px"
      return `<span${before}${after} style="font-size:${mappedSize}">`
    })
    .replace(/<\/font>/gi, "</span>")
}

function normalizeStyleAttributes(input: string) {
  const allowedStyles = new Set([
    "font-size",
    "line-height",
    "text-align",
    "font-weight",
    "font-style",
    "text-decoration",
    "color",
    "background-color",
  ])

  return input.replace(/style=(["'])(.*?)\1/gi, (_, quote: string, rawStyles: string) => {
    const normalized = rawStyles
      .split(";")
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk) => {
        const separatorIndex = chunk.indexOf(":")
        if (separatorIndex === -1) return null
        const property = chunk.slice(0, separatorIndex).trim().toLowerCase()
        const value = chunk.slice(separatorIndex + 1).trim()
        if (!allowedStyles.has(property) || !value) return null
        if (property === "font-size") {
          const match = value.match(/^(\d+(?:\.\d+)?)(px|pt|rem|em)$/i)
          if (!match) return null
          const safeValue = clampFontSizeValue(match[1], match[2].toLowerCase())
          return safeValue ? `font-size:${safeValue}` : null
        }
        if (property === "line-height") {
          const safe = clampLineHeights(`line-height:${value}`).replace(/^line-height:/, "")
          return safe ? `line-height:${safe}` : null
        }
        return `${property}:${value}`
      })
      .filter((value): value is string => Boolean(value))
      .join("; ")

    return normalized ? `style=${quote}${normalized}${quote}` : ""
  })
}

export function normalizeRichTextHtml(input: string | null | undefined) {
  const source = (input || "").trim()
  if (!source) return ""
  const safe = normalizeStyleAttributes(
    clampLineHeights(clampFontSizes(normalizeLegacyFontTags(stripEventHandlers(stripDangerousBlocks(source)))))
  )
  return safe
}
