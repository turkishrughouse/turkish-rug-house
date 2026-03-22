import Link from "next/link"
import { getProducts } from "@/lib/actions/product-actions"
import { ShopProductCardServer } from "@/components/storefront/shop-product-card-server"
import { getSiteSettings } from "@/lib/site-settings"
import { getStorefrontCurrencySnapshot } from "@/lib/storefront/currency-server"

type ProductsPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

function getSingle(params: { [key: string]: string | string[] | undefined }, key: string) {
  const value = params[key]
  if (!value) return ""
  return Array.isArray(value) ? value[0] || "" : value
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const currencySnapshot = await getStorefrontCurrencySnapshot()
  const resolved = await searchParams
  const query = getSingle(resolved, "q")
  const sortInput = getSingle(resolved, "sort")
  const sort: "latest" | "oldest" | "price-asc" | "price-desc" =
    sortInput === "oldest" || sortInput === "price-asc" || sortInput === "price-desc"
      ? sortInput
      : "latest"

  const [{ products }, siteSettings] = await Promise.all([
    getProducts(1, 36, query, "published", sort),
    getSiteSettings(),
  ])
  const visibleProducts = siteSettings.hideOutOfStockOnShop
    ? products.filter((product) => (product.isStock ?? true) && (product.stockCount ?? 0) > 0)
    : products

  const buildUrl = (nextSort: string) => {
    const params = new URLSearchParams()
    if (query) params.set("q", query)
    params.set("sort", nextSort)
    return `/products?${params.toString()}`
  }

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
      </div>
    </div>
  )
}
