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
