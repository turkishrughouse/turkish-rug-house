import type { MetadataRoute } from "next"
import { getSiteUrl } from "@/lib/site-url"

// Listing pages accept a dozen independent filter parameters, so crawlers can
// generate an effectively unbounded number of distinct URLs from them. Every one
// of those is a cache miss that renders a full listing server-side, which is
// what buried the origin under crawl traffic. The canonical listing pages,
// their pagination, category pages and product pages all stay crawlable; only
// the filter permutations are excluded.
const FILTER_QUERY_PARAMS = [
  "age",
  "color",
  "condition",
  "inStock",
  "limit",
  "material",
  "origin",
  "pattern",
  "priceMax",
  "priceMin",
  "size",
  "sort",
  "style",
  "type",
]

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl()

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: FILTER_QUERY_PARAMS.map((param) => `/*?*${param}=`),
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
