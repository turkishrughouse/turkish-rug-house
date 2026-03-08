import { DailyCategoryShowcase } from "@/components/storefront/daily-category-showcase"
import { CustomerReviewsShowcase } from "@/components/storefront/customer-reviews-showcase"
import { FeaturedProducts } from "@/components/storefront/featured-products"
import { RecentlyViewedSection } from "@/components/storefront/recently-viewed-section"
import { ShopByCollectionSection } from "@/components/storefront/shop-by-collection-section"
import { ShopByStyleSection } from "@/components/storefront/shop-by-style-section"
import { getCategories } from "@/lib/actions/category-actions"
import { prisma } from "@/lib/db"
import { getProducts } from "@/lib/actions/product-actions"
import { getSiteSettings } from "@/lib/site-settings"
import { parseProductImages } from "@/lib/product-images"

export const dynamic = 'force-dynamic'

function rotateByOffset<T>(items: T[], offset: number) {
  if (!items.length) return items
  const safeOffset = ((offset % items.length) + items.length) % items.length
  return [...items.slice(safeOffset), ...items.slice(0, safeOffset)]
}

function parseMainImage(images: string) {
  return parseProductImages(images)[0] || "/placeholder.jpg"
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
  // Fetch data in parallel
  const [categories, { products: featuredProducts }, siteSettings] = await Promise.all([
    getCategories(),
    getProducts(1, 10, "", "published", "latest", undefined, { featuredOnly: true }),
    getSiteSettings(),
  ])

  const categoryList = (categories as Array<{
    id: string
    title: string
    slug: string
    image?: string | null
    parentId?: string | null
  }>).filter((category) => !category.parentId && category.image)

  const allCategories = categories as Array<{
    id: string
    title: string
    slug: string
    image?: string | null
    parentId?: string | null
  }>

  const categoryMap = new Map(allCategories.map((category) => [category.id, category]))
  const configuredHomeCategories = (siteSettings.shopByCategoryIds || [])
    .map((id) => resolveHomepageCategoryAlias(categoryMap.get(id), allCategories))
    .filter((category): category is NonNullable<typeof category> => Boolean(category))

  const shopByCategories = configuredHomeCategories.length > 0
    ? configuredHomeCategories.slice(0, 8)
    : categoryList.filter((category) => Boolean(category.image)).slice(0, 8)

  const configuredCollectionCategories = (siteSettings.collectionCategoryIds || [])
    .map((id) => categoryMap.get(id))
    .filter((category): category is NonNullable<typeof category> => Boolean(category))

  const collectionCategories = configuredCollectionCategories.length > 0
    ? configuredCollectionCategories.slice(0, 7)
    : shopByCategories.slice(0, 7)

  const now = new Date()
  const daySeed = Number(`${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`)
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
    let dailyCategory: (typeof allCategories)[number] | null = selectedPromoCategory
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
    const dailyCandidatesBase = selectedPromoCategory
      ? [selectedPromoCategory]
      : [
          ...configuredHomeCategories,
          ...categoryList,
          ...allCategories.filter((category) => Boolean(category.slug)),
        ]
    const dailyCandidates = Array.from(
      new Map(dailyCandidatesBase.filter((category) => Boolean(category.slug)).map((category) => [category.id, category])).values()
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

    if (!dailyCategory) continue
    promoSections.push({
      id: section.id,
      title: section.title,
      category: dailyCategory,
      products: dailyProducts,
      bannerImage: dailyBannerImage,
    })
  }

  const reviewRows = siteSettings.reviewShowcaseEnabled
    ? await prisma.productReview.findMany({
        orderBy: { createdAt: "desc" },
        take: 12,
        include: {
          product: {
            select: { title: true, slug: true, images: true },
          },
        },
      })
    : []

  const showcaseReviews = reviewRows
    .sort((a, b) => {
      const aHasPhoto = Boolean(a.photoUrl)
      const bHasPhoto = Boolean(b.photoUrl)
      if (aHasPhoto === bHasPhoto) return 0
      return aHasPhoto ? -1 : 1
    })
    .slice(0, 6)
    .map((review) => ({
      id: review.id,
      customerName: review.name,
      quote: review.comment,
      rating: review.rating,
      photoUrl: review.photoUrl || parseMainImage(review.product.images || "[]"),
      productTitle: review.product.title,
      productSlug: review.product.slug,
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

      <RecentlyViewedSection />

      {/* Section 2: Featured Items */}
      <FeaturedProducts products={featuredProducts} />

      {/* Section 3: Daily category banner + 8 products */}
      {promoSections.map((section) => (
        <DailyCategoryShowcase
          key={section.id}
          title={section.title}
          category={section.category}
          products={section.products}
          bannerImage={section.bannerImage}
        />
      ))}

      <ShopByCollectionSection
        title={siteSettings.collectionSectionTitle || "Shop by Collection"}
        categories={collectionCategories}
      />

      {siteSettings.reviewShowcaseEnabled ? (
        <CustomerReviewsShowcase
          title={siteSettings.reviewShowcaseTitle || "Over 210,000 Five-Star Reviews"}
          subtitle={siteSettings.reviewShowcaseSubtitle || "Explore the rugs everyone's raving about."}
          reviews={showcaseReviews}
        />
      ) : null}
    </div>
  )
}
