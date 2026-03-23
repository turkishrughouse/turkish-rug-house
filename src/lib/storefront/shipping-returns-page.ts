import { prisma } from "@/lib/db"

const SHIPPING_RETURNS_SLUGS = [
  "shipping-returns",
  "shipping-and-delivery",
  "shipping-delivery",
  "shipping",
] as const

export type ShippingReturnsPage = {
  id: string
  title: string
  slug: string
  content: string | null
  excerpt: string | null
}

export async function getShippingReturnsPage(): Promise<ShippingReturnsPage | null> {
  const pages = await prisma.page.findMany({
    where: {
      status: "PUBLISHED",
      slug: {
        in: [...SHIPPING_RETURNS_SLUGS],
      },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      content: true,
      excerpt: true,
    },
  })

  return (
    pages.sort(
      (left, right) =>
        SHIPPING_RETURNS_SLUGS.indexOf(left.slug as (typeof SHIPPING_RETURNS_SLUGS)[number]) -
        SHIPPING_RETURNS_SLUGS.indexOf(right.slug as (typeof SHIPPING_RETURNS_SLUGS)[number])
    )[0] || null
  )
}

export function getShippingReturnsPageUrl(page: Pick<ShippingReturnsPage, "slug">) {
  return `/${page.slug}`
}
