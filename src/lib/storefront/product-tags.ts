type ProductRelation = {
  id?: string
  name?: string
  title?: string
  slug?: string
}

type ProductCategoryRelation = {
  id?: string
  title?: string
  slug?: string
}

type StorefrontTagProduct = {
  categories?: ProductCategoryRelation[]
  types?: ProductRelation[]
  styles?: ProductRelation[]
  materials?: ProductRelation[]
  colors?: ProductRelation[]
}

function relationLabel(item: ProductRelation | ProductCategoryRelation | undefined) {
  if (!item) return ""
  if ("name" in item && typeof item.name === "string") {
    return item.name.trim()
  }
  if ("title" in item && typeof item.title === "string") {
    return item.title.trim()
  }
  return ""
}

export function buildStorefrontProductTags(product: StorefrontTagProduct) {
  const tags: string[] = []
  const seen = new Set<string>()

  const pushTag = (value: string | undefined) => {
    const normalized = (value || "").trim()
    if (!normalized) return
    const key = normalized.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    tags.push(normalized)
  }

  pushTag(relationLabel(product.categories?.[0]))
  pushTag(relationLabel(product.types?.[0]))
  pushTag(relationLabel(product.styles?.[0]))
  pushTag(relationLabel(product.materials?.[0]))

  if ((product.colors || []).length === 1) {
    pushTag(relationLabel(product.colors?.[0]))
  }

  return tags.slice(0, 4)
}

export type { StorefrontTagProduct, ProductRelation, ProductCategoryRelation }
