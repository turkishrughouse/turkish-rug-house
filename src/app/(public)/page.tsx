import { DailyCategoryShowcase } from "@/components/storefront/daily-category-showcase"
import { FeaturedProducts } from "@/components/storefront/featured-products"
import { HomeFeaturesStrip } from "@/components/storefront/home-features-strip"
import { HomeBlogSection } from "@/components/storefront/home-blog-section"
import { RecentlyViewedSection } from "@/components/storefront/recently-viewed-section"
import { ShopByStyleSection } from "@/components/storefront/shop-by-style-section"
import { getCategories } from "@/lib/actions/category-actions"
import { getProducts } from "@/lib/actions/product-actions"
import { getPublishedBlogPosts } from "@/lib/blog"
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

export default async function HomePage() {
  const [categories, siteSettings, latestBlogPosts, currencySnapshot] = await Promise.all([
    getCategories(),
    getSiteSettings(),
    getPublishedBlogPosts(4),
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

  return (
    <div className="bg-slate-50/30">
      <ShopByStyleSection
        categories={shopByCategories}
        radius={{
          topLeft: siteSettings.categoryCardRadiusTopLeft,
          topRight: siteSettings.categoryCardRadiusTopRight,
          bottomRight: siteSettings.categoryCardRadiusBottomRight,
          bottomLeft: siteSettings.categoryCardRadiusBottomLeft,
        }}
      />

      <FeaturedProducts products={featuredProducts} title="Featured Rugs" currencySettings={currencySettings} />

      <HomeFeaturesStrip items={siteSettings.homeFeatureItems} />

      {promoSections.map((section) => (
        <DailyCategoryShowcase
          key={section.id}
          title={section.title}
          category={section.category}
          products={section.products}
          bannerImage={section.bannerImage}
          currencySettings={currencySettings}
        />
      ))}

      <RecentlyViewedSection />

      <HomeBlogSection posts={latestBlogPosts} />
    </div>
  )
}
