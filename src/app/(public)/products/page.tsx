import Link from "next/link"
import { getProducts } from "@/lib/actions/product-actions"
import { ShopProductCardServer } from "@/components/storefront/shop-product-card-server"
import { getSiteSettings } from "@/lib/site-settings"
import { getStorefrontCurrencySnapshot } from "@/lib/storefront/currency-server"
import { getProductOptions } from "@/lib/actions/product-actions"
import { prisma } from "@/lib/db"
import { buildListingPricePresets, buildProductSearchWhere, getMultiParam, getSingleParam, resolveSelectedOptionSlugs, resolveSelectedSizeSlugs } from "@/lib/storefront/listing-filters"

type ProductsPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const currencySnapshot = await getStorefrontCurrencySnapshot()
  const resolved = await searchParams
  const query = getSingleParam(resolved, "q")
  const sortInput = getSingleParam(resolved, "sort")
  const sort: "latest" | "oldest" | "price-asc" | "price-desc" =
    sortInput === "oldest" || sortInput === "price-asc" || sortInput === "price-desc"
      ? sortInput
      : "latest"
  const rawSelectedColors = getMultiParam(resolved, "color")
  const selectedCategories = getMultiParam(resolved, "category")
  const selectedStyles = getMultiParam(resolved, "style")
  const priceMin = Number(getSingleParam(resolved, "priceMin") || 0)
  const priceMaxRaw = Number(getSingleParam(resolved, "priceMax") || 0)
  const hasPriceFilter = Number.isFinite(priceMin) && Number.isFinite(priceMaxRaw) && priceMaxRaw > 0

  const [options, siteSettings] = await Promise.all([
    getProductOptions(),
    getSiteSettings(),
  ])
  const selectedColors = resolveSelectedOptionSlugs(rawSelectedColors, options.colors)
  const selectedSizes = resolveSelectedSizeSlugs(getMultiParam(resolved, "size"), options.sizes)
  const selectedCategoryIds = options.categories.filter((category) => selectedCategories.includes(category.slug)).map((category) => category.id)

  const filters = {
    styles: selectedStyles,
    colors: selectedColors,
    sizes: selectedSizes,
    categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
    priceMin: hasPriceFilter ? priceMin : undefined,
    priceMax: hasPriceFilter ? priceMaxRaw : undefined,
  }

  const facetBaseWhere = {
    isPublished: true,
    AND: buildProductSearchWhere(query),
    categories: selectedCategoryIds.length > 0 ? { some: { id: { in: selectedCategoryIds } } } : undefined,
    styles: selectedStyles.length ? { some: { slug: { in: selectedStyles } } } : undefined,
    colors: selectedColors.length ? { some: { slug: { in: selectedColors } } } : undefined,
    sizes: selectedSizes.length ? { some: { slug: { in: selectedSizes } } } : undefined,
    price: hasPriceFilter ? { gte: priceMin, lte: priceMaxRaw } : undefined,
  } as const

  const [{ products }, categoryCounters, styleCounters, colorCounters, sizeCounters] = await Promise.all([
    getProducts(1, 36, query, "published", sort, undefined, filters),
    prisma.category.findMany({ select: { id: true, slug: true, title: true, _count: { select: { products: { where: facetBaseWhere } } } } }),
    prisma.style.findMany({ select: { id: true, slug: true, name: true, _count: { select: { products: { where: facetBaseWhere } } } } }),
    prisma.color.findMany({ select: { id: true, slug: true, name: true, hex: true, _count: { select: { products: { where: facetBaseWhere } } } } }),
    prisma.size.findMany({ select: { id: true, slug: true, name: true, _count: { select: { products: { where: facetBaseWhere } } } } }),
  ])
  const visibleProducts = siteSettings.hideOutOfStockOnShop
    ? products.filter((product) => (product.isStock ?? true) && (product.stockCount ?? 0) > 0)
    : products

  const categoryCountMap = new Map(categoryCounters.map((entry) => [entry.slug, entry._count.products]))
  const styleCountMap = new Map(styleCounters.map((entry) => [entry.slug, entry._count.products]))
  const colorCountMap = new Map(colorCounters.map((entry) => [entry.slug, entry._count.products]))
  const sizeCountMap = new Map(sizeCounters.map((entry) => [entry.slug, entry._count.products]))
  const maxPrice = visibleProducts.reduce((max, product) => Math.max(max, Number(product.price || 0)), 0)
  const pricePresets = buildListingPricePresets(maxPrice)
  const activePriceLabel = hasPriceFilter ? `$${priceMin} - $${priceMaxRaw}` : "Any"

  const buildUrl = (nextSort: string) => {
    const params = new URLSearchParams()
    Object.entries(resolved).forEach(([key, value]) => {
      if (key === "sort" || value === undefined) return
      if (Array.isArray(value)) value.forEach((item) => params.append(key, item))
      else params.set(key, value)
    })
    params.set("sort", nextSort)
    return `/products?${params.toString()}`
  }

  const buildQuery = (mutator: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams()
    Object.entries(resolved).forEach(([key, value]) => {
      if (Array.isArray(value)) value.forEach((item) => params.append(key, item))
      else if (value !== undefined) params.set(key, value)
    })
    mutator(params)
    const next = params.toString()
    return next ? `?${next}` : ""
  }

  const activeFilterChips = [
    ...selectedCategories.map((slug) => ({ key: `category-${slug}`, label: `Category: ${options.categories.find((item) => item.slug === slug)?.title || slug}`, href: `/products${buildQuery((p) => {
      const next = p.getAll("category").filter((item) => item !== slug)
      p.delete("category")
      next.forEach((item) => p.append("category", item))
    })}` })),
    ...selectedStyles.map((slug) => ({ key: `style-${slug}`, label: `Style: ${options.styles.find((item) => item.slug === slug)?.name || slug}`, href: `/products${buildQuery((p) => {
      const next = p.getAll("style").filter((item) => item !== slug)
      p.delete("style")
      next.forEach((item) => p.append("style", item))
    })}` })),
    ...selectedColors.map((slug) => ({ key: `color-${slug}`, label: `Color: ${options.colors.find((item) => item.slug === slug)?.name || slug}`, href: `/products${buildQuery((p) => {
      const next = p.getAll("color").filter((item) => item !== slug)
      p.delete("color")
      next.forEach((item) => p.append("color", item))
    })}` })),
    ...selectedSizes.map((slug) => ({ key: `size-${slug}`, label: `Size: ${options.sizes.find((item) => item.slug === slug)?.name || slug}`, href: `/products${buildQuery((p) => {
      const next = p.getAll("size").filter((item) => item !== slug)
      p.delete("size")
      next.forEach((item) => p.append("size", item))
    })}` })),
    ...(hasPriceFilter ? [{ key: "price", label: `Price: ${activePriceLabel}`, href: `/products${buildQuery((p) => { p.delete("priceMin"); p.delete("priceMax") })}` }] : []),
  ]

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <section className="border-b border-slate-200 bg-[linear-gradient(120deg,#e9f2ef_0%,#f8fafc_100%)]">
        <div className="container mx-auto px-6 py-12">
          <h1 className="font-serif text-4xl font-bold text-slate-900">Shop All Rugs</h1>
          <p className="mt-3 text-slate-600">
            {visibleProducts.length} products available
              {query ? (
                <>
                  {" "}
                  for <span className="font-semibold text-slate-900">&quot;{query}&quot;</span>
                </>
              ) : null}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
            <Link href={buildUrl("latest")} className={`rounded-full px-3 py-1.5 ${sort === "latest" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"}`}>
              Newest
            </Link>
            <Link href={buildUrl("price-asc")} className={`rounded-full px-3 py-1.5 ${sort === "price-asc" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"}`}>
              Price: Low to High
            </Link>
            <Link href={buildUrl("price-desc")} className={`rounded-full px-3 py-1.5 ${sort === "price-desc" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"}`}>
              Price: High to Low
            </Link>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-6 py-10">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <aside className="lg:col-span-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">Filters</h2>
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">Filter By Category</h3>
                <div className="mt-4 space-y-1.5">
                  {options.categories.filter((category) => (categoryCountMap.get(category.slug) || 0) > 0).map((category) => {
                    const active = selectedCategories.includes(category.slug)
                    const count = categoryCountMap.get(category.slug) || 0
                    return (
                      <Link key={category.id} href={`/products${buildQuery((p) => {
                        const next = p.getAll("category")
                        p.delete("category")
                        if (next.includes(category.slug)) next.filter((item) => item !== category.slug).forEach((item) => p.append("category", item))
                        else {
                          next.forEach((item) => p.append("category", item))
                          p.append("category", category.slug)
                        }
                      })}`} className={`flex items-center justify-between rounded-md px-2 py-2 text-sm ${active ? "bg-teal-50 text-teal-800" : "text-slate-700 hover:bg-slate-50"}`}>
                        <span>{category.title}</span>
                        <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500">{count}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>

              <div className="border-t border-slate-200 pt-5">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">Filter By Style</h3>
                <div className="mt-4 space-y-1.5">
                  {options.styles.filter((style) => (styleCountMap.get(style.slug) || 0) > 0).map((style) => {
                    const active = selectedStyles.includes(style.slug)
                    const count = styleCountMap.get(style.slug) || 0
                    return (
                      <Link key={style.id} href={`/products${buildQuery((p) => {
                        const next = p.getAll("style")
                        p.delete("style")
                        if (next.includes(style.slug)) next.filter((item) => item !== style.slug).forEach((item) => p.append("style", item))
                        else {
                          next.forEach((item) => p.append("style", item))
                          p.append("style", style.slug)
                        }
                      })}`} className={`flex items-center justify-between rounded-md px-2 py-2 text-sm ${active ? "bg-teal-50 text-teal-800" : "text-slate-700 hover:bg-slate-50"}`}>
                        <span>{style.name}</span>
                        <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500">{count}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>

              <div className="border-t border-slate-200 pt-5">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">Filter By Size</h3>
                <div className="mt-4 space-y-1.5">
                  {options.sizes.filter((size) => (sizeCountMap.get(size.slug) || 0) > 0).map((size) => {
                    const active = selectedSizes.includes(size.slug)
                    const count = sizeCountMap.get(size.slug) || 0
                    return (
                      <Link key={size.id} href={`/products${buildQuery((p) => {
                        const next = p.getAll("size")
                        p.delete("size")
                        if (next.includes(size.slug)) next.filter((item) => item !== size.slug).forEach((item) => p.append("size", item))
                        else {
                          next.forEach((item) => p.append("size", item))
                          p.append("size", size.slug)
                        }
                      })}`} className={`flex items-center justify-between rounded-md px-2 py-2 text-sm ${active ? "bg-teal-50 text-teal-800" : "text-slate-700 hover:bg-slate-50"}`}>
                        <span>{size.name}</span>
                        <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500">{count}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>

              <div className="border-t border-slate-200 pt-5">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">Filter By Color</h3>
                <div className="mt-4 space-y-1.5">
                  {options.colors.filter((color) => (colorCountMap.get(color.slug) || 0) > 0).map((color) => {
                    const active = selectedColors.includes(color.slug)
                    const count = colorCountMap.get(color.slug) || 0
                    return (
                      <Link key={color.id} href={`/products${buildQuery((p) => {
                        const next = p.getAll("color")
                        p.delete("color")
                        if (next.includes(color.slug)) next.filter((item) => item !== color.slug).forEach((item) => p.append("color", item))
                        else {
                          next.forEach((item) => p.append("color", item))
                          p.append("color", color.slug)
                        }
                      })}`} className={`flex items-center justify-between rounded-md px-2 py-2 text-sm ${active ? "bg-teal-50 text-teal-800" : "text-slate-700 hover:bg-slate-50"}`}>
                        <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-slate-300" style={{ backgroundColor: color.hex || "#d1d5db" }} />{color.name}</span>
                        <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500">{count}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>

              <div className="border-t border-slate-200 pt-5">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">Filter By Price</h3>
                <p className="mt-2 text-xs text-slate-500">Selected: {activePriceLabel}</p>
                <div className="mt-4 space-y-2">
                  {pricePresets.map((preset) => {
                    const active = priceMin === preset.min && priceMaxRaw === preset.max
                    return (
                      <Link key={preset.label} href={`/products${buildQuery((p) => { p.set("priceMin", String(preset.min)); p.set("priceMax", String(preset.max)) })}`} className={`block rounded-md px-2 py-2 text-sm ${active ? "bg-teal-50 text-teal-800" : "text-slate-700 hover:bg-slate-50"}`}>
                        {preset.label}
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          </aside>

          <section className="lg:col-span-9">
            {activeFilterChips.length > 0 ? (
              <div className="mb-5 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">Active filters</span>
                    {activeFilterChips.map((chip) => (
                      <Link key={chip.key} href={chip.href} className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800 hover:bg-teal-100">
                        {chip.label}
                      </Link>
                    ))}
                  </div>
                  <Link href="/products" className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-200">
                    Clear all filters
                  </Link>
                </div>
              </div>
            ) : null}

            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm text-slate-600">{visibleProducts.length} products available</p>
            </div>

            {visibleProducts.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white p-10 text-center">
                <p className="text-slate-600">No products found for this filter.</p>
                <Link href="/products" className="mt-4 inline-flex h-10 items-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800">
                  Reset filters
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
                {visibleProducts.map((product) => (
                  <ShopProductCardServer
                    key={product.id}
                    product={product}
                    catalogMode={siteSettings.showCatalogMode === "catalog"}
                    currencySettings={{
                      selectedCurrency: currencySnapshot.selectedCurrency,
                      usdToEurRate: currencySnapshot.usdToEurRate,
                      locale: currencySnapshot.locale,
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
