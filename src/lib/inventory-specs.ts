export type ProductSpecKey =
  | "origin"
  | "material"
  | "size"
  | "age"
  | "condition"
  | "pile"
  | "knotDensity"
  | "sku"
  | "mainColor"
  | "shape"
  | "productType"
  | "feetInch"
  | "totalM2"

export type ProductSpecs = Record<ProductSpecKey, string | null>

export type InventorySpecKey =
  | "origin"
  | "material"
  | "size"
  | "age"
  | "condition"
  | "pile"
  | "knotDensity"

export type InventorySpecs = Record<InventorySpecKey, string | null>

const EMPTY_SPECS: ProductSpecs = {
  origin: null,
  material: null,
  size: null,
  age: null,
  condition: null,
  pile: null,
  knotDensity: null,
  sku: null,
  mainColor: null,
  shape: null,
  productType: null,
  feetInch: null,
  totalM2: null,
}

const FIELD_LABELS: Record<ProductSpecKey, string[]> = {
  origin: ["origin", "country of origin"],
  material: ["material", "materials"],
  size: ["size", "dimensions", "dimension"],
  age: ["age", "age/circa", "circa"],
  condition: ["condition", "rug condition"],
  pile: ["pile"],
  knotDensity: ["knot density", "knot-density", "knotdensity"],
  sku: ["sku", "stock code", "stockcode"],
  mainColor: ["main color", "main-color", "color"],
  shape: ["shape"],
  productType: ["product type", "product-type", "type"],
  feetInch: ["feet / inch", "feet/inch", "feet inch"],
  totalM2: ["total m2", "total m²", "m2", "m²"],
}

type SpecRule = {
  key: ProductSpecKey
  labels: string[]
  sanitize: (value: string) => string | null
}

function decodeHtmlEntities(input: string) {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => {
      const value = Number(code)
      return Number.isFinite(value) ? String.fromCharCode(value) : ""
    })
}

function stripUnsafeHtml(input: string) {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
}

function normalizeWhitespace(input: string) {
  return String(input || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function normalizeLabel(input: string) {
  return String(input || "")
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[:\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function cleanText(input: string) {
  return normalizeWhitespace(
    decodeHtmlEntities(String(input || ""))
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s*\n\s*/g, " ")
}

function normalizeDescriptionToLines(input: string | null | undefined) {
  if (!input || typeof input !== "string") return [] as string[]

  const normalized = stripUnsafeHtml(decodeHtmlEntities(input))
    .replace(/<(br|hr)\s*\/?>/gi, "\n")
    .replace(/<(li|p|div|section|article|tr|dt|dd|h[1-6])[^>]*>/gi, "\n")
    .replace(/<\/(li|p|div|section|article|tr|dt|dd|h[1-6]|ul|ol|table|tbody|thead|tfoot)>/gi, "\n")
    .replace(/<(strong|b|em|i|span)[^>]*>/gi, "")
    .replace(/<\/(strong|b|em|i|span)>/gi, "")
    .replace(/<\/t[dh]>\s*<t[dh][^>]*>/gi, " : ")
    .replace(/<(td|th)[^>]*>/gi, "")
    .replace(/[•·]/g, "\n")
    .replace(/<[^>]+>/g, " ")

  return normalizeWhitespace(normalized)
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
}

function splitLineIntoSegments(line: string) {
  const aliasPattern = Object.values(FIELD_LABELS)
    .flat()
    .map((label) => escapeRegex(label).replace(/\\ /g, "\\s+"))
    .join("|")

  return line
    .split(/[|;]/g)
    .flatMap((segment) =>
      segment
        .split(new RegExp(`\\s+(?=(?:${aliasPattern})\\s*[:\\-–—])`, "i"))
        .map((part) => part.trim())
        .filter(Boolean)
    )
}

function sanitizeGenericValue(value: string) {
  const cleaned = cleanText(value)
    .replace(/^[:\-–—\s]+/, "")
    .replace(/\s*[|;,]+$/, "")
    .trim()

  if (!cleaned) return null
  if (cleaned.length > 180) return null
  return cleaned
}

function sanitizeOrigin(value: string) {
  const cleaned = sanitizeGenericValue(value)
  if (!cleaned) return null
  if (!/[a-z]/i.test(cleaned)) return null
  if (/^(details|description|style|specs?)$/i.test(cleaned)) return null
  return cleaned
}

function sanitizeMaterial(value: string) {
  const cleaned = sanitizeGenericValue(value)
  if (!cleaned) return null
  if (!/[a-z]/i.test(cleaned)) return null
  if (/^(details|style|floral|oushak|rug)$/i.test(cleaned)) return null
  return cleaned
}

function sanitizeSize(value: string) {
  const cleaned = sanitizeGenericValue(value)
  if (!cleaned) return null
  if (!/\d/.test(cleaned)) return null
  if (!/(cm|mm|ft|feet|foot|inch|inches|["'x×])|(\d+\s*[x×]\s*\d+)/i.test(cleaned)) return null
  return cleaned
}

function sanitizeAge(value: string) {
  const cleaned = sanitizeGenericValue(value)
  if (!cleaned) return null
  const lowered = cleaned.toLowerCase()
  if (lowered === "rug" || lowered === "vintage rug" || lowered === "vintage") return null
  if (!/\d/.test(cleaned) && !/\b(year|years|new|semi-antique|antique|old)\b/i.test(cleaned)) {
    return null
  }
  return cleaned
}

function sanitizeCondition(value: string) {
  const cleaned = sanitizeGenericValue(value)
  if (!cleaned) return null
  if (!/[a-z]/i.test(cleaned)) return null
  if (/^(details|rug|style)$/i.test(cleaned)) return null
  return cleaned
}

function sanitizePile(value: string) {
  const cleaned = sanitizeGenericValue(value)
  if (!cleaned) return null
  if (!/\b(pile|flatweave|shag|low|medium|high)\b/i.test(cleaned)) return null
  return cleaned
}

function sanitizeKnotDensity(value: string) {
  const cleaned = sanitizeGenericValue(value)
  if (!cleaned) return null
  if (!/\b(knot|knotted|hand-knotted|hand knotted)\b/i.test(cleaned)) return null
  return cleaned
}

function sanitizeSku(value: string) {
  const cleaned = sanitizeGenericValue(value)
  if (!cleaned) return null
  if (!/[a-z0-9]/i.test(cleaned)) return null
  return cleaned
}

const SPEC_RULES: SpecRule[] = [
  { key: "origin", labels: FIELD_LABELS.origin, sanitize: sanitizeOrigin },
  { key: "material", labels: FIELD_LABELS.material, sanitize: sanitizeMaterial },
  { key: "size", labels: FIELD_LABELS.size, sanitize: sanitizeSize },
  { key: "age", labels: FIELD_LABELS.age, sanitize: sanitizeAge },
  { key: "condition", labels: FIELD_LABELS.condition, sanitize: sanitizeCondition },
  { key: "pile", labels: FIELD_LABELS.pile, sanitize: sanitizePile },
  { key: "knotDensity", labels: FIELD_LABELS.knotDensity, sanitize: sanitizeKnotDensity },
  { key: "sku", labels: FIELD_LABELS.sku, sanitize: sanitizeSku },
  { key: "mainColor", labels: FIELD_LABELS.mainColor, sanitize: sanitizeGenericValue },
  { key: "shape", labels: FIELD_LABELS.shape, sanitize: sanitizeGenericValue },
  { key: "productType", labels: FIELD_LABELS.productType, sanitize: sanitizeGenericValue },
  { key: "feetInch", labels: FIELD_LABELS.feetInch, sanitize: sanitizeGenericValue },
  { key: "totalM2", labels: FIELD_LABELS.totalM2, sanitize: sanitizeGenericValue },
]

function assignIfEmpty(specs: ProductSpecs, key: ProductSpecKey, value: string | null) {
  if (!value || specs[key]) return
  specs[key] = value
}

function extractLabeledFieldsFromLine(line: string, specs: ProductSpecs) {
  const segments = splitLineIntoSegments(line)

  for (const segment of segments) {
    for (const rule of SPEC_RULES) {
      if (specs[rule.key]) continue

      for (const label of rule.labels) {
        const labelPattern = escapeRegex(label).replace(/\\ /g, "\\s+")
        const match = segment.match(new RegExp(`^${labelPattern}\\s*[:\\-–—]\\s*(.+)$`, "i"))
        if (!match?.[1]) continue
        assignIfEmpty(specs, rule.key, rule.sanitize(match[1]))
        break
      }
    }
  }
}

function extractStructuredFields(input: string, specs: ProductSpecs) {
  const safe = stripUnsafeHtml(input)

  for (const match of safe.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const rowHtml = match[1]
    const cells = Array.from(rowHtml.matchAll(/<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi))
    if (cells.length < 2) continue
    const label = cleanText(cells[0][2])
    const value = cleanText(cells[1][2])
    extractLabeledFieldsFromLine(`${label}: ${value}`, specs)
  }

  for (const match of safe.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi)) {
    const label = cleanText(match[1])
    const value = cleanText(match[2])
    extractLabeledFieldsFromLine(`${label}: ${value}`, specs)
  }
}

function extractOriginFallback(lines: string[], specs: ProductSpecs) {
  if (specs.origin) return

  for (const line of lines) {
    const match = line.match(/\b(?:handmade|made|woven)\s+in\s+([A-Za-z][A-Za-z\s,-]{1,60})$/i)
    if (!match?.[1]) continue
    const value = sanitizeOrigin(match[1])
    if (value) {
      specs.origin = value
      return
    }
  }
}

function finalizeSpecRelationships(specs: ProductSpecs) {
  if (!specs.feetInch && specs.size) {
    const feetInchMatch = specs.size.match(/(\d+(?:['′])\s*x\s*\d+(?:['′])?(?:\d+(?:["″]))?.*)$/i)
    if (feetInchMatch?.[1]) {
      specs.feetInch = sanitizeGenericValue(feetInchMatch[1])
    }
  }
}

export function parseProductSpecs(input: string | null | undefined): ProductSpecs {
  const specs: ProductSpecs = { ...EMPTY_SPECS }
  if (!input || typeof input !== "string") return specs

  extractStructuredFields(input, specs)

  const lines = normalizeDescriptionToLines(input)
  for (const line of lines) {
    extractLabeledFieldsFromLine(line, specs)
  }

  extractOriginFallback(lines, specs)
  finalizeSpecRelationships(specs)

  return specs
}

export function parseInventorySpecsFromDescription(input: string | null | undefined): InventorySpecs {
  const parsed = parseProductSpecs(input)
  return {
    origin: parsed.origin,
    material: parsed.material,
    size: parsed.size,
    age: parsed.age,
    condition: parsed.condition,
    pile: parsed.pile,
    knotDensity: parsed.knotDensity,
  }
}
