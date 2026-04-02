import { prisma } from "@/lib/db"
import { buildCategoryPathMap } from "@/lib/category-paths"

export type PublicMenuNode = {
  id: string
  label: string
  url: string
  referenceId?: string | null
  kind?: "PAGE" | "CATEGORY" | "CUSTOM"
  children: PublicMenuNode[]
}

function normalizeMenuHref(input?: string | null) {
  const value = (input || "").trim()
  if (!value) return "#"
  if (value === "https://" || value === "http://") return "#"
  if (value.startsWith("/")) return value
  if (value.startsWith("http://") || value.startsWith("https://")) return value
  return `/${value.replace(/^\/+/, "")}`
}

export async function getPublicMenu(locationOrSlug: string): Promise<PublicMenuNode[]> {
  const menus = await prisma.menu.findMany({
    where: {
      OR: [
        { location: locationOrSlug },
        { slug: locationOrSlug },
      ],
    },
    orderBy: {
      updatedAt: "desc",
    },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
      },
    },
  })

  const menu = menus.find((candidate) => candidate.items.length > 0) || menus[0]
  if (!menu) return []

  const categoryIds = menu.items
    .filter((item) => item.type === "CATEGORY" && item.referenceId)
    .map((item) => item.referenceId as string)
  const pageIds = menu.items
    .filter((item) => item.type === "PAGE" && item.referenceId)
    .map((item) => item.referenceId as string)

  const [categories, pages] = await Promise.all([
    categoryIds.length
      ? prisma.category.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, slug: true, title: true, parentId: true },
        })
      : [],
    pageIds.length
      ? prisma.page.findMany({
          where: { id: { in: pageIds } },
          select: { id: true, slug: true, status: true },
        })
      : [],
  ])

  const { pathById } = buildCategoryPathMap(categories)
  const pageMap = new Map(
    pages
      .filter((page) => page.status === "PUBLISHED")
      .map((page) => [page.id, page.slug])
  )

  const flatNodes = menu.items.map((item) => {
    let url = normalizeMenuHref(item.url)
    if (item.type === "CATEGORY" && item.referenceId) {
      url = pathById.get(item.referenceId) || "#"
    } else if (item.type === "PAGE" && item.referenceId) {
      const pageSlug = pageMap.get(item.referenceId)
      url = pageSlug ? `/${pageSlug}` : "#"
    }

    return {
      id: item.id,
      parentId: item.parentId,
      label: item.label,
      url,
      referenceId: item.referenceId,
      kind: item.type as PublicMenuNode["kind"],
      children: [] as PublicMenuNode[],
    }
  })

  const byId = new Map(flatNodes.map((item) => [item.id, item]))
  const roots: PublicMenuNode[] = []

  flatNodes.forEach((item) => {
    if (item.parentId && byId.has(item.parentId)) {
      byId.get(item.parentId)?.children.push(item)
      return
    }
    roots.push(item)
  })

  return roots
}

export async function getPublicCategoryTreeMenu(): Promise<PublicMenuNode[]> {
  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      parentId: true,
    },
  })

  const { pathById } = buildCategoryPathMap(categories)
  const nodes = categories.map((category) => ({
    id: category.id,
    parentId: category.parentId,
    label: category.title,
    url: pathById.get(category.id) || `/category/${category.slug}`,
    referenceId: category.id,
    kind: "CATEGORY" as const,
    children: [] as PublicMenuNode[],
  }))

  const byId = new Map(nodes.map((node) => [node.id, node]))
  const roots: PublicMenuNode[] = []
  nodes.forEach((node) => {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)?.children.push(node)
      return
    }
    roots.push(node)
  })

  return roots
}
