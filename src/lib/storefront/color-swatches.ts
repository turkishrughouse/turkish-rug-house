type ResolvedSwatch = {
  background: string
  borderColor?: string
}

const COLOR_KEYWORDS: Array<{ match: RegExp; swatch: ResolvedSwatch }> = [
  { match: /\b(multicolor|multi-color|multi color|rainbow|colorful|assorted)\b/, swatch: { background: "linear-gradient(135deg, #d86f45 0%, #d9b56f 22%, #4f87c6 45%, #5f8f5f 66%, #8f5d8f 100%)", borderColor: "rgba(122, 100, 78, 0.2)" } },
  { match: /\b(orange[-/\s]?yellow|yellow[-/\s]?orange|gold[-/\s]?orange|orange gold)\b/, swatch: { background: "linear-gradient(135deg, #ee8b53 0%, #f3be58 100%)", borderColor: "rgba(138, 104, 43, 0.18)" } },
  { match: /\b(black|charcoal|ebony|graphite|onyx)\b/, swatch: { background: "#262626", borderColor: "rgba(38, 38, 38, 0.26)" } },
  { match: /\b(white|snow|cream white)\b/, swatch: { background: "#fcfbf8", borderColor: "rgba(143, 135, 122, 0.3)" } },
  { match: /\b(ivory|cream|off[-\s]?white|bone|ecru)\b/, swatch: { background: "#f4efe4", borderColor: "rgba(160, 145, 120, 0.22)" } },
  { match: /\b(beige|sand|camel|oatmeal|taupe|stone)\b/, swatch: { background: "#d9c2a3", borderColor: "rgba(143, 114, 78, 0.22)" } },
  { match: /\b(gray|grey|ash|silver|slate|smoke)\b/, swatch: { background: "#b7b3ab", borderColor: "rgba(104, 96, 86, 0.2)" } },
  { match: /\b(brown|mocha|coffee|cocoa|chocolate|walnut|tan|rust)\b/, swatch: { background: "#8b6142", borderColor: "rgba(95, 63, 39, 0.24)" } },
  { match: /\b(red|burgundy|wine|crimson|ruby|brick|terracotta)\b/, swatch: { background: "#c95d4a", borderColor: "rgba(139, 67, 53, 0.24)" } },
  { match: /\b(blue|navy|indigo|teal|turquoise|aqua|sky)\b/, swatch: { background: "#5b88bf", borderColor: "rgba(59, 92, 133, 0.24)" } },
  { match: /\b(green|olive|sage|emerald|mint|forest)\b/, swatch: { background: "#668b63", borderColor: "rgba(73, 96, 70, 0.24)" } },
  { match: /\b(purple|violet|plum|lavender|lilac|amethyst)\b/, swatch: { background: "#8f72b8", borderColor: "rgba(101, 77, 133, 0.24)" } },
  { match: /\b(pink|rose|blush|salmon)\b/, swatch: { background: "#d99aa1", borderColor: "rgba(145, 95, 102, 0.22)" } },
  { match: /\b(yellow|mustard|amber)\b/, swatch: { background: "#e1bc55", borderColor: "rgba(148, 117, 45, 0.24)" } },
  { match: /\b(orange|apricot|peach|coral)\b/, swatch: { background: "#e58a4f", borderColor: "rgba(146, 87, 43, 0.24)" } },
]

function normalizeToken(input: string | null | undefined) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/[_/]+/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
}

function normalizeHex(hex: string | null | undefined) {
  const raw = String(hex || "").trim()
  if (!raw) return null
  const prefixed = raw.startsWith("#") ? raw : `#${raw}`
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(prefixed) ? prefixed : null
}

export function resolveColorSwatch(input: {
  label?: string | null
  slug?: string | null
  hex?: string | null
}): ResolvedSwatch {
  const directHex = normalizeHex(input.hex)
  if (directHex) {
    return { background: directHex }
  }

  const haystack = `${normalizeToken(input.label)} ${normalizeToken(input.slug)}`.trim()
  for (const entry of COLOR_KEYWORDS) {
    if (entry.match.test(haystack)) {
      return entry.swatch
    }
  }

  return { background: "#b7b3ab", borderColor: "rgba(104, 96, 86, 0.2)" }
}
