import type { Prisma } from "@prisma/client"

export type ListingSearchParams = { [key: string]: string | string[] | undefined }

type SizeOption = { slug: string; name?: string | null }

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
  return (value || "")
    .toLowerCase()
    .trim()
    .replace(/\bby\b/g, "x")
    .replace(/\s*x\s*/g, "x")
    .replace(/\s+/g, " ")
}

export function resolveSelectedSizeSlugs(values: string[], sizeOptions: SizeOption[]) {
  const byNormalized = new Map<string, string>()

  sizeOptions.forEach((option) => {
    const normalizedSlug = normalizeListingSize(option.slug)
    const normalizedName = normalizeListingSize(option.name || "")
    if (normalizedSlug) byNormalized.set(normalizedSlug, option.slug)
    if (normalizedName) byNormalized.set(normalizedName, option.slug)
  })

  return Array.from(
    new Set(
      values
        .map((value) => byNormalized.get(normalizeListingSize(value)) || value)
        .filter(Boolean),
    ),
  )
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
  const normalized = query.trim()
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

  const clauses: Prisma.ProductWhereInput[] = terms.map((term) => ({
    OR: [
      { title: { contains: term } },
      { slug: { contains: term } },
      { sku: { contains: term } },
      { categories: { some: { OR: [{ title: { contains: term } }, { slug: { contains: term } }] } } },
      { styles: { some: { OR: [{ name: { contains: term } }, { slug: { contains: term } }] } } },
      { types: { some: { OR: [{ name: { contains: term } }, { slug: { contains: term } }] } } },
      { sizes: { some: { OR: [{ name: { contains: term } }, { slug: { contains: normalizeListingSize(term) } }] } } },
    ],
  }))

  if (slugLike && slugLike !== normalized) {
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
