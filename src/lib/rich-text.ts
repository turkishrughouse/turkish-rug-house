function stripDangerousBlocks(input: string) {
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<meta[\s\S]*?>/gi, "")
    .replace(/<link[\s\S]*?>/gi, "")
}

function stripEventHandlers(input: string) {
  return input
    .replace(/\son[a-z]+="[^"]*"/gi, "")
    .replace(/\son[a-z]+='[^']*'/gi, "")
    .replace(/\son[a-z]+=[^\s>]+/gi, "")
}

function stripUnsafeAttributes(input: string) {
  return input
    .replace(/\s(?:class|id|dir|lang|width|height|cellpadding|cellspacing|border)=(".*?"|'.*?'|[^\s>]+)/gi, "")
    .replace(/\s(?:data-[a-z0-9_-]+|aria-[a-z0-9_-]+|role|xmlns(?::[a-z0-9_-]+)?)=(".*?"|'.*?'|[^\s>]+)/gi, "")
}

function stripOfficeMarkup(input: string) {
  return input
    .replace(/<\/?o:[^>]*>/gi, "")
    .replace(/<\/?xml[^>]*>/gi, "")
    .replace(/<\/?st1:[^>]*>/gi, "")
    .replace(/\sstyle=(["'])(.*?)\1/gi, (_, quote: string, rawStyles: string) => {
      const cleaned = rawStyles
        .split(";")
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .filter((chunk) => !/^mso-/i.test(chunk))
        .join("; ")
      return cleaned ? ` style=${quote}${cleaned}${quote}` : ""
    })
}

function stripUnsupportedTags(input: string) {
  return input.replace(/<\/?(?!a\b|b\b|blockquote\b|br\b|caption\b|code\b|col\b|colgroup\b|div\b|em\b|h[1-6]\b|hr\b|i\b|img\b|li\b|ol\b|p\b|pre\b|s\b|span\b|strike\b|strong\b|table\b|tbody\b|td\b|tfoot\b|th\b|thead\b|tr\b|u\b|ul\b)[a-z0-9:-]+[^>]*>/gi, "")
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

function normalizeBlockMarkup(input: string) {
  return input
    .replace(/<(\/?)(article|aside|figure|figcaption|footer|header|main|nav|section)\b/gi, "<$1div")
    .replace(/<(\/?)address\b/gi, "<$1p")
}

function collapseWhitespace(input: string) {
  return input
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
}

function stripEmptyNodes(input: string) {
  let current = input

  const emptyTablePattern = /<table\b[^>]*>(?:\s|&nbsp;|<tbody\b[^>]*>|<\/tbody>|<thead\b[^>]*>|<\/thead>|<tfoot\b[^>]*>|<\/tfoot>|<tr\b[^>]*>|<\/tr>|<td\b[^>]*>|<\/td>|<th\b[^>]*>|<\/th>|<colgroup\b[^>]*>|<\/colgroup>|<col\b[^>]*\/?>|<br\s*\/?>|<p\b[^>]*>\s*<\/p>|<div\b[^>]*>\s*<\/div>)*<\/table>/gi
  current = current.replace(emptyTablePattern, "")

  let previous = ""
  while (previous !== current) {
    previous = current
    current = current.replace(/<(p|div|span|strong|em|b|i|u|s|strike|blockquote|pre|code)\b[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/\1>/gi, "")
    current = current.replace(/<(td|th)\b[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/\1>/gi, "")
    current = current.replace(/<(tr|tbody|thead|tfoot)\b[^>]*>\s*<\/\1>/gi, "")
  }

  return current
}

function isMeaningfulRichText(input: string) {
  const withoutMedia = input.replace(/<(img|video|iframe|embed|object)\b[^>]*>/gi, " media ")
  const plain = withoutMedia
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()

  return plain.length > 0 || /<(img|video|iframe|embed|object)\b/i.test(input)
}

export function normalizeRichTextHtml(input: string | null | undefined) {
  const source = (input || "").trim()
  if (!source) return ""
  const safe = collapseWhitespace(
    stripEmptyNodes(
      normalizeBlockMarkup(
        stripUnsupportedTags(
          normalizeStyleAttributes(
            clampLineHeights(
              clampFontSizes(
                normalizeLegacyFontTags(
                  stripUnsafeAttributes(
                    stripOfficeMarkup(
                      stripEventHandlers(
                        stripDangerousBlocks(source)
                      )
                    )
                  )
                )
              )
            )
          )
        )
      )
    )
  ).trim()

  return isMeaningfulRichText(safe) ? safe : ""
}

export function stripHtmlForSeo(input: string | null | undefined): string {
  if (!input) return ""
  
  // 1. Remove table blocks completely since they contain tabular data not suitable for prose
  let text = input.replace(/<table[^>]*>[\s\S]*?<\/table>/gi, " ")
  
  // 2. Strip remaining HTML tags
  text = text.replace(/<[^>]*>/g, " ")
  
  // 3. Decode common HTML entities
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&copy;/gi, "©")
    .replace(/&reg;/gi, "®")
  
  // 4. Normalize whitespace
  text = text.replace(/\s+/g, " ").trim()
  
  // 4. Truncate cleanly to 160 chars
  if (text.length <= 160) return text
  
  const truncated = text.slice(0, 160)
  // Find last space to avoid broken words
  const lastSpaceIdx = truncated.lastIndexOf(" ")
  if (lastSpaceIdx > 0) {
    return truncated.slice(0, lastSpaceIdx).replace(/[.,!?]+$/, "") + "..."
  }
  return truncated + "..."
}
