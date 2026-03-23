import type { Prisma } from "@prisma/client"

export type ListingSearchParams = { [key: string]: string | string[] | undefined }

type SizeOption = { slug: string; name?: string | null }
type SlugOption = { slug: string; name?: string | null; title?: string | null }

export function normalizeListingText(value: string | null | undefined) {
  return (value || "").toLowerCase().trim().replace(/\s+/g, " ")
}

export function getMultiParam(params: ListingSearchParams, key: string) {
  const value = params[key]
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

export function getSingleParam(params: ListingSearchParams, key: string) {
  const value = params[key]
  if (!value) return ""
  return Array.isArray(value) ? value[0] || "" : value
}

export function normalizeListingSize(value: string | null | undefined) {
  return normalizeListingText(value)
    .replace(/\bby\b/g, "x")
    .replace(/\s*x\s*/g, "x")
}

export function normalizeListingColor(value: string | null | undefined) {
  return normalizeListingText(value)
}

export function resolveSelectedOptionSlugs(values: string[], options: SlugOption[]) {
  const byNormalized = new Map<string, string>()

  options.forEach((option) => {
    const normalizedSlug = normalizeListingText(option.slug)
    const normalizedName = normalizeListingText(option.name || option.title || "")
    if (normalizedSlug) byNormalized.set(normalizedSlug, option.slug)
    if (normalizedName) byNormalized.set(normalizedName, option.slug)
  })

  return Array.from(
    new Set(
      values
        .map((value) => byNormalized.get(normalizeListingText(value)) || value)
        .filter(Boolean),
    ),
  )
}

export function resolveSelectedSizeSlugs(values: string[], sizeOptions: SizeOption[]) {
  const byNormalized = new Map<string, string>()

  sizeOptions.forEach((option) => {
    const normalizedSlug = normalizeListingSize(option.slug)
    const normalizedName = normalizeListingSize(option.name || "")
    if (normalizedSlug) byNormalized.set(normalizedSlug, option.slug)
    if (normalizedName) byNormalized.set(normalizedName, option.slug)
  })

  return Array.from(new Set(values.map((value) => byNormalized.get(normalizeListingSize(value)) || value).filter(Boolean)))
}

export function extractPriceIntent(query: string) {
  const matches = normalizeListingText(query).match(/\b\d+(?:\.\d+)?\b/g) || []
  const numericValues = matches
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 100)

  if (numericValues.length === 0) return undefined

  const center = numericValues[0]
  const tolerance = Math.max(100, Math.round(center * 0.15))
  return {
    center,
    min: Math.max(0, center - tolerance),
    max: center + tolerance,
  }
}

function isPureNumericToken(term: string) {
  return /^\d+(?:\.\d+)?$/.test(term)
}

export function buildListingPricePresets(maxPrice: number) {
  const cappedUpper = Math.max(3000, Math.ceil(maxPrice / 100) * 100)
  return [
    { min: 0, max: 500, label: "$0 - $500" },
    { min: 500, max: 1000, label: "$500 - $1000" },
    { min: 1000, max: 2500, label: "$1000 - $2500" },
    { min: 2500, max: cappedUpper, label: `$2500 - $${cappedUpper}` },
  ]
}

export function buildProductSearchWhere(query: string): Prisma.ProductWhereInput["AND"] | undefined {
  const normalized = normalizeListingText(query)
  if (!normalized) return undefined

  const slugLike = normalized.replace(/\s+/g, "-")
  const terms = Array.from(
    new Set(
      normalized
        .split(/\s+/)
        .map((term) => term.trim())
        .filter(Boolean),
    ),
  )
  const textTerms = terms.filter((term) => !isPureNumericToken(term))

  const clauses: Prisma.ProductWhereInput[] = textTerms.map((term) => ({
    OR: [
      { title: { contains: term } },
      { slug: { contains: term } },
      { sku: { contains: term } },
      { categories: { some: { OR: [{ title: { contains: term } }, { slug: { contains: term } }] } } },
      { styles: { some: { OR: [{ name: { contains: term } }, { slug: { contains: term } }] } } },
      { types: { some: { OR: [{ name: { contains: term } }, { slug: { contains: term } }] } } },
      { colors: { some: { OR: [{ name: { contains: normalizeListingColor(term) } }, { slug: { contains: normalizeListingColor(term) } }] } } },
      { sizes: { some: { OR: [{ name: { contains: term } }, { slug: { contains: normalizeListingSize(term) } }] } } },
    ],
  }))

  if (slugLike && slugLike !== normalized && !isPureNumericToken(slugLike)) {
    clauses.push({
      OR: [
        { slug: { contains: slugLike } },
        { categories: { some: { slug: { contains: slugLike } } } },
        { sizes: { some: { slug: { contains: normalizeListingSize(slugLike) } } } },
      ],
    })
  }

  return clauses
}
