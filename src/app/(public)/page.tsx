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

      <RecentlyViewedSection
        title="Inspired by Your Last Visit"
        subtitle="A quiet return to the pieces that recently caught your eye."
        limit={4}
      />
    </div>
  )
}
