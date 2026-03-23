import dynamic from "next/dynamic"
import Link from "next/link"

import { CategoryHoverProductCardServer } from "@/components/storefront/category-hover-product-card-server"
import { ProductDetailGallery } from "@/components/storefront/product-detail-gallery"
import { ProductDetailPurchase } from "@/components/storefront/product-detail-purchase"
import { ProductDetailEngagement } from "@/components/storefront/product-detail-engagement"
import { ProductDetailInfoTabs } from "@/components/storefront/product-detail-info-tabs"
import {
  buildProductGallery,
  getProductDescriptionState,
  parseImages,
  richContentClassName,
  type NavProduct,
  type ProductDetailData,
  type RelatedProduct,
} from "@/components/storefront/product-detail-shared"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { formatCurrency, type CurrencySettings } from "@/lib/storefront/currency"

const ProductDetailShare = dynamic(
  () => import("@/components/storefront/product-detail-share").then((mod) => mod.ProductDetailShare)
)

const ProductDetailRecentlyViewed = dynamic(
  () => import("@/components/storefront/product-detail-recently-viewed").then((mod) => mod.ProductDetailRecentlyViewed)
)

export function ProductDetailView({
  product,
  relatedProducts,
  previousProduct,
  nextProduct,
  shippingContent,
  currencySettings,
}: {
  product: ProductDetailData
  relatedProducts: RelatedProduct[]
  previousProduct?: NavProduct | null
  nextProduct?: NavProduct | null
  shippingContent?: string | null
  currencySettings?: CurrencySettings
}) {
  const gallery = buildProductGallery(product)
  const productImageStateKey = `${product.id}:${product.slug}:${product.images}`
  const stockLimit = Math.max(0, product.stockCount)
  const isMarkedOutOfStock = product.isStock === false && stockLimit > 0
  const isSold = stockLimit <= 0
  const showUrgency = stockLimit === 1 && !isSold
  const discountActive = product.compareAtPrice && product.compareAtPrice > product.price
  const discountPercent = discountActive
    ? Math.round((((product.compareAtPrice as number) - product.price) / (product.compareAtPrice as number)) * 100)
    : 0
  const primaryCategory = product.categories[0]
  const visibleCategories = product.categories.slice(0, 2)
  const heroImage = gallery[0]?.src || "/placeholder.jpg"
  const { shortDescriptionHtml, bottomDescriptionHtml, canExpandBottomDescription, shippingText, canExpandShipping } =
    getProductDescriptionState(product, shippingContent)

  return (
    <div className="bg-white min-h-screen pb-20">
      <ProductDetailRecentlyViewed
        productId={product.id}
        slug={product.slug}
        title={product.title}
        price={product.price}
        image={heroImage}
      />

      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="text-sm text-slate-500">
            <Link href="/" className="hover:text-slate-800">Home</Link>
            <span className="mx-2">/</span>
            {primaryCategory ? (
              <>
                <Link href={primaryCategory.path || `/${primaryCategory.slug}`} className="hover:text-slate-800">{primaryCategory.title}</Link>
                <span className="mx-2">/</span>
              </>
            ) : null}
            <span className="text-slate-900 font-medium">{product.title}</span>
          </div>

          <div className="flex items-center gap-2">
            <ProductNavigationPreview product={previousProduct} direction="previous" currencySettings={currencySettings} />
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#dce3ed] bg-white text-slate-700">
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><path fill="currentColor" d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z" /></svg>
            </span>
            <ProductNavigationPreview product={nextProduct} direction="next" currencySettings={currencySettings} />
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
          <section>
            <ProductDetailGallery
              gallery={gallery}
              productImageStateKey={productImageStateKey}
              discountPercent={discountPercent}
              isMarkedOutOfStock={isMarkedOutOfStock}
              isSold={isSold}
            />
          </section>

          <section>
            <h1 className="font-serif text-3xl leading-tight text-slate-900">{product.title}</h1>
            <div className="mt-4 flex items-center gap-3">
              <span className="text-2xl font-bold text-emerald-700">{formatCurrency(product.price, currencySettings)}</span>
              {discountActive ? (
                <span className="text-base text-slate-400 line-through">{formatCurrency(product.compareAtPrice || 0, currencySettings)}</span>
              ) : null}
            </div>

            {shortDescriptionHtml ? (
              <div className="mt-6">
                <div className={`product-short-description ${richContentClassName}`} dangerouslySetInnerHTML={{ __html: shortDescriptionHtml }} />
              </div>
            ) : null}

            {showUrgency ? (
              <div className="mt-5 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800">
                Only one available
              </div>
            ) : null}

            <div className="mt-7 border-y border-[#e6edf5]">
              <div className="grid grid-cols-2 md:flex md:items-center md:gap-8">
                {[
                  { icon: "🧿", label: "One Of a Kind" },
                  { icon: "🧶", label: "Handmade" },
                  { icon: "🌿", label: "Natural Fiber" },
                  { icon: "🚚", label: "Free Shipping" },
                ].map((feature, index) => (
                  <div key={feature.label} className={`flex items-center gap-2 px-3 py-3 ${index % 2 === 0 ? "border-r border-[#e6edf5]" : ""} ${index < 2 ? "border-b border-[#e6edf5]" : ""} md:border-0 md:px-0`}>
                    <span className="text-xl leading-none">{feature.icon}</span>
                    <span className="text-[16px] font-normal text-black">{feature.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <ProductDetailPurchase product={product} image={heroImage} />

            <div className="mt-6 rounded-2xl border border-[#e6edf5] bg-[#fcfdfd] p-5">
              <ul className="space-y-2 text-sm text-slate-700">
                {[
                  "Handmade & one-of-a-kind",
                  "Sourced from Anatolia",
                  "Free worldwide shipping",
                  "14-day returns",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-700" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 border-t border-[#e6edf5] pt-4 text-sm text-slate-700">
                <p className="font-medium text-slate-900">Delivery</p>
                <p className="mt-1">Ships in 1–3 business days</p>
                <p>Estimated delivery: 5–7 days worldwide</p>
              </div>

              <div className="mt-4 border-t border-[#e6edf5] pt-4">
                <p className="text-sm font-medium text-slate-900">Trusted by collectors worldwide</p>
              </div>

              <div className="mt-4 border-t border-[#e6edf5] pt-4">
                <h2 className="text-sm font-semibold text-slate-900">Is this rug right for you?</h2>
                <ul className="mt-2 space-y-2 text-sm text-slate-700">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                    <span>Ideal for living rooms, bedrooms, and statement spaces</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                    <span>Best for those who value craftsmanship over mass production</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-8 border-t border-[#e6edf5] pt-5 text-sm text-slate-700">
              <span className="font-semibold text-slate-900">Category:</span>{" "}
              {visibleCategories.length > 0 ? (
                <>
                  {visibleCategories.map((cat, i) => (
                    <span key={cat.id}>
                      <Link href={cat.path || `/${cat.slug}`} className="text-emerald-700 hover:underline">{cat.title}</Link>
                      {i < visibleCategories.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </>
              ) : (
                <span className="text-slate-500">Uncategorized</span>
              )}
            </div>

            <ProductDetailEngagement product={product} image={heroImage} />
            <ProductDetailShare title={product.title} />
          </section>
        </div>

        <ProductDetailInfoTabs
          product={product}
          bottomDescriptionHtml={bottomDescriptionHtml}
          canExpandBottomDescription={canExpandBottomDescription}
          shippingText={shippingText}
          canExpandShipping={canExpandShipping}
        />

        {relatedProducts.length > 0 ? (
          <section className="mt-16">
            <h2 className="text-3xl font-serif font-bold text-slate-900 mb-6">You May Also Like</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-5">
              {relatedProducts.map((item) => (
                <CategoryHoverProductCardServer key={item.id} product={item} currencySettings={currencySettings} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}

function ProductNavigationPreview({
  product,
  direction,
  currencySettings,
}: {
  product?: NavProduct | null
  direction: "previous" | "next"
  currencySettings?: CurrencySettings
}) {
  const iconEl = direction === "previous"
    ? <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path fill="currentColor" d="M15.4 5.4L8.8 12l6.6 6.6-1.4 1.4L6 12l8-8z"/></svg>
    : <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path fill="currentColor" d="M8.6 18.6L15.2 12 8.6 5.4 10 4l8 8-8 8z"/></svg>

  return (
    <div className="group relative">
      {product ? (
        <Link href={`/product/${product.slug}`} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#dce3ed] bg-white text-slate-700 hover:bg-slate-50">
          {iconEl}
        </Link>
      ) : (
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#e5e9ef] bg-slate-100 text-slate-300">
          {iconEl}
        </span>
      )}
      {product ? (
        <div className="pointer-events-none absolute right-0 top-11 z-50 hidden w-64 rounded-md border border-[#dce3ed] bg-white p-3 shadow-[0_14px_34px_rgba(15,23,42,0.14)] group-hover:block">
          <div className="flex items-center gap-3">
            <ResponsiveImage
              src={parseImages(product.images)[0] || "/placeholder.jpg"}
              alt={product.title}
              width={64}
              height={64}
              sizes="64px"
              className="h-16 w-16 rounded-md border border-[#dce3ed] object-cover"
            />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-slate-900">{product.title}</p>
              <p className="text-xl font-bold text-emerald-700">{formatCurrency(product.price, currencySettings)}</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
