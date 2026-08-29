import { unstable_cache } from "next/cache"
import { prisma } from "@/lib/db"

// Which Information group an article belongs to is already encoded in the header
// menu: the article's menu item sits under a "How" / "Using" / "What is" parent.
// Read it from there rather than inferring a group from the slug, so the label
// stays correct if the menu is reorganised. Returns null when an article is not
// in the Information menu, in which case the hero just shows "Journal".
function toTitleCase(label: string) {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

async function readBlogSectionLabel(slug: string) {
  const item = await prisma.menuItem.findFirst({
    where: {
      url: `/blog/${slug}`,
      parentId: { not: null },
      menu: { location: "HEADER_INFORMATION" },
    },
    select: { parent: { select: { label: true } } },
  })

  const label = item?.parent?.label?.trim()
  return label ? toTitleCase(label) : null
}

export async function getBlogSectionLabel(slug: string) {
  const getCachedLabel = unstable_cache(
    () => readBlogSectionLabel(slug),
    [`blog-section-${slug}`],
    { revalidate: 300, tags: ["blog-posts", `blog-post-${slug}`] },
  )
  return getCachedLabel()
}

// The hero is rendered at its own intrinsic ratio rather than cropped to a fixed
// band, because several hero photographs run to within a couple of percent of the
// frame edge and a fixed band would clip the rug. Reading the real dimensions from
// the media library lets the browser reserve the correct box, so the hero does not
// shift as it loads. Falls back to the previous 5:3 placeholder if the asset is
// not in MediaAsset.
const FALLBACK_HERO = { width: 1600, height: 960 }

async function readHeroDimensions(imageUrl: string) {
  // MediaAsset is created outside Prisma's schema, so it is read with a raw query
  // here, as elsewhere in the app.
  const rows = await prisma.$queryRaw<Array<{ width: number | null; height: number | null }>>`
    SELECT "width", "height"
    FROM "MediaAsset"
    WHERE "image_url" = ${imageUrl}
    LIMIT 1
  `

  const asset = rows[0]
  const width = Number(asset?.width || 0)
  const height = Number(asset?.height || 0)
  if (!width || !height) return FALLBACK_HERO
  return { width, height }
}

export async function getBlogHeroDimensions(imageUrl: string | null | undefined) {
  const url = (imageUrl || "").trim()
  if (!url) return FALLBACK_HERO

  const getCachedDimensions = unstable_cache(
    () => readHeroDimensions(url),
    [`blog-hero-dimensions-${url}`],
    { revalidate: 3600, tags: ["blog-posts"] },
  )
  return getCachedDimensions()
}
