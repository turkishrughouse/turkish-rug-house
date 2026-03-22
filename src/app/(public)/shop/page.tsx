import Link from "next/link"
import { Grid3X3, LayoutGrid, Menu } from "lucide-react"

import { ResponsiveImage } from "@/components/ui/responsive-image"
import { ShopProductCardServer } from "@/components/storefront/shop-product-card-server"
import { getProducts, getProductOptions } from "@/lib/actions/product-actions"
import { prisma } from "@/lib/db"
import { getSiteSettings } from "@/lib/site-settings"
import { buildProductImageAlt, getProductImageUrl, parseProductImageRecords } from "@/lib/product-images"
import { formatCurrency } from "@/lib/storefront/currency"
import { getStorefrontCurrencySnapshot } from "@/lib/storefront/currency-server"

type ShopPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export const revalidate = 300

function getMaterialDelegate() {
  return (prisma as unknown as {
    material?: {
      findMany: (...args: any[]) => Promise<Array<{ id: string; slug: string; name: string; _count: { products: number } }>>
    }
  }).material
}

function getParam(params: { [key: string]: string | string[] | undefined }, key: string) {
  const value = params[key]
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function getSingle(params: { [key: string]: string | string[] | undefined }, key: string) {
  const value = params[key]
  if (!value) return ""
  return Array.isArray(value) ? value[0] || "" : value
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const currencySnapshot = await getStorefrontCurrencySnapshot()
  const currencySettings = {
    selectedCurrency: currencySnapshot.selectedCurrency,
    usdToEurRate: currencySnapshot.usdToEurRate,
    locale: currencySnapshot.locale,
  }
  const resolved = await searchParams
  const query = getSingle(resolved, "q")
  const sortInput = getSingle(resolved, "sort")
  const sort: "latest" | "oldest" | "price-asc" | "price-desc" =
    sortInput === "oldest" || sortInput === "price-asc" || sortInput === "price-desc" ? sortInput : "latest"
  const showInput = Number(getSingle(resolved, "show") || 24)
  const showValue = [8, 16, 24, 36].includes(showInput) ? showInput : 24
  const inStockOnly = resolved["inStock"] === "true"
  const selectedColors = getParam(resolved, "color")
  const selectedMaterials = getParam(resolved, "material")
  const priceMin = Number(getSingle(resolved, "priceMin") || 0)
  const priceMaxRaw = Number(getSingle(resolved, "priceMax") || 0)
  const hasPriceFilter = Number.isFinite(priceMin) && Number.isFinite(priceMaxRaw) && priceMaxRaw > 0

  const filters = {
    types: getParam(resolved, "type"),
    styles: getParam(resolved, "style"),
    colors: selectedColors,
    sizes: getParam(resolved, "size"),
    ages: getParam(resolved, "age"),
    materials: getParam(resolved, "material"),
    inStock: inStockOnly,
    priceMin: hasPriceFilter ? priceMin : undefined,
    priceMax: hasPriceFilter ? priceMaxRaw : undefined,
  }

  const materialDelegate = getMaterialDelegate()
  const [{ products }, options, siteSettings, colorCounters, materialCounters] = await Promise.all([
    getProducts(1, showValue, query, "published", sort, undefined, filters),
    getProductOptions(),
    getSiteSettings(),
    prisma.color.findMany({
      select: {
        id: true,
        slug: true,
        _count: {
          select: {
            products: {
              where: {
                isPublished: true,
                OR: query ? [{ title: { contains: query } }, { slug: { contains: query } }] : undefined,
                types: filters.types.length ? { some: { slug: { in: filters.types } } } : undefined,
                styles: filters.styles.length ? { some: { slug: { in: filters.styles } } } : undefined,
                sizes: filters.sizes.length ? { some: { slug: { in: filters.sizes } } } : undefined,
                ages: filters.ages.length ? { some: { slug: { in: filters.ages } } } : undefined,
                materials: filters.materials.length ? { some: { slug: { in: filters.materials } } } : undefined,
                isStock: inStockOnly ? true : undefined,
                price: hasPriceFilter ? { gte: priceMin, lte: priceMaxRaw } : undefined,
              },
            },
          },
        },
      },
    }),
    materialDelegate?.findMany
      ? materialDelegate.findMany({
          select: {
            id: true,
            slug: true,
            name: true,
            _count: {
              select: {
                products: {
                  where: {
                    isPublished: true,
                    OR: query ? [{ title: { contains: query } }, { slug: { contains: query } }] : undefined,
                    types: filters.types.length ? { some: { slug: { in: filters.types } } } : undefined,
                    styles: filters.styles.length ? { some: { slug: { in: filters.styles } } } : undefined,
                    colors: filters.colors.length ? { some: { slug: { in: filters.colors } } } : undefined,
                    sizes: filters.sizes.length ? { some: { slug: { in: filters.sizes } } } : undefined,
                    ages: filters.ages.length ? { some: { slug: { in: filters.ages } } } : undefined,
                    isStock: inStockOnly ? true : undefined,
                    price: hasPriceFilter ? { gte: priceMin, lte: priceMaxRaw } : undefined,
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
  ])

  const visibleProducts = siteSettings.hideOutOfStockOnShop
    ? products.filter((product) => (product.isStock ?? true) && (product.stockCount ?? 0) > 0)
    : products

  const heroImage = getProductImageUrl(parseProductImageRecords(visibleProducts[0]?.images || "")[0], "large") || "/placeholder.jpg"

  const categoryMap = new Map<string, { title: string; slug: string; count: number }>()
  visibleProducts.forEach((product) => {
    product.categories?.forEach((category) => {
      const current = categoryMap.get(category.id)
      if (current) {
        current.count += 1
      } else {
        categoryMap.set(category.id, { title: category.title, slug: category.slug, count: 1 })
      }
    })
  })
  const heroCategories = Array.from(categoryMap.values()).slice(0, 6)

  const colorCountMap = new Map(colorCounters.map((entry) => [entry.slug, entry._count.products]))
  const materialCountMap = new Map(materialCounters.map((entry) => [entry.slug, entry._count.products]))

  const maxShopPrice = visibleProducts.reduce((max, product) => Math.max(max, Number(product.price || 0)), 0)
  const pricePresets = [
    { min: 0, max: 500, label: "$0 - $500" },
    { min: 500, max: 1000, label: "$500 - $1000" },
    { min: 1000, max: 2500, label: "$1000 - $2500" },
    { min: 2500, max: Math.max(3000, Math.ceil(maxShopPrice / 100) * 100), label: `$2500 - $${Math.max(3000, Math.ceil(maxShopPrice / 100) * 100)}` },
  ]

  const activePriceLabel = hasPriceFilter ? `$${priceMin} - $${priceMaxRaw}` : "Any"
  const sidebarProducts = visibleProducts.slice(0, 5)

  const buildQuery = (mutator: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams()
    Object.entries(resolved).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item) => params.append(key, item))
      } else if (value !== undefined) {
        params.set(key, value)
      }
    })
    mutator(params)
    const q = params.toString()
    return q ? `?${q}` : ""
  }

  return (
    <div className="min-h-screen bg-white">
      <section className="relative overflow-hidden border-b border-[#e5e7eb]">
        <div className="relative h-[210px] w-full">
          <ResponsiveImage
            src={heroImage}
            alt="Shop banner"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
        </div>
        <div className="absolute inset-0 bg-[rgba(15,23,42,0.42)]" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <h1 className="font-serif text-5xl font-bold text-white md:text-6xl">Shop</h1>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-white/95">
            {heroCategories.length > 0
              ? heroCategories.map((category) => (
                  <Link key={`${category.slug}-${category.title}`} href={`/category/${category.slug}`} className="text-left transition-opacity hover:opacity-80">
                    <p className="text-sm font-semibold uppercase tracking-wide md:text-base">{category.title}</p>
                    <p className="text-xs opacity-90">{category.count} Products</p>
                  </Link>
                ))
              : null}
          </div>
        </div>
      </section>

      <section className="border-y border-[#e5e7eb] bg-white">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="text-xs text-slate-600">
            <Link href="/" className="hover:text-slate-900">Home</Link>
            <span className="mx-2">/</span>
            <span className="font-semibold text-slate-900">Shop</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800">Show :</span>
              {[8, 16, 24, 36].map((n, idx) => (
                <span key={n}>
                  <Link href={`/shop${buildQuery((p) => p.set("show", String(n)))}`} className={showValue === n ? "font-semibold text-slate-900" : "hover:text-slate-900"}>{n}</Link>
                  {idx < 3 ? <span className="mx-1">/</span> : null}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <Menu className="h-5 w-5" />
              <LayoutGrid className="h-5 w-5" />
              <Grid3X3 className="h-5 w-5 text-slate-900" />
            </div>
            <form method="get" action="/shop" className="flex items-center gap-2">
              {Object.entries(resolved).flatMap(([key, value]) => {
                if (key === "sort" || value === undefined) return []
                if (Array.isArray(value)) {
                  return value.map((item, idx) => (
                    <input key={`${key}-${item}-${idx}`} type="hidden" name={key} value={item} />
                  ))
                }
                return <input key={key} type="hidden" name={key} value={value} />
              })}
              <select name="sort" defaultValue={sort} className="h-8 rounded-md border border-[#dce3ed] bg-white px-3 text-xs text-slate-700">
                <option value="latest">Default sorting</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="oldest">Oldest first</option>
              </select>
              <button type="submit" className="h-8 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">Apply</button>
            </form>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-6 py-10">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <aside className="lg:col-span-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-6">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">Product Status</h3>
                <div className="mt-4 space-y-2">
                  <Link
                    href={`/shop${buildQuery((p) => (inStockOnly ? p.delete("inStock") : p.set("inStock", "true")))}`}
                    className="flex items-center justify-between rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <span>In stock only</span>
                    <span className={`h-2.5 w-2.5 rounded-full ${inStockOnly ? "bg-teal-600" : "bg-slate-300"}`} />
                  </Link>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-5">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">Filter By Color</h3>
                <div className="mt-4 space-y-1.5">
                  {options.colors.map((color) => {
                    const active = selectedColors.includes(color.slug)
                    const count = colorCountMap.get(color.slug) || 0
                    return (
                      <Link
                        key={color.id}
                        href={`/shop${buildQuery((p) => {
                          const existing = p.getAll("color")
                          p.delete("color")
                          if (existing.includes(color.slug)) {
                            existing.filter((item) => item !== color.slug).forEach((item) => p.append("color", item))
                          } else {
                            existing.forEach((item) => p.append("color", item))
                            p.append("color", color.slug)
                          }
                        })}`}
                        className={`flex items-center justify-between rounded-md px-2 py-2 text-sm ${active ? "bg-teal-50 text-teal-800" : "text-slate-700 hover:bg-slate-50"}`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full border border-slate-300" style={{ backgroundColor: color.hex || "#d1d5db" }} />
                          {color.name}
                        </span>
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
                      <Link
                        key={preset.label}
                        href={`/shop${buildQuery((p) => {
                          p.set("priceMin", String(preset.min))
                          p.set("priceMax", String(preset.max))
                        })}`}
                        className={`block rounded-md px-2 py-2 text-sm ${active ? "bg-teal-50 text-teal-800" : "text-slate-700 hover:bg-slate-50"}`}
                      >
                        {preset.label}
                      </Link>
                    )
                  })}
                </div>
              </div>

              <div className="border-t border-slate-200 pt-5">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">Filter By Material</h3>
                <div className="mt-4 space-y-1.5">
                  {options.materials.map((material) => {
                    const active = selectedMaterials.includes(material.slug)
                    const count = materialCountMap.get(material.slug) || 0
                    return (
                      <Link
                        key={material.id}
                        href={`/shop${buildQuery((p) => {
                          const existing = p.getAll("material")
                          p.delete("material")
                          if (existing.includes(material.slug)) {
                            existing.filter((item) => item !== material.slug).forEach((item) => p.append("material", item))
                          } else {
                            existing.forEach((item) => p.append("material", item))
                            p.append("material", material.slug)
                          }
                        })}`}
                        className={`flex items-center justify-between rounded-md px-2 py-2 text-sm ${active ? "bg-teal-50 text-teal-800" : "text-slate-700 hover:bg-slate-50"}`}
                      >
                        <span>{material.name}</span>
                        <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500">{count}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>

              <div className="border-t border-slate-200 pt-5">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">Category Products</h3>
                <div className="mt-4 space-y-3">
                  {sidebarProducts.length === 0 ? (
                    <p className="text-sm text-slate-500">No products found.</p>
                  ) : sidebarProducts.map((product) => {
                    const parsedImages = parseProductImageRecords(product.images)
                    const image = getProductImageUrl(parsedImages[0], "thumb") || "/placeholder.jpg"
                    return (
                      <Link key={product.id} href={`/product/${product.slug}`} className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-slate-50">
                        <ResponsiveImage
                          src={image}
                          alt={buildProductImageAlt({ title: product.title, fallbackAlt: parsedImages[0]?.alt })}
                          width={48}
                          height={48}
                          sizes="48px"
                          className="h-12 w-12 rounded-md border border-slate-200 object-cover"
                        />
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

          <section className="lg:col-span-9">
            {visibleProducts.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white p-10 text-center">
                <p className="text-slate-600">No products found for this filter.</p>
                <Link href="/shop" className="mt-4 inline-flex h-10 items-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800">
                  Reset filters
                </Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
                  {visibleProducts.map((product) => (
                    <ShopProductCardServer
                      key={product.id}
                      product={product}
                catalogMode={siteSettings.showCatalogMode === "catalog"}
                currencySettings={currencySettings}
              />
                  ))}
                </div>
                <p className="mt-8 text-sm text-slate-500">{visibleProducts.length} products listed</p>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
