import { prisma } from "@/lib/db"

export type CategoryPathRow = {
  id: string
  slug: string
  title: string
  parentId: string | null
}

export async function fetchCategoryPathRows(): Promise<CategoryPathRow[]> {
  return prisma.category.findMany({
    select: {
      id: true,
      slug: true,
      title: true,
      parentId: true,
    },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  })
}

export function buildCategoryPathMap(rows: CategoryPathRow[]) {
  const byId = new Map(rows.map((row) => [row.id, row]))
  const bySlug = new Map(rows.map((row) => [row.slug, row]))

  const pathById = new Map<string, string>()

  const computePath = (id: string): string => {
    const cached = pathById.get(id)
    if (cached) return cached

    const node = byId.get(id)
    if (!node) return ""

    const path = node.parentId && byId.has(node.parentId)
      ? `${computePath(node.parentId)}/${node.slug}`
      : `/${node.slug}`

    pathById.set(id, path)
    return path
  }

  rows.forEach((row) => {
    computePath(row.id)
  })

  return { byId, bySlug, pathById }
}

export function resolveCategoryRowByPath(rows: CategoryPathRow[], segments: string[]) {
  if (segments.length === 0) return null
  const { bySlug, pathById } = buildCategoryPathMap(rows)
  const leaf = bySlug.get(segments[segments.length - 1])
  if (!leaf) return null
  const candidatePath = pathById.get(leaf.id)
  if (!candidatePath) return null
  return candidatePath === `/${segments.join("/")}` ? leaf : null
}

export async function resolveCategoryByPath(segments: string[]) {
  const rows = await fetchCategoryPathRows()
  const category = resolveCategoryRowByPath(rows, segments)
  if (!category) return null
  const { pathById } = buildCategoryPathMap(rows)
  return {
    category,
    rows,
    path: pathById.get(category.id) || `/${category.slug}`,
  }
}

export function getCategoryPathById(rows: CategoryPathRow[], id: string) {
  return buildCategoryPathMap(rows).pathById.get(id) || "/"
}

export function getCategoryPathBySlug(rows: CategoryPathRow[], slug: string) {
  const { bySlug, pathById } = buildCategoryPathMap(rows)
  const row = bySlug.get(slug)
  if (!row) return null
  return pathById.get(row.id) || `/${row.slug}`
}
