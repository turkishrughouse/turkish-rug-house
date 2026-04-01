import { notFound, permanentRedirect } from "next/navigation"
import Link from "next/link"
import { Metadata } from "next"
import { LayoutGrid, Grid2x2, Rows3, List } from "lucide-react"
import { CategoryListingProductCard } from "@/components/storefront/category-listing-product-card"
import { MobileFilterDrawer } from "@/components/storefront/mobile-filter-drawer"
import { prisma } from "@/lib/db"
import { getProductIdsForFacetCounts, getProducts, getProductOptions } from "@/lib/actions/product-actions"
import { getAttributeFacetGroupsForProductIds } from "@/lib/product-attributes"
import { buildProductImageAlt, getProductImageUrl, parseProductImageRecords } from "@/lib/product-images"
import { formatCurrency } from "@/lib/storefront/currency"
import { getStorefrontCurrencySnapshot } from "@/lib/storefront/currency-server"
import { buildListingPricePresets, getMultiParam, getSingleParam, resolveSelectedOptionSlugs, resolveSelectedSizeSlugs } from "@/lib/storefront/listing-filters"
import { ListingPagination } from "@/components/storefront/listing-pagination"
import { getCategoryPathById, resolveCategoryByPath } from "@/lib/category-paths"
import { cn } from "@/lib/utils"

type SearchParams = { [key: string]: string | string[] | undefined }

type RenderCategoryPageInput = {
  slugPath: string[]
  searchParams: SearchParams
  redirectIfCanonicalMismatch?: boolean
}

function resolveAttributeFilterSelection(
  groupSlug: string,
  rawValues: string[],
  options: Array<{ slug: string; value?: string }>,
) {
  if (groupSlug === "size") {
    return resolveSelectedSizeSlugs(rawValues, options.map((option) => ({ slug: option.slug, name: option.value })))
  }

  return resolveSelectedOptionSlugs(rawValues, options.map((option) => ({ slug: option.slug, name: option.value })))
}

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.SITE_URL ||
    process.env.APP_URL ||
    "https://turkishrughouse.com"
  ).replace(/\/+$/, "")
}

function stripHtml(input: string | null | undefined) {
  if (!input) return ""
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function buildCategoryMetaDescription(title: string, description: string | null | undefined) {
  const plainDescription = stripHtml(description)
  if (plainDescription) {
    return plainDescription.slice(0, 160)
  }

  return `Browse our collection of ${title}`.slice(0, 160)
}

function getPositiveIntParam(value: string | null | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export async function generateCategoryMetadataByPath(slugPath: string[]): Promise<Metadata> {
  return generateCategoryMetadataByPathWithSearch(slugPath, {})
}

export async function generateCategoryMetadataByPathWithSearch(
  slugPath: string[],
  searchParams: SearchParams
): Promise<Metadata> {
  const resolved = await resolveCategoryByPath(slugPath)
  if (!resolved) {
    return { title: "Category Not Found" }
  }

  const category = await prisma.category.findUnique({
    where: { id: resolved.category.id },
    select: {
      title: true,
      description: true,
    },
  })

  if (!category) {
    return { title: "Category Not Found" }
  }

  const metaDescription = buildCategoryMetaDescription(category.title, category.description)
  const hasQueryFilters = Object.entries(searchParams).some(([, value]) => {
    if (Array.isArray(value)) return value.some((item) => String(item).trim().length > 0)
    return String(value || "").trim().length > 0
  })

  return {
    title: category.title,
    description: metaDescription,
    alternates: {
      canonical: resolved.path,
    },
    robots: hasQueryFilters
      ? {
          index: false,
          follow: true,
        }
      : undefined,
    openGraph: {
      title: category.title,
      description: metaDescription,
      url: resolved.path,
      type: "website",
    },
    twitter: {
      title: category.title,
      description: metaDescription,
    },
  }
}

export async function renderCategoryPage({
  slugPath,
  searchParams,
  redirectIfCanonicalMismatch = false,
}: RenderCategoryPageInput) {
  const currencySnapshot = await getStorefrontCurrencySnapshot()
  const currencySettings = {
    selectedCurrency: currencySnapshot.selectedCurrency,
    usdToEurRate: currencySnapshot.usdToEurRate,
    locale: currencySnapshot.locale,
  }
  const resolved = await resolveCategoryByPath(slugPath)
  if (!resolved) notFound()

  if (redirectIfCanonicalMismatch && resolved.path !== `/${slugPath.join("/")}`) {
    permanentRedirect(resolved.path)
  }

  const rows = resolved.rows
  const categoryPath = resolved.path
  const categoryId = resolved.category.id

  const query = getSingleParam(searchParams, "q")
  const viewInput = getSingleParam(searchParams, "view")
  const viewMode: "2" | "3" | "4" | "list" = viewInput === "2" || viewInput === "3" || viewInput === "4" || viewInput === "list" ? viewInput : "3"
  const productGridClassName = viewMode === "list"
    ? "mt-5 space-y-4"
    : cn(
        "mt-4 grid min-w-0 grid-cols-2 auto-rows-fr gap-3 sm:gap-4",
        viewMode === "2" && "md:grid-cols-2",
        viewMode === "3" && "lg:grid-cols-3",
        viewMode === "4" && "lg:grid-cols-3 2xl:grid-cols-4",
      )
  const sortInput = getSingleParam(searchParams, "sort")
  const sortValue: "latest" | "oldest" | "price-asc" | "price-desc" =
    sortInput === "oldest" || sortInput === "price-asc" || sortInput === "price-desc" ? sortInput : "latest"
  const page = getPositiveIntParam(getSingleParam(searchParams, "page"), 1)
  const limitInput = getPositiveIntParam(getSingleParam(searchParams, "limit") || getSingleParam(searchParams, "show"), 20)
  const limitValue = [8, 16, 20, 32, 36].includes(limitInput) ? limitInput : 20
  const inStockOnly = searchParams["inStock"] === "true"
  const topRatedOnly = searchParams["topRated"] === "true"
  const priceMin = Number(getSingleParam(searchParams, "priceMin") || 0)
  const priceMaxRaw = Number(getSingleParam(searchParams, "priceMax") || 0)
  const hasPriceFilter = Number.isFinite(priceMin) && Number.isFinite(priceMaxRaw) && priceMaxRaw > 0

  const [category, options, maxPriceRow] = await Promise.all([
    prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        children: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            slug: true,
            title: true,
            image: true,
            description: true,
          },
        },
      },
    }),
    getProductOptions(),
    prisma.product.aggregate({
      where: {
        isPublished: true,
        categories: {
          some: { id: categoryId },
        },
      },
      _max: { price: true },
    }),
  ])

  if (!category) notFound()

  const filterableAttributeGroups = options.attributeGroups.filter((group: any) => group.isFilterable && group.isActive)
  const selectedAttributeFilters = Object.fromEntries(
    filterableAttributeGroups
      .map((group: any) => [
        group.slug,
        resolveAttributeFilterSelection(group.slug, getMultiParam(searchParams, group.slug), group.options),
      ] as const)
      .filter(([, values]) => values.length > 0),
  ) as Record<string, string[]>
  const baseFilters: {
    attributeFilters: Record<string, string[]>
    inStock: boolean
    priceMin: number | undefined
    priceMax: number | undefined
  } = {
    attributeFilters: selectedAttributeFilters,
    inStock: inStockOnly,
    priceMin: hasPriceFilter ? priceMin : undefined,
    priceMax: hasPriceFilter ? priceMaxRaw : undefined,
  }

  const childMap = new Map<string, string[]>()
  const rowById = new Map(rows.map((row) => [row.id, row]))
  rows.forEach((node) => {
    const parentId = node.parentId || "__root__"
    const list = childMap.get(parentId) || []
    list.push(node.id)
    childMap.set(parentId, list)
  })

  const categoryScopeIds = (() => {
    const result = new Set<string>()
    const stack: string[] = [category.id]
    while (stack.length > 0) {
      const current = stack.pop()
      if (!current || result.has(current)) continue
      result.add(current)
      const children = childMap.get(current) || []
      children.forEach((childId) => stack.push(childId))
    }
    return Array.from(result)
  })()

  const breadcrumbItems = (() => {
    const items: Array<{ id: string; title: string; path: string }> = []
    let current: string | null = category.id
    while (current) {
      const row = rowById.get(current)
      if (!row) break
      items.push({
        id: row.id,
        title: row.title,
        path: getCategoryPathById(rows, row.id),
      })
      current = row.parentId
    }
    return items.reverse()
  })()

  const maxCategoryPrice = Number(maxPriceRow._max.price?.toString?.() || 0)

  const topRatedSales = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: { productId: { not: null } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 60,
  })

  const rankedIds = topRatedSales.map((row) => row.productId).filter((id): id is string => Boolean(id))
  const topRatedCandidates = rankedIds.length > 0
    ? await prisma.product.findMany({
        where: {
          id: { in: rankedIds },
          isPublished: true,
          categories: { some: { id: { in: categoryScopeIds } } },
        },
        select: {
          id: true,
          slug: true,
          title: true,
          price: true,
          compareAtPrice: true,
          images: true,
        },
      })
    : []

  const quantityMap = new Map(
    topRatedSales
      .filter((row) => row.productId)
      .map((row) => [row.productId as string, Number(row._sum.quantity || 0)])
  )

  const topRatedProducts = topRatedCandidates
    .sort((a, b) => (quantityMap.get(b.id) || 0) - (quantityMap.get(a.id) || 0))
    .slice(0, 5)
    .map((p) => ({
      ...p,
      price: Number(p.price),
      compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice) : null,
      soldCount: quantityMap.get(p.id) || 0,
    }))

  const topRatedIds = topRatedProducts.map((p) => p.id)

  const { products, metadata } = await getProducts(page, limitValue, query, "published", sortValue, category.slug, {
    ...baseFilters,
    categoryIds: categoryScopeIds,
    productIds: topRatedOnly ? topRatedIds : undefined,
  })

  const facetProductIds = await getProductIdsForFacetCounts(query, "published", sortValue, category.slug, {
    ...baseFilters,
    categoryIds: categoryScopeIds,
    productIds: topRatedOnly ? topRatedIds : undefined,
  })
  const attributeFacetGroups = await getAttributeFacetGroupsForProductIds(facetProductIds)
  const primaryAttributeFacetGroups = attributeFacetGroups.slice(0, 6)
  const overflowAttributeFacetGroups = attributeFacetGroups.slice(6)

  const childCounts = await Promise.all(
    category.children.map(async (child) => ({
      ...child,
      path: getCategoryPathById(rows, child.id),
      productCount: await prisma.product.count({
        where: {
          isPublished: true,
          categories: { some: { id: child.id } },
        },
      }),
    }))
  )

  const buildQuery = (mutator: (params: URLSearchParams) => void, options?: { resetPage?: boolean }) => {
    const params = new URLSearchParams()
    Object.entries(searchParams).forEach(([key, value]) => {
      if (Array.isArray(value)) value.forEach((item) => params.append(key, item))
      else if (value !== undefined) params.set(key, value)
    })
    mutator(params)
    if (options?.resetPage) {
      params.set("page", "1")
    }
    if (!params.get("limit")) {
      params.set("limit", String(limitValue))
    }
    const q = params.toString()
    return q ? `?${q}` : ""
  }

  const activePriceLabel = hasPriceFilter ? `$${priceMin} - $${priceMaxRaw}` : "Any"
  const pricePresets = buildListingPricePresets(maxCategoryPrice)
  const categoryMetaDescription = buildCategoryMetaDescription(category.title, category.description)
  const categoryCanonicalUrl = `${getSiteUrl()}${categoryPath}`
  const activeFilterChips = [
    ...filterableAttributeGroups.flatMap((group: any) =>
      (selectedAttributeFilters[group.slug] || []).map((slug) => ({
        key: `${group.slug}-${slug}`,
        label: `${group.name}: ${group.options.find((item: any) => item.slug === slug)?.value || slug}`,
        href: `${categoryPath}${buildQuery((p) => {
          const next = p.getAll(group.slug).filter((item) => item !== slug)
          p.delete(group.slug)
          next.forEach((item) => p.append(group.slug, item))
        }, { resetPage: true })}`,
      }))
    ),
    ...(inStockOnly
      ? [{
          key: "in-stock",
          label: "In stock only",
          href: `${categoryPath}${buildQuery((p) => p.delete("inStock"), { resetPage: true })}`,
        }]
      : []),
    ...(topRatedOnly
      ? [{
          key: "top-rated",
          label: "Top rated only",
          href: `${categoryPath}${buildQuery((p) => p.delete("topRated"), { resetPage: true })}`,
        }]
      : []),
    ...(query
      ? [{
          key: "search",
          label: `Search: ${query}`,
          href: `${categoryPath}${buildQuery((p) => p.delete("q"), { resetPage: true })}`,
        }]
      : []),
    ...(hasPriceFilter
      ? [{
          key: "price",
          label: `Price: ${activePriceLabel}`,
          href: `${categoryPath}${buildQuery((p) => {
            p.delete("priceMin")
            p.delete("priceMax")
          }, { resetPage: true })}`,
        }]
      : []),
  ]
  const allFacetGroups = [...primaryAttributeFacetGroups, ...overflowAttributeFacetGroups]
  const mobileFilterSections = [
    {
      id: "status",
      title: "Status",
      variant: "checkbox" as const,
      defaultOpen: true,
      items: [
        {
          label: "In stock only",
          href: `${categoryPath}${buildQuery((p) => {
            if (inStockOnly) p.delete("inStock")
            else p.set("inStock", "true")
          }, { resetPage: true })}`,
          active: inStockOnly,
        },
        {
          label: "Top rated",
          href: `${categoryPath}${buildQuery((p) => {
            if (topRatedOnly) p.delete("topRated")
            else p.set("topRated", "true")
          }, { resetPage: true })}`,
          active: topRatedOnly,
        },
      ],
    },
    ...allFacetGroups.map((group) => ({
      id: group.id,
      title: group.name,
      variant: group.slug === "size" ? "pill" as const : group.slug === "color" ? "swatch" as const : "checkbox" as const,
      defaultOpen: group.slug === "size" || group.slug === "color",
      items: group.options.map((option) => {
        const active = (selectedAttributeFilters[group.slug] || []).includes(option.slug)
        return {
          label: option.value,
          href: `${categoryPath}${buildQuery((p) => {
            const existing = p.getAll(group.slug)
            p.delete(group.slug)
            if (existing.includes(option.slug)) {
              existing.filter((item) => item !== option.slug).forEach((item) => p.append(group.slug, item))
            } else {
              const nextValues = group.selectionMode === "single" ? [] : existing
              nextValues.forEach((item) => p.append(group.slug, item))
              p.append(group.slug, option.slug)
            }
          }, { resetPage: true })}`,
          active,
          count: option.count,
          colorHex: option.hex || undefined,
        }
      }),
    })),
    {
      id: "price",
      title: "Price",
      variant: "pill" as const,
      defaultOpen: true,
      items: pricePresets.map((preset) => ({
        label: preset.label,
        href: `${categoryPath}${buildQuery((p) => {
          p.set("priceMin", String(preset.min))
          p.set("priceMax", String(preset.max))
        }, { resetPage: true })}`,
        active: priceMin === preset.min && priceMaxRaw === preset.max,
      })),
    },
  ]
  const categorySchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: category.title,
    description: categoryMetaDescription,
    url: categoryCanonicalUrl,
    isPartOf: {
      "@type": "WebSite",
      name: "Turkish Rug House",
      url: getSiteUrl(),
    },
  }
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.title,
      item: `${getSiteUrl()}${item.path}`,
    })),
  }

  return (
    <div className="min-h-screen bg-[#fcfaf6] pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(categorySchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <div className="relative overflow-hidden border-b border-slate-200">
        {category.image ? <img src={category.image} alt={`${category.title} rug category`} loading="eager" decoding="async" className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 bg-[linear-gradient(120deg,#1e293b_0%,#0f172a_50%,#334155_100%)]" />}
        <div className="absolute inset-0 bg-slate-900/60" />
        <div className="container relative mx-auto px-6 py-14 md:py-16">
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-white">{category.title}</h1>
          {category.description ? <p className="mt-4 max-w-3xl text-slate-100/90 text-lg leading-relaxed">{stripHtml(category.description)}</p> : null}
          {childCounts.length > 0 ? (
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {childCounts.filter((child) => child.productCount > 0).map((child) => (
                <Link key={child.id} href={child.path} className="flex items-center gap-3 rounded-xl border border-white/25 bg-white/10 px-3 py-3 backdrop-blur-sm hover:bg-white/20">
                  <div className="h-11 w-11 overflow-hidden rounded-md bg-white/10 border border-white/30 shrink-0">{child.image ? <img src={child.image} alt={`${child.title} collection preview`} loading="lazy" decoding="async" className="h-full w-full object-cover" /> : null}</div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{child.title}</p>
                    <p className="text-xs text-white/80">{child.productCount} products</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 sm:px-6 lg:py-8">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[268px_minmax(0,1fr)] lg:gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-24 overflow-hidden rounded-[28px] border border-[#e7dfd4] bg-[#f7f3ed] text-[#2f2922] shadow-[0_18px_46px_rgba(31,22,16,0.08)]">
              <div className="border-b border-[#e7dfd4] px-5 py-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#b08a55]">Filter rail</p>
                <p className="mt-2 text-xl font-semibold text-[#2c261f]">{metadata.total} rugs found</p>
                <p className="mt-1 text-sm text-[#7f7669]">Refine by material, size, color, region, and price.</p>
              </div>
              <div className="divide-y divide-[#e7dfd4]">
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[15px] font-semibold text-[#2c261f]">Status</h3>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-[#9b917f]">Live</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {[
                      {
                        label: "In stock only",
                        active: inStockOnly,
                        href: `${categoryPath}${buildQuery((p) => {
                          if (inStockOnly) p.delete("inStock")
                          else p.set("inStock", "true")
                        }, { resetPage: true })}`,
                      },
                      {
                        label: "Top rated",
                        active: topRatedOnly,
                        href: `${categoryPath}${buildQuery((p) => {
                          if (topRatedOnly) p.delete("topRated")
                          else p.set("topRated", "true")
                        }, { resetPage: true })}`,
                      },
                    ].map((item) => (
                      <Link key={item.label} href={item.href} className={`flex items-center justify-between rounded-2xl border px-3.5 py-2.5 text-sm transition-colors ${item.active ? "border-[#dcc6a2] bg-[#f4ead9] text-[#3c3127]" : "border-[#e7dfd4] bg-[#fffdfa] text-[#70675c] hover:border-[#d8cebf] hover:text-[#2c261f]"}`}>
                        <span className="flex items-center gap-3">
                          <span className={`inline-flex h-5 w-5 items-center justify-center rounded border ${item.active ? "border-[#caa56a] bg-[#caa56a]" : "border-[#d7cec2] bg-transparent"}`}>
                            {item.active ? <span className="h-2 w-2 rounded-sm bg-white" /> : null}
                          </span>
                          {item.label}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>

                {allFacetGroups.map((group) => (
                  <div key={group.id} className="px-5 py-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[15px] font-semibold text-[#2c261f]">{group.name}</h3>
                      <span className="text-[10px] uppercase tracking-[0.18em] text-[#9b917f]">{group.options.length} options</span>
                    </div>

                    {group.slug === "size" ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {group.options.map((option) => {
                          const active = (selectedAttributeFilters[group.slug] || []).includes(option.slug)
                          return (
                            <Link
                              key={option.id}
                              href={`${categoryPath}${buildQuery((p) => {
                                const existing = p.getAll(group.slug)
                                p.delete(group.slug)
                                if (existing.includes(option.slug)) {
                                  existing.filter((item) => item !== option.slug).forEach((item) => p.append(group.slug, item))
                                } else {
                                  const nextValues = group.selectionMode === "single" ? [] : existing
                                  nextValues.forEach((item) => p.append(group.slug, item))
                                  p.append(group.slug, option.slug)
                                }
                              }, { resetPage: true })}`}
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${active ? "border-[#dcc6a2] bg-[#f4ead9] text-[#3c3127]" : "border-[#e7dfd4] bg-[#fffdfa] text-[#70675c] hover:border-[#d8cebf] hover:text-[#2c261f]"}`}
                            >
                              <span>{option.value}</span>
                              <span className="text-xs opacity-70">{option.count}</span>
                            </Link>
                          )
                        })}
                      </div>
                    ) : group.slug === "color" ? (
                      <div className="mt-4 grid grid-cols-3 gap-x-3 gap-y-4">
                        {group.options.map((option) => {
                          const active = (selectedAttributeFilters[group.slug] || []).includes(option.slug)
                          return (
                            <Link
                              key={option.id}
                              href={`${categoryPath}${buildQuery((p) => {
                                const existing = p.getAll(group.slug)
                                p.delete(group.slug)
                                if (existing.includes(option.slug)) {
                                  existing.filter((item) => item !== option.slug).forEach((item) => p.append(group.slug, item))
                                } else {
                                  const nextValues = group.selectionMode === "single" ? [] : existing
                                  nextValues.forEach((item) => p.append(group.slug, item))
                                  p.append(group.slug, option.slug)
                                }
                              }, { resetPage: true })}`}
                              className="text-center"
                            >
                              <span className={`mx-auto flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[24px] border transition-all duration-200 ${active ? "border-[#caa56a] bg-[#fcf7ef] shadow-[0_0_0_2px_rgba(255,255,255,0.95),0_0_0_5px_rgba(202,165,106,0.42),0_12px_24px_rgba(202,165,106,0.16)]" : "border-[#e3dbcf] bg-[#fffdfa] shadow-[0_8px_18px_rgba(48,38,26,0.06)] hover:border-[#d0c4b3] hover:shadow-[0_10px_20px_rgba(48,38,26,0.08)]"}`}>
                                <span className="h-[3.35rem] w-[3.35rem] rounded-[18px] border border-[rgba(58,45,32,0.12)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]" style={{ backgroundColor: option.hex || "#6b665f" }} />
                              </span>
                              <span className="mt-2.5 block truncate text-[13px] font-semibold leading-5 text-[#4a4138]">{option.value}</span>
                              <span className="mt-0.5 block text-[11px] font-medium text-[#8e8578]">{option.count}</span>
                            </Link>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {group.options.map((option) => {
                          const active = (selectedAttributeFilters[group.slug] || []).includes(option.slug)
                          return (
                            <Link
                              key={option.id}
                              href={`${categoryPath}${buildQuery((p) => {
                                const existing = p.getAll(group.slug)
                                p.delete(group.slug)
                                if (existing.includes(option.slug)) {
                                  existing.filter((item) => item !== option.slug).forEach((item) => p.append(group.slug, item))
                                } else {
                                  const nextValues = group.selectionMode === "single" ? [] : existing
                                  nextValues.forEach((item) => p.append(group.slug, item))
                                  p.append(group.slug, option.slug)
                                }
                              }, { resetPage: true })}`}
                              className={`flex items-center justify-between rounded-2xl border px-3.5 py-2.5 text-sm transition-colors ${active ? "border-[#dcc6a2] bg-[#f4ead9] text-[#3c3127]" : "border-[#e7dfd4] bg-[#fffdfa] text-[#70675c] hover:border-[#d8cebf] hover:text-[#2c261f]"}`}
                            >
                              <span className="flex min-w-0 items-center gap-3">
                                <span className={`inline-flex h-5 w-5 items-center justify-center rounded border ${active ? "border-[#caa56a] bg-[#caa56a]" : "border-[#d7cec2] bg-transparent"}`}>
                                  {active ? <span className="h-2 w-2 rounded-sm bg-white" /> : null}
                                </span>
                                <span className="truncate">{option.value}</span>
                              </span>
                              <span className="rounded-full border border-[#e4dbcf] bg-[#f5f1ea] px-2 py-0.5 text-[11px] text-[#8e8578]">{option.count}</span>
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}

                <div className="px-5 py-4">
                  <h3 className="text-[15px] font-semibold text-[#2c261f]">Price</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {pricePresets.map((preset) => {
                      const active = priceMin === preset.min && priceMaxRaw === preset.max
                      return (
                        <Link key={preset.label} href={`${categoryPath}${buildQuery((p) => { p.set("priceMin", String(preset.min)); p.set("priceMax", String(preset.max)) }, { resetPage: true })}`} className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${active ? "border-[#dcc6a2] bg-[#f4ead9] text-[#3c3127]" : "border-[#e7dfd4] bg-[#fffdfa] text-[#70675c] hover:border-[#d8cebf] hover:text-[#2c261f]"}`}>
                          {preset.label}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <section className="min-w-0">
            <div className="min-w-0 rounded-[30px] border border-[#ece5da] bg-[#f8f5f0] p-3 text-[#4d453b] shadow-[0_20px_52px_rgba(31,22,16,0.08)] sm:p-4 lg:p-5">
              <div className="lg:hidden">
                <MobileFilterDrawer
                  categoryPath={categoryPath}
                  resultCount={metadata.total}
                  sections={mobileFilterSections}
                  activeChips={activeFilterChips}
                />
              </div>

              <div className="rounded-[24px] border border-[#e7dfd4] bg-[#fffdfa] px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-4">
                  <div className="min-w-0">
                    <div className="text-sm text-[#918778]">
                      <Link href="/" className="hover:text-[#2c261f]">Home</Link>
                      {" / "}
                      <Link href="/shop" className="hover:text-[#2c261f]">Shop</Link>
                      {breadcrumbItems.map((item) => (
                        <span key={item.id}>
                          {" / "}
                          <Link href={item.path} className={item.id === category.id ? "font-medium text-[#2c261f]" : "hover:text-[#2c261f]"}>
                            {item.title}
                          </Link>
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-[#6f655b]">Active:</span>
                      {activeFilterChips.length > 0 ? activeFilterChips.map((chip) => (
                        <Link
                          key={chip.key}
                          href={chip.href}
                          className="inline-flex items-center rounded-full border border-[#dcc6a2] bg-[#f4ead9] px-3 py-1.5 text-sm font-medium text-[#3c3127]"
                        >
                          {chip.label}
                        </Link>
                      )) : <span className="text-sm text-[#8f877a]">No active filters</span>}
                      <Link href={categoryPath} className="ml-auto text-sm font-medium text-[#8f877a] transition-colors hover:text-[#2c261f]">
                        Clear all
                      </Link>
                    </div>
                  </div>

                  <div className="grid gap-3 border-t border-[#eee6db] pt-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                    <div>
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <p className="text-2xl font-semibold tracking-[-0.03em] text-[#2c261f]">{metadata.total} rugs found</p>
                          <p className="mt-1 text-sm text-[#8d8478]">Dense editorial browsing with live filters and search.</p>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-[#7c7368]">
                          <span className="font-medium text-[#5f564b]">Show</span>
                          {[8, 16, 20, 32, 36].map((n) => (
                            <Link key={n} href={`${categoryPath}${buildQuery((p) => p.set("limit", String(n)), { resetPage: true })}`} className={limitValue === n ? "rounded-full bg-[#caa56a] px-2.5 py-1 text-white" : "rounded-full border border-[#e7dfd4] bg-[#f5f1ea] px-2.5 py-1 text-[#8f877a] hover:border-[#d8cebf] hover:text-[#2c261f]"}>
                              {n}
                            </Link>
                          ))}
                        </div>
                      </div>
                      <form method="get" action={categoryPath} className="mt-3 flex flex-col gap-3 xl:flex-row">
                        {Object.entries(searchParams).flatMap(([key, value]) => {
                          if (key === "q" || key === "page" || value === undefined) return []
                          if (Array.isArray(value)) return value.map((item, idx) => <input key={`${key}-${item}-${idx}`} type="hidden" name={key} value={item} />)
                          return <input key={key} type="hidden" name={key} value={value} />
                        })}
                        <input type="hidden" name="page" value="1" />
                        <input type="hidden" name="limit" value={String(limitValue)} />
                        <div className="flex h-12 w-full items-center rounded-full border border-[#e7dfd4] bg-[#f7f3ed] px-4 xl:max-w-[430px]">
                          <input name="q" defaultValue={query} placeholder="Search within this collection" className="w-full bg-transparent text-sm text-[#3f372e] placeholder:text-[#9a9083] outline-none" />
                        </div>
                        <div className="flex items-center gap-1 self-start rounded-full border border-[#e7dfd4] bg-[#f7f3ed] p-1">
                          <Link href={`${categoryPath}${buildQuery((p) => p.set("view", "2"))}`} className={`rounded-full p-2 ${viewMode === "2" ? "bg-[#caa56a] text-white" : "text-[#8f877a]"}`}><Grid2x2 className="h-4 w-4" /></Link>
                          <Link href={`${categoryPath}${buildQuery((p) => p.set("view", "3"))}`} className={`rounded-full p-2 ${viewMode === "3" ? "bg-[#caa56a] text-white" : "text-[#8f877a]"}`}><Rows3 className="h-4 w-4" /></Link>
                          <Link href={`${categoryPath}${buildQuery((p) => p.set("view", "4"))}`} className={`rounded-full p-2 ${viewMode === "4" ? "bg-[#caa56a] text-white" : "text-[#8f877a]"}`}><LayoutGrid className="h-4 w-4" /></Link>
                          <Link href={`${categoryPath}${buildQuery((p) => p.set("view", "list"))}`} className={`rounded-full p-2 ${viewMode === "list" ? "bg-[#caa56a] text-white" : "text-[#8f877a]"}`}><List className="h-4 w-4" /></Link>
                        </div>
                      </form>
                    </div>

                    <form method="get" action={categoryPath} className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[250px]">
                      {Object.entries(searchParams).flatMap(([key, value]) => {
                        if (key === "sort" || key === "page" || value === undefined) return []
                        if (Array.isArray(value)) return value.map((item, idx) => <input key={`${key}-${item}-${idx}`} type="hidden" name={key} value={item} />)
                        return <input key={key} type="hidden" name={key} value={value} />
                      })}
                      <input type="hidden" name="page" value="1" />
                      <input type="hidden" name="limit" value={String(limitValue)} />
                      <label className="text-sm font-medium text-[#6f655b]">Sort</label>
                      <select name="sort" defaultValue={sortValue} className="h-12 min-w-0 rounded-full border border-[#e7dfd4] bg-[#f7f3ed] px-4 text-sm font-medium text-[#3f372e] sm:min-w-[220px]">
                        <option value="latest">Newest first</option>
                        <option value="price-asc">Price: low to high</option>
                        <option value="price-desc">Price: high to low</option>
                        <option value="oldest">Oldest first</option>
                      </select>
                      <button type="submit" className="h-11 rounded-full border border-[#dcc6a2] bg-[#f4ead9] px-5 text-sm font-semibold text-[#3c3127] transition-colors hover:bg-[#efdfc7]">
                        Apply Sort
                      </button>
                    </form>
                  </div>
                </div>
              </div>

              {products.length === 0 ? <div className="mt-4 rounded-[24px] border border-dashed border-[#e7dfd4] bg-[#fffdfa] px-8 py-16 text-center text-[#948b7d]">No products were found matching your selection.</div> : (
                <>
                  <div className={productGridClassName}>
                    {products.map((product) => {
                    const parsedImages = parseProductImageRecords(product.images)
                    if (viewMode === "list") {
                      const image = getProductImageUrl(parsedImages[0], "large") || "/placeholder.jpg"
                      return (
                        <Link key={product.id} href={`/product/${product.slug}`} className="flex flex-col gap-4 rounded-[26px] border border-[#e7dfd4] bg-[#fffdfa] p-4 hover:bg-[#fcf8f3] sm:flex-row">
                          <div className="flex h-40 w-full items-center justify-center overflow-hidden rounded-2xl bg-[linear-gradient(180deg,#efe5d5_0%,#eadfcf_100%)] p-3 sm:h-36 sm:w-36 sm:shrink-0"><img src={image} alt={buildProductImageAlt({ title: product.title, fallbackAlt: parsedImages[0]?.alt, categories: product.categories })} loading="lazy" decoding="async" className="h-full w-full object-contain transition-transform duration-300 hover:scale-105" /></div>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-lg font-semibold text-[#2c261f]">{product.title}</p>
                            <p className="mt-1 text-sm text-[#8d8478]">{product.categories?.map((c) => c.title).slice(0, 2).join(", ") || "Rug House Collection"}</p>
                            <div className="mt-3 flex items-center gap-2"><span className="text-2xl font-bold text-[#2c261f]">{formatCurrency(product.price, currencySettings)}</span>{product.compareAtPrice && product.compareAtPrice > product.price ? <span className="text-base text-[#8d857b] line-through">{formatCurrency(product.compareAtPrice, currencySettings)}</span> : null}</div>
                            <p className="mt-2 line-clamp-3 text-xs leading-5 text-[#8d857b]">{stripHtml(product.description) || "Premium hand-crafted rug with authentic weaving details and durable natural fibers."}</p>
                          </div>
                        </Link>
                      )
                    }
                    return <CategoryListingProductCard key={product.id} product={product} currencySettings={currencySettings} />
                  })}
                  </div>
                  <ListingPagination
                    currentPage={metadata.page}
                    totalPages={metadata.totalPages}
                    buildHref={(nextPage) => `${categoryPath}${buildQuery((p) => p.set("page", String(nextPage)))}`}
                    theme="dark"
                    className="mt-5"
                  />
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
