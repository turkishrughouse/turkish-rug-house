import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getProductImageUrl, parseProductImageRecords } from "@/lib/product-images"
import { getSiteUrl, toAbsoluteSiteUrl } from "@/lib/site-url"

export const revalidate = 21600 // 6 hours

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function toAbsoluteImageUrl(relativePath: string): string {
  if (!relativePath || relativePath.endsWith("placeholder.jpg")) return ""
  return toAbsoluteSiteUrl(relativePath)
}

const DEFAULT_GOOGLE_PRODUCT_CATEGORY = "Home & Garden > Decor > Rugs"

function normalizeCategoryTitle(value: string) {
  return value.trim().toLowerCase()
}

function getGoogleProductCategory(categoryTitles: string[]) {
  const normalizedTitles = categoryTitles.map(normalizeCategoryTitle)

  if (normalizedTitles.includes("cushion covers")) {
    return "Home & Garden > Decor > Decorative Pillows"
  }

  if (normalizedTitles.includes("runners")) {
    return "Home & Garden > Decor > Rugs > Rug Runners"
  }

  if (
    normalizedTitles.some((title) =>
      ["turkish rugs", "vintage rugs", "kilims", "area rugs"].includes(title),
    )
  ) {
    return DEFAULT_GOOGLE_PRODUCT_CATEGORY
  }

  return DEFAULT_GOOGLE_PRODUCT_CATEGORY
}

export async function GET() {
  const baseUrl = getSiteUrl()

  const products = await prisma.product.findMany({
    where: { isPublished: true },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      price: true,
      isStock: true,
      stockCount: true,
      images: true,
      categories: { select: { title: true } },
      colors: { select: { name: true } },
      sizes: { select: { name: true } },
      materials: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const items = products.map((product) => {
    const imageRecords = parseProductImageRecords(product.images)
    const [primaryRecord, ...restRecords] = imageRecords

    const imageLink = primaryRecord
      ? toAbsoluteImageUrl(getProductImageUrl(primaryRecord, "master") || getProductImageUrl(primaryRecord, "large"))
      : ""

    const additionalImageLinks = restRecords
      .slice(0, 10)
      .map((rec) => toAbsoluteImageUrl(getProductImageUrl(rec, "master") || getProductImageUrl(rec, "large")))
      .filter(Boolean)

    const rawDescription = stripHtml(product.description || product.title || "")
    const description = escapeXml(rawDescription.slice(0, 5000))
    const availability = product.isStock && product.stockCount > 0 ? "in stock" : "out of stock"
    const price = `${Number(product.price).toFixed(2)} USD`
    const link = `${baseUrl}/product/${product.slug}`
    const googleProductCategory = escapeXml(
      getGoogleProductCategory(product.categories.map((category) => category.title)),
    )

    const lines = [
      "    <item>",
      `      <g:id>${escapeXml(product.id)}</g:id>`,
      `      <g:title>${escapeXml(product.title)}</g:title>`,
      `      <g:description>${description}</g:description>`,
      `      <g:link>${escapeXml(link)}</g:link>`,
      imageLink ? `      <g:image_link>${escapeXml(imageLink)}</g:image_link>` : null,
      ...additionalImageLinks.map((url) => `      <g:additional_image_link>${escapeXml(url)}</g:additional_image_link>`),
      `      <g:price>${price}</g:price>`,
      `      <g:availability>${availability}</g:availability>`,
      `      <g:condition>new</g:condition>`,
      `      <g:google_product_category>${googleProductCategory}</g:google_product_category>`,
      `      <g:brand>Turkish Rug House</g:brand>`,
      "    </item>",
    ]

    return lines.filter(Boolean).join("\n")
  })

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n` +
    `  <channel>\n` +
    `    <title>Turkish Rug House</title>\n` +
    `    <link>${escapeXml(baseUrl)}</link>\n` +
    `    <description>Handmade Turkish rugs and vintage Oushak rugs</description>\n` +
    items.join("\n") +
    `\n  </channel>\n` +
    `</rss>`

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
    },
  })
}
