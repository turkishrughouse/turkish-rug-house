import Link from "next/link"
import { FeaturedProducts } from "@/components/storefront/featured-products"
import { RecentlyViewedSection } from "@/components/storefront/recently-viewed-section"
import { ShopByStyleSection } from "@/components/storefront/shop-by-style-section"
import { getCategories } from "@/lib/actions/category-actions"
import { getProducts } from "@/lib/actions/product-actions"
import { getSiteSettings } from "@/lib/site-settings"
import { parseProductImages } from "@/lib/product-images"
import { getStorefrontCurrencySnapshot } from "@/lib/storefront/currency-server"

export const revalidate = 300

function rotateByOffset<T>(items: T[], offset: number) {
  if (!items.length) return items
  const safeOffset = ((offset % items.length) + items.length) % items.length
  return [...items.slice(safeOffset), ...items.slice(0, safeOffset)]
}

function parseMainImage(images: string) {
  return parseProductImages(images)[0] || "/placeholder.jpg"
}

function normalizeImagePath(value: string | null | undefined) {
  const image = typeof value === "string" ? value.trim() : ""
  if (!image) return null
  const [withoutQuery] = image.split("?")
  return withoutQuery || null
}

function getDescendantCategorySlugs(
  rootId: string,
  categories: Array<{ id: string; slug: string; parentId?: string | null }>
) {
  const byParent = new Map<string, Array<{ id: string; slug: string; parentId?: string | null }>>()
  categories.forEach((category) => {
    const parent = category.parentId || "__root__"
    const list = byParent.get(parent) || []
    list.push(category)
    byParent.set(parent, list)
  })

  const queue = [rootId]
  const collectedIds = new Set<string>()
  while (queue.length > 0) {
    const current = queue.shift()!
    if (collectedIds.has(current)) continue
    collectedIds.add(current)
    const children = byParent.get(current) || []
    children.forEach((child) => queue.push(child.id))
  }

  return categories
    .filter((category) => collectedIds.has(category.id) && Boolean(category.slug))
    .map((category) => category.slug)
}

function resolveHomepageCategoryAlias<T extends { slug: string; title: string }>(
  category: T | undefined,
  allCategories: T[]
) {
  if (!category) return undefined
  if (category.slug !== "pillow-covers") return category
  return allCategories.find((item) => item.slug === "cushion-covers") || category
}

function buildBannerSubtitle(categoryTitle?: string | null, tagline?: string | null) {
  const category = categoryTitle?.trim()
  const base = tagline?.trim()
  if (category && base) return `${base} Discover ${category.toLowerCase()} selected with a collector's eye.`
  if (base) return base
  if (category) return `${category} selected for craftsmanship, character, and quiet luxury.`
  return "Handmade Turkish rugs chosen for craftsmanship, character, and enduring presence."
}

type HomepageBannerEntry = {
  id: string
  title: string
  subtitle: string
  image: string
  href: string
  ctaLabel: string
  categoryTitle?: string
}

export default async function HomePage() {
  const [categories, siteSettings, currencySnapshot] = await Promise.all([
    getCategories(),
    getSiteSettings(),
    getStorefrontCurrencySnapshot(),
  ])
  const currencySettings = {
    selectedCurrency: currencySnapshot.selectedCurrency,
    usdToEurRate: currencySnapshot.usdToEurRate,
    locale: currencySnapshot.locale,
  }

  const rawCategories = categories as Array<{
    id: string
    title: string
    slug: string
    image?: string | null
    parentId?: string | null
  }>

  const allCategories = await Promise.all(
    rawCategories.map(async (category) => {
      const normalizedImage = normalizeImagePath(category.image)
      if (!normalizedImage) return { ...category, image: null }
      return { ...category, image: normalizedImage }
    })
  )

  const categoryList = allCategories.filter((category) => !category.parentId && category.image)
  const categoryMap = new Map(allCategories.map((category) => [category.id, category]))

  const configuredHomeCategories = (siteSettings.shopByCategoryIds || [])
    .map((id) => resolveHomepageCategoryAlias(categoryMap.get(id), allCategories))
    .filter((category): category is NonNullable<typeof category> => Boolean(category))

  const shopByCategories = configuredHomeCategories.length > 0
    ? configuredHomeCategories.slice(0, 8)
    : categoryList.slice(0, 8)

  const configuredCollectionCategories = (siteSettings.collectionCategoryIds || [])
    .map((id) => resolveHomepageCategoryAlias(categoryMap.get(id), allCategories))
    .filter((category): category is NonNullable<typeof category> => Boolean(category))

  const collectionCategories = configuredCollectionCategories.length > 0
    ? configuredCollectionCategories.slice(0, 7)
    : shopByCategories.slice(0, 7)
  const hasDistinctCollectionSelection = configuredCollectionCategories.length > 0

  const now = new Date()
  const daySeed = Number(
    `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`
  )

  const promoSectionsConfig = siteSettings.homePromoSections.length > 0
    ? siteSettings.homePromoSections
    : [{
        id: "default-home-promo",
        title: siteSettings.homePromoSectionTitle,
        categoryId: siteSettings.homePromoCategoryId,
      }]

  const promoSections: Array<{
    id: string
    title: string
    category: (typeof allCategories)[number] | null
    products: Array<{
      id: string
      title: string
      slug: string
      price: number
      images: string
      description?: string | null
      compareAtPrice?: number | null
      stockCount?: number
      isStock?: boolean
      categories?: Array<{ id: string; title: string; slug: string }>
    }>
    bannerImage: string | null
  }> = []

  for (const section of promoSectionsConfig) {
    const selectedPromoCategory = section.categoryId ? categoryMap.get(section.categoryId) || null : null
    let dailyCategory: (typeof allCategories)[number] | null = null
    let dailyProducts: Array<{
      id: string
      title: string
      slug: string
      price: number
      images: string
      description?: string | null
      compareAtPrice?: number | null
      stockCount?: number
      isStock?: boolean
      categories?: Array<{ id: string; title: string; slug: string }>
    }> = []
    let dailyBannerImage: string | null = null

    if (selectedPromoCategory) {
      const candidateSlugs = getDescendantCategorySlugs(selectedPromoCategory.id, allCategories)
      const productMap = new Map<
        string,
        {
          id: string
          title: string
          slug: string
          price: number
          images: string
          description?: string | null
          compareAtPrice?: number | null
          stockCount?: number
          isStock?: boolean
          categories?: Array<{ id: string; title: string; slug: string }>
        }
      >()

      for (const slug of candidateSlugs) {
        const { products } = await getProducts(1, 24, "", "published", "latest", slug)
        products.forEach((item) => {
          if (productMap.has(item.id)) return
          productMap.set(item.id, {
            id: item.id,
            title: item.title,
            slug: item.slug,
            price: Number(item.price),
            images: item.images,
            description: item.description,
            compareAtPrice: item.compareAtPrice ?? null,
            stockCount: item.stockCount,
            isStock: item.isStock,
            categories: item.categories,
          })
        })
        if (productMap.size >= 24) break
      }

      const products = Array.from(productMap.values())
      dailyCategory = selectedPromoCategory
      const sortedForDay = rotateByOffset(products, daySeed)
      dailyProducts = sortedForDay.slice(0, 8)
      dailyBannerImage = selectedPromoCategory.image || parseMainImage(sortedForDay[0]?.images || "[]")
    } else {
      const fallbackCandidates = [
        ...configuredHomeCategories,
        ...categoryList,
        ...allCategories.filter((category) => Boolean(category.slug)),
      ]
      const dailyCandidates = Array.from(
        new Map(
          fallbackCandidates
            .filter((category) => Boolean(category.slug))
            .map((category) => [category.id, category])
        ).values()
      )
      const rotatedCandidates = rotateByOffset(dailyCandidates, daySeed)

      for (const candidate of rotatedCandidates) {
      const candidateSlugs = getDescendantCategorySlugs(candidate.id, allCategories)
      const productMap = new Map<
        string,
        {
          id: string
          title: string
          slug: string
          price: number
          images: string
          description?: string | null
          compareAtPrice?: number | null
          stockCount?: number
          isStock?: boolean
          categories?: Array<{ id: string; title: string; slug: string }>
        }
      >()

      for (const slug of candidateSlugs) {
        const { products } = await getProducts(1, 24, "", "published", "latest", slug)
        products.forEach((item) => {
          if (productMap.has(item.id)) return
          productMap.set(item.id, {
            id: item.id,
            title: item.title,
            slug: item.slug,
            price: Number(item.price),
            images: item.images,
            description: item.description,
            compareAtPrice: item.compareAtPrice ?? null,
            stockCount: item.stockCount,
            isStock: item.isStock,
            categories: item.categories,
          })
        })
        if (productMap.size >= 24) break
      }

      const products = Array.from(productMap.values())
      if (!products.length) continue

      dailyCategory = candidate
      const sortedForDay = rotateByOffset(products, daySeed)
      dailyProducts = sortedForDay.slice(0, 8)
      dailyBannerImage = candidate.image || parseMainImage(sortedForDay[0]?.images || "[]")
      break
    }
    }

    if (!dailyCategory) continue

    promoSections.push({
      id: section.id,
      title: section.title,
      category: dailyCategory,
      products: dailyProducts,
      bannerImage: dailyBannerImage,
    })
  }

  const featuredResult = await getProducts(1, 8, "", "published", "latest", undefined, {
    featuredOnly: true,
  })
  const latestFallbackResult =
    featuredResult.products.length > 0
      ? featuredResult
      : await getProducts(1, 8, "", "published", "latest")

  const featuredProducts = latestFallbackResult.products.map((item) => ({
    id: item.id,
    title: item.title,
    slug: item.slug,
    price: Number(item.price),
    images: item.images,
    description: item.description,
    compareAtPrice: item.compareAtPrice ?? null,
    stockCount: item.stockCount,
    isStock: item.isStock,
    categories: item.categories,
  }))

  const storyImage =
    promoSections[1]?.bannerImage ||
    promoSections[1]?.category?.image ||
    parseMainImage(featuredProducts[1]?.images || "[]")

  const fallbackHeroImage = parseMainImage(featuredProducts[0]?.images || "[]")

  const homepageBanners: HomepageBannerEntry[] = promoSections.map((section) => {
    const categoryTitle = section.category?.title || ""
    return {
      id: section.id,
      title: section.title,
      subtitle: buildBannerSubtitle(categoryTitle, siteSettings.siteTagline),
      image: section.bannerImage || section.category?.image || parseMainImage(section.products[0]?.images || "[]"),
      href: section.category?.slug ? `/category/${section.category.slug}` : "/products",
      ctaLabel: section.category?.title ? `Shop ${section.category.title}` : "Explore Collection",
      categoryTitle,
    }
  })

  const heroBanner = homepageBanners[0] || null
  const firstProductSet = featuredProducts.slice(0, 8)
  const secondProductSet = promoSections[0]?.products?.slice(0, 8) || featuredProducts.slice(0, 8)
  const thirdProductSet = promoSections[1]?.products?.slice(0, 8) || featuredProducts.slice(2, 10)

  return (
    <div className="bg-[#faf7f2]">
      <section className="border-b border-black/5 bg-[#f5f0e6]">
        <div className="container mx-auto grid gap-10 px-4 py-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)] lg:items-center lg:py-14">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#0f766e]">
              {heroBanner?.categoryTitle || "Curated Turkish Rugs"}
            </p>
            <h1 className="mt-5 max-w-xl font-serif text-5xl leading-[0.96] text-slate-900 sm:text-6xl xl:text-7xl">
              {heroBanner?.title || "Handwoven Heritage. One of a Kind."}
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-700 sm:text-lg">
              {heroBanner?.subtitle ||
                "Discover handmade Turkish rugs chosen for their timeless craftsmanship, collected character, and the singular way each piece completes a room."}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href={heroBanner?.href || "/products"}
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-slate-900 px-7 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {heroBanner?.ctaLabel || "Explore the Collection"}
              </Link>
              <Link
                href="/products"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-300 bg-white/70 px-7 text-sm font-semibold text-slate-900 transition hover:border-slate-400"
              >
                View All Rugs
              </Link>
            </div>
            <div className="mt-10 grid max-w-2xl gap-4 border-t border-slate-300/70 pt-6 sm:grid-cols-3">
              <div>
                <p className="text-2xl font-semibold text-slate-900">{featuredProducts.length}+</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">Curated pieces shown immediately.</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-900">Large</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">Visual product imagery with clean pricing.</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-900">{collectionCategories.length}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">Category paths to keep browsing fast.</p>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[32px] bg-[#e9dfd0] shadow-[0_30px_80px_rgba(15,23,42,0.12)]">
            <div className="absolute inset-0 bg-gradient-to-tr from-black/15 via-transparent to-white/20" />
            <img
              src={heroBanner?.image || fallbackHeroImage || "/placeholder.jpg"}
              alt={heroBanner?.title || "Curated handmade Turkish rugs"}
              className="h-full min-h-[420px] w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent px-6 pb-6 pt-16 text-white sm:px-8 sm:pb-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/80">
                {heroBanner ? "Hero Banner" : "Collector’s Edit"}
              </p>
              <p className="mt-3 max-w-md font-serif text-2xl leading-tight sm:text-3xl">
                {heroBanner?.title ||
                  "A refined selection of vintage and handmade rugs chosen for depth, rarity, and room-defining presence."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <div className="border-y border-slate-200 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center justify-center gap-3 border-b border-r border-slate-200 px-6 py-5 lg:border-b-0">
              <svg className="h-7 w-7 shrink-0 text-[#0f766e]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-slate-900">Free Worldwide Shipping</p>
                <p className="text-xs text-slate-500">On all orders</p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-3 border-b border-slate-200 px-6 py-5 lg:border-b-0 lg:border-r">
              <svg className="h-7 w-7 shrink-0 text-[#0f766e]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-slate-900">30-Day Easy Returns</p>
                <p className="text-xs text-slate-500">Hassle-free returns</p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-3 border-r border-slate-200 px-6 py-5">
              <svg className="h-7 w-7 shrink-0 text-[#0f766e]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.05 4.575a1.575 1.575 0 10-3.15 0v3m3.15-3v-1.5a1.575 1.575 0 013.15 0v1.5m-3.15 0l.075 5.925m3.075.75V4.575m0 0a1.575 1.575 0 013.15 0V15M6.9 7.575a1.575 1.575 0 10-3.15 0v8.175a6.75 6.75 0 006.75 6.75h2.018a5.25 5.25 0 003.712-1.538l1.732-1.732a5.25 5.25 0 001.538-3.712l-.001-1.029" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-slate-900">100% Handmade</p>
                <p className="text-xs text-slate-500">Authentic Anatolian craft</p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-3 px-6 py-5">
              <svg className="h-7 w-7 shrink-0 text-[#0f766e]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-slate-900">500+ Unique Rugs</p>
                <p className="text-xs text-slate-500">One-of-a-kind pieces</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="container mx-auto px-4 py-14">
        <div className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#0f766e]">Featured Rugs</p>
            <h2 className="mt-3 font-serif text-4xl leading-none text-slate-900">Collected to be seen first</h2>
          </div>
        </div>

        <FeaturedProducts products={firstProductSet} title="Featured & Curated" currencySettings={currencySettings} />
      </section>

      <section className="container mx-auto px-4 pb-4">
        <div className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#0f766e]">Categories</p>
            <h2 className="mt-3 font-serif text-4xl leading-none text-slate-900">
              {siteSettings.collectionSectionTitle || "Shop by Collection"}
            </h2>
          </div>
        </div>
      </section>

      <ShopByStyleSection
        categories={collectionCategories}
        radius={{
          topLeft: siteSettings.categoryCardRadiusTopLeft,
          topRight: siteSettings.categoryCardRadiusTopRight,
          bottomRight: siteSettings.categoryCardRadiusBottomRight,
          bottomLeft: siteSettings.categoryCardRadiusBottomLeft,
        }}
      />

      {/* Shop by Size */}
      <section className="container mx-auto px-4 py-12">
        <div className="mb-8 text-center">
          <p className="inline-block rounded-full bg-[#0f766e]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#0f766e]">
            Find Your Size
          </p>
          <h2 className="mt-3 font-serif text-4xl leading-none text-slate-900">Shop by Size</h2>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {["2x3", "3x5", "4x6", "5x8", "6x9", "8x10", "9x12", "Runner"].map((size) => (
            <Link
              key={size}
              href={`/shop?size=${size}`}
              className="rounded-full border border-slate-300 px-6 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:bg-slate-900 hover:text-white"
            >
              {size}
            </Link>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 py-14">
        <div className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#0f766e]">
              {promoSections[0]?.title || "More to Explore"}
            </p>
            <h2 className="mt-3 font-serif text-4xl leading-none text-slate-900">More rugs, less interruption</h2>
          </div>
          {promoSections[0]?.category?.slug ? (
            <Link
              href={`/category/${promoSections[0].category.slug}`}
              className="text-sm font-semibold text-slate-900 transition hover:text-[#0f766e]"
            >
              Shop {promoSections[0].category.title}
            </Link>
          ) : null}
        </div>

        <FeaturedProducts
          products={secondProductSet}
          title={promoSections[0]?.title || "Selected Rugs"}
          currencySettings={currencySettings}
        />
      </section>

      <section className="container mx-auto grid gap-8 px-4 py-10 lg:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)] lg:items-center">
        <div className="relative overflow-hidden rounded-[28px] bg-[#e8ddcf] shadow-[0_24px_70px_rgba(15,23,42,0.1)]">
          <img
            src={storyImage || heroBanner?.image || fallbackHeroImage || "/placeholder.jpg"}
            alt="Anatolian craftsmanship"
            className="h-full min-h-[280px] w-full object-cover"
          />
        </div>
        <div className="max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#0f766e]">Craft</p>
          <h2 className="mt-3 font-serif text-3xl leading-tight text-slate-900 sm:text-4xl">
            Handmade in character, collected for modern rooms.
          </h2>
          <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
            A short edit of Anatolian craftsmanship: texture, age, and one-of-a-kind presence without the noise.
          </p>
        </div>
      </section>

      {hasDistinctCollectionSelection ? (
        <section className="container mx-auto px-4 pt-2">
          <div className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#0f766e]">Browse by Category</p>
              <h2 className="mt-3 font-serif text-4xl leading-none text-slate-900">Additional curated pathways</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
                These category cards continue to reflect the admin-managed homepage category selections.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {hasDistinctCollectionSelection ? (
        <ShopByStyleSection
          categories={shopByCategories}
          radius={{
            topLeft: siteSettings.categoryCardRadiusTopLeft,
            topRight: siteSettings.categoryCardRadiusTopRight,
            bottomRight: siteSettings.categoryCardRadiusBottomRight,
            bottomLeft: siteSettings.categoryCardRadiusBottomLeft,
          }}
        />
      ) : null}

      <section className="container mx-auto px-4 py-14">
        <div className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#0f766e]">
              {promoSections[1]?.title || "Final Selection"}
            </p>
            <h2 className="mt-3 font-serif text-4xl leading-none text-slate-900">A final product pass before you leave the page</h2>
          </div>
          {promoSections[1]?.category?.slug ? (
            <Link
              href={`/category/${promoSections[1].category.slug}`}
              className="text-sm font-semibold text-slate-900 transition hover:text-[#0f766e]"
            >
              Shop {promoSections[1].category.title}
            </Link>
          ) : null}
        </div>

        <FeaturedProducts
          products={thirdProductSet}
          title={promoSections[1]?.title || "Final Selection"}
          currencySettings={currencySettings}
        />
      </section>

      {/* Testimonials */}
      <section className="bg-[#f5f0e6] py-16">
        <div className="container mx-auto px-4">
          <div className="mb-10 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#0f766e]">Customer Stories</p>
            <h2 className="mt-3 font-serif text-4xl leading-none text-slate-900">What Our Customers Say</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                quote: "Absolutely stunning rug. The quality is incredible and it looks even better in person. Shipped fast to Texas!",
                name: "Sarah M.",
                location: "Texas 🇺🇸",
              },
              {
                quote: "I've bought two rugs from Turkish Rug House now. Each one is truly one of a kind. Highly recommend!",
                name: "James R.",
                location: "California 🇺🇸",
              },
              {
                quote: "Beautiful craftsmanship. The rug arrived perfectly packed and the colors are exactly as shown.",
                name: "Emily K.",
                location: "New York 🇺🇸",
              },
            ].map((testimonial) => (
              <div key={testimonial.name} className="rounded-2xl bg-white p-7 shadow-sm">
                <div className="flex gap-0.5 text-amber-400">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <svg key={i} className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-600">&ldquo;{testimonial.quote}&rdquo;</p>
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <p className="text-sm font-semibold text-slate-900">{testimonial.name}</p>
                  <p className="text-xs text-slate-500">{testimonial.location}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <RecentlyViewedSection
        title="Inspired by Your Last Visit"
        subtitle="A quiet return to the pieces that recently caught your eye."
        limit={4}
      />
    </div>
  )
}
