import { notFound, permanentRedirect } from "next/navigation"
import Link from "next/link"
import { Metadata } from "next"
import { LayoutGrid, Grid2x2, Rows3, List } from "lucide-react"
import { StorefrontProductImage } from "@/components/storefront/storefront-product-image"
import { prisma } from "@/lib/db"
import { getProductIdsForFacetCounts, getProducts, getProductOptions } from "@/lib/actions/product-actions"
import { getAttributeFacetGroupsForProductIds } from "@/lib/product-attributes"
import { buildProductImageAlt, getProductImageUrl, getProductImageUrlCandidates, parseProductImageRecords } from "@/lib/product-images"
import { formatCurrency } from "@/lib/storefront/currency"
import { getStorefrontCurrencySnapshot } from "@/lib/storefront/currency-server"
import { buildListingPricePresets, buildProductSearchWhere, getMultiParam, getSingleParam, resolveSelectedOptionSlugs, resolveSelectedSizeSlugs } from "@/lib/storefront/listing-filters"
import { CategoryHoverProductCardServer } from "@/components/storefront/category-hover-product-card-server"
import { ListingPagination } from "@/components/storefront/listing-pagination"
import { fetchCategoryPathRows, getCategoryPathById, resolveCategoryByPath } from "@/lib/category-paths"
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
        "mt-5 grid min-w-0 grid-cols-2 auto-rows-fr gap-4 sm:gap-5",
        viewMode === "2" && "md:grid-cols-2",
        viewMode === "3" && "xl:grid-cols-3",
        viewMode === "4" && "lg:grid-cols-3 xl:grid-cols-4",
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

  const [category, options, maxPriceRow, categoryShortcutMenu] = await Promise.all([
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
    prisma.menu.findFirst({
      where: { location: "CATEGORY_ATTRIBUTE_SHORTCUTS" },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
        },
      },
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
  const { products: sidebarProducts } = await getProducts(1, 5, "", "published", "latest", category.slug, {
    categoryIds: categoryScopeIds,
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

  const shortcutCategoryIds = (categoryShortcutMenu?.items || [])
    .filter((item) => item.type === "CATEGORY" && item.referenceId)
    .map((item) => item.referenceId as string)

  const shortcutCategories = shortcutCategoryIds.length > 0
    ? await prisma.category.findMany({
        where: { id: { in: shortcutCategoryIds } },
        select: {
          id: true,
          slug: true,
          title: true,
          image: true,
          _count: { select: { products: true } },
        },
      })
    : []

  const shortcutCategoryMap = new Map(shortcutCategories.map((item) => [item.id, item]))

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
    <div className="bg-[#f5f7fb] min-h-screen pb-20">
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

      <div className="container mx-auto px-6 py-10">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <aside className="hidden lg:col-span-3 lg:block">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">Filters</h2>
              </div>
              {primaryAttributeFacetGroups.map((group, groupIndex) => (
                <div key={group.id} className={groupIndex === 0 ? "" : "border-t border-slate-200 pt-5"}>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">{group.name}</h3>
                  <div className="mt-4 space-y-1.5">
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
                          className={`flex items-center justify-between rounded-md px-2 py-2 text-sm ${active ? "bg-teal-50 text-teal-800" : "text-slate-700 hover:bg-slate-50"}`}
                        >
                          <span className="flex items-center gap-2">
                            {option.hex ? <span className="h-3 w-3 rounded-full border border-slate-300" style={{ backgroundColor: option.hex || "#d1d5db" }} /> : null}
                            {option.value}
                          </span>
                          <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500">{option.count}</span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
              {overflowAttributeFacetGroups.length > 0 ? (
                <div className="border-t border-slate-200 pt-5">
                  <details className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
                    <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">Show more filters</summary>
                    <div className="mt-4 space-y-5">
                      {overflowAttributeFacetGroups.map((group) => (
                        <div key={group.id}>
                          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">{group.name}</h3>
                          <div className="mt-3 space-y-1.5">
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
                                  className={`flex items-center justify-between rounded-md px-2 py-2 text-sm ${active ? "bg-teal-50 text-teal-800" : "text-slate-700 hover:bg-slate-50"}`}
                                >
                                  <span className="flex items-center gap-2">
                                    {option.hex ? <span className="h-3 w-3 rounded-full border border-slate-300" style={{ backgroundColor: option.hex || "#d1d5db" }} /> : null}
                                    {option.value}
                                  </span>
                                  <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500">{option.count}</span>
                                </Link>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              ) : null}

              <div className="border-t border-slate-200 pt-5">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">Filter By Price</h3>
                <p className="mt-2 text-xs text-slate-500">Selected: {activePriceLabel}</p>
                <div className="mt-4 space-y-2">
                  {pricePresets.map((preset) => {
                    const active = priceMin === preset.min && priceMaxRaw === preset.max
                    return (
                      <Link key={preset.label} href={`${categoryPath}${buildQuery((p) => { p.set("priceMin", String(preset.min)); p.set("priceMax", String(preset.max)) }, { resetPage: true })}`} className={`block rounded-md px-2 py-2 text-sm ${active ? "bg-teal-50 text-teal-800" : "text-slate-700 hover:bg-slate-50"}`}>{preset.label}</Link>
                    )
                  })}
                </div>
              </div>

              <div className="border-t border-slate-200 pt-5">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">Category Products</h3>
                <div className="mt-4 space-y-3">
                  {sidebarProducts.length === 0 ? <p className="text-sm text-slate-500">No products found in this category.</p> : sidebarProducts.map((product) => {
                    const parsedImages = parseProductImageRecords(product.images)
                    const thumbCandidates = getProductImageUrlCandidates(parsedImages[0], "thumb")
                    const largeCandidates = getProductImageUrlCandidates(parsedImages[0], "large")
                    return (
                      <Link key={product.id} href={`/product/${product.slug}`} className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-slate-50">
                        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 p-1">
                          <StorefrontProductImage
                            candidates={[...thumbCandidates, ...largeCandidates]}
                            alt={buildProductImageAlt({ title: product.title, fallbackAlt: parsedImages[0]?.alt, categories: product.categories })}
                            fill
                            sizes="48px"
                            className=""
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">{product.title}</p>
                          <p className="text-sm font-semibold text-emerald-700">{formatCurrency(product.price, currencySettings)}</p>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          </aside>

          <section className="min-w-0 lg:col-span-9">
            <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5">
                <h2 className="text-2xl font-serif font-bold text-slate-900">{category.title}</h2>
                {category.description ? (
                  <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">{stripHtml(category.description)}</p>
                ) : null}
              </div>

              <div className="mt-5 lg:hidden">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">Filters</h2>
                    <p className="text-xs text-slate-500">{metadata.total} products</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {primaryAttributeFacetGroups.map((group) => (
                      <details key={group.id} className={`rounded-xl border border-slate-200 bg-slate-50 p-3 ${group.options.length > 6 ? "col-span-2" : ""}`}>
                        <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">{group.name}</summary>
                        <div className="mt-3 grid grid-cols-2 gap-2">
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
                                className={`rounded-md px-3 py-2 text-xs ${active ? "bg-teal-50 text-teal-800" : "bg-white text-slate-700"}`}
                              >
                                <span className="flex items-center gap-2 truncate">
                                  {option.hex ? <span className="h-2.5 w-2.5 rounded-full border border-slate-300" style={{ backgroundColor: option.hex || "#d1d5db" }} /> : null}
                                  {option.value}
                                </span>
                                <span className="mt-1 block text-[11px] text-slate-500">{option.count}</span>
                              </Link>
                            )
                          })}
                        </div>
                      </details>
                    ))}
                    {overflowAttributeFacetGroups.length > 0 ? (
                      <details className="col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">Show more filters</summary>
                        <div className="mt-3 grid grid-cols-1 gap-3">
                          {overflowAttributeFacetGroups.map((group) => (
                            <details key={group.id} className="rounded-lg border border-slate-200 bg-white p-3">
                              <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">{group.name}</summary>
                              <div className="mt-3 grid grid-cols-2 gap-2">
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
                                      className={`rounded-md px-3 py-2 text-xs ${active ? "bg-teal-50 text-teal-800" : "bg-white text-slate-700"}`}
                                    >
                                      <span className="flex items-center gap-2 truncate">
                                        {option.hex ? <span className="h-2.5 w-2.5 rounded-full border border-slate-300" style={{ backgroundColor: option.hex || "#d1d5db" }} /> : null}
                                        {option.value}
                                      </span>
                                      <span className="mt-1 block text-[11px] text-slate-500">{option.count}</span>
                                    </Link>
                                  )
                                })}
                              </div>
                            </details>
                          ))}
                        </div>
                      </details>
                    ) : null}
                    <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">Price</summary>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {pricePresets.map((preset) => {
                          const active = priceMin === preset.min && priceMaxRaw === preset.max
                          return (
                            <Link key={preset.label} href={`${categoryPath}${buildQuery((p) => { p.set("priceMin", String(preset.min)); p.set("priceMax", String(preset.max)) }, { resetPage: true })}`} className={`rounded-md px-3 py-2 text-xs ${active ? "bg-teal-50 text-teal-800" : "bg-white text-slate-700"}`}>
                              {preset.label}
                            </Link>
                          )
                        })}
                      </div>
                    </details>
                  </div>
                </div>
              </div>

              {activeFilterChips.length > 0 ? (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">Active filters</span>
                      {activeFilterChips.map((chip) => (
                        <Link
                          key={chip.key}
                          href={chip.href}
                          className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800 hover:bg-teal-100"
                        >
                          {chip.label}
                        </Link>
                      ))}
                    </div>
                    <Link
                      href={categoryPath}
                      className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-200"
                    >
                      Clear all filters
                    </Link>
                  </div>
                </div>
              ) : null}

              <div className="mt-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="text-sm text-slate-500">
                  <Link href="/" className="hover:text-slate-900">Home</Link>
                  {" / "}
                  <Link href="/shop" className="hover:text-slate-900">Shop</Link>
                  {breadcrumbItems.map((item) => (
                    <span key={item.id}>
                      {" / "}
                      <Link href={item.path} className={item.id === category.id ? "font-medium text-slate-900" : "hover:text-slate-900"}>
                        {item.title}
                      </Link>
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 text-sm text-slate-700"><span className="font-semibold">Show :</span>{[8, 16, 20, 32, 36].map((n) => <Link key={n} href={`${categoryPath}${buildQuery((p) => p.set("limit", String(n)), { resetPage: true })}`} className={limitValue === n ? "font-semibold text-slate-900" : "text-slate-500 hover:text-slate-900"}>{n}</Link>)}</div>
                  <div className="h-5 w-px bg-slate-200" />
                  <div className="flex items-center gap-1">
                      <Link href={`${categoryPath}${buildQuery((p) => p.set("view", "2"))}`} className={`rounded border p-1.5 ${viewMode === "2" ? "bg-slate-900 text-white border-slate-900" : "text-slate-500 border-slate-200"}`}><Grid2x2 className="h-4 w-4" /></Link>
                    <Link href={`${categoryPath}${buildQuery((p) => p.set("view", "3"))}`} className={`rounded border p-1.5 ${viewMode === "3" ? "bg-slate-900 text-white border-slate-900" : "text-slate-500 border-slate-200"}`}><Rows3 className="h-4 w-4" /></Link>
                    <Link href={`${categoryPath}${buildQuery((p) => p.set("view", "4"))}`} className={`rounded border p-1.5 ${viewMode === "4" ? "bg-slate-900 text-white border-slate-900" : "text-slate-500 border-slate-200"}`}><LayoutGrid className="h-4 w-4" /></Link>
                    <Link href={`${categoryPath}${buildQuery((p) => p.set("view", "list"))}`} className={`rounded border p-1.5 ${viewMode === "list" ? "bg-slate-900 text-white border-slate-900" : "text-slate-500 border-slate-200"}`}><List className="h-4 w-4" /></Link>
                  </div>
                  <form method="get" action={categoryPath} className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
                    {Object.entries(searchParams).flatMap(([key, value]) => {
                      if (key === "sort" || key === "page" || value === undefined) return []
                      if (Array.isArray(value)) return value.map((item, idx) => <input key={`${key}-${item}-${idx}`} type="hidden" name={key} value={item} />)
                      return <input key={key} type="hidden" name={key} value={value} />
                    })}
                    <input type="hidden" name="page" value="1" />
                    <input type="hidden" name="limit" value={String(limitValue)} />
                    <select name="sort" defaultValue={sortValue} className="h-9 w-full min-w-0 rounded border border-slate-200 bg-white px-3 text-sm text-slate-700 sm:min-w-[190px]">
                      <option value="latest">Default sorting</option>
                      <option value="price-asc">Price: low to high</option>
                      <option value="price-desc">Price: high to low</option>
                      <option value="oldest">Oldest first</option>
                    </select>
                    <button type="submit" className="h-9 rounded border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">Apply</button>
                  </form>
                </div>
              </div>

              <form method="get" action={categoryPath} className="mt-4 rounded-md border border-slate-300 bg-white px-4 py-3">
                {Object.entries(searchParams).flatMap(([key, value]) => {
                  if (key === "q" || key === "page" || value === undefined) return []
                  if (Array.isArray(value)) return value.map((item, idx) => <input key={`${key}-${item}-${idx}`} type="hidden" name={key} value={item} />)
                  return <input key={key} type="hidden" name={key} value={value} />
                })}
                <input type="hidden" name="page" value="1" />
                <input type="hidden" name="limit" value={String(limitValue)} />
                <input name="q" defaultValue={query} placeholder="Search for products" className="w-full bg-transparent text-slate-900 placeholder:text-slate-400 outline-none" />
              </form>

              <div className="mt-3 flex items-center justify-between">
                <h2 className="text-sm font-medium text-slate-600">{metadata.total} products found</h2>
              </div>

              {products.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-8 py-16 text-center text-slate-500">No products were found matching your selection.</div> : (
                <>
                  <div className={productGridClassName}>
                    {products.map((product) => {
                    const parsedImages = parseProductImageRecords(product.images)
                    if (viewMode === "list") {
                      const image = getProductImageUrl(parsedImages[0], "large") || "/placeholder.jpg"
                      return (
                        <Link key={product.id} href={`/product/${product.slug}`} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 hover:bg-slate-50 sm:flex-row">
                          <div className="flex h-40 w-full items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 p-3 sm:h-36 sm:w-36 sm:shrink-0"><img src={image} alt={buildProductImageAlt({ title: product.title, fallbackAlt: parsedImages[0]?.alt, categories: product.categories })} loading="lazy" decoding="async" className="h-full w-full object-contain transition-transform duration-300 hover:scale-105" /></div>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-lg font-serif font-bold text-slate-900">{product.title}</p>
                            <p className="mt-1 text-sm text-slate-500">{product.categories?.map((c) => c.title).slice(0, 2).join(", ") || "Rug House Collection"}</p>
                            <div className="mt-3 flex items-center gap-2"><span className="text-2xl font-bold text-slate-900">{formatCurrency(product.price, currencySettings)}</span>{product.compareAtPrice && product.compareAtPrice > product.price ? <span className="text-base text-slate-400 line-through">{formatCurrency(product.compareAtPrice, currencySettings)}</span> : null}</div>
                            <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600">{stripHtml(product.description) || "Premium hand-crafted rug with authentic weaving details and durable natural fibers."}</p>
                          </div>
                        </Link>
                      )
                    }
                    return <CategoryHoverProductCardServer key={product.id} product={product} currencySettings={currencySettings} />
                  })}
                  </div>
                  <ListingPagination
                    currentPage={metadata.page}
                    totalPages={metadata.totalPages}
                    buildHref={(nextPage) => `${categoryPath}${buildQuery((p) => p.set("page", String(nextPage)))}`}
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
