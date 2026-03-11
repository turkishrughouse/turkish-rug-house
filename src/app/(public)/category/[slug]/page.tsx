import { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { fetchCategoryPathRows, getCategoryPathBySlug } from "@/lib/category-paths"

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

function stripHtml(input: string | null | undefined) {
  if (!input) return ""
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function buildCategoryMetaDescription(title: string, description: string | null | undefined) {
  const plainDescription = stripHtml(description)
  if (plainDescription) {
    return plainDescription.slice(0, 160)
  }

  return `Browse our collection of ${title}`.slice(0, 160)
}

function buildQueryString(searchParams: { [key: string]: string | string[] | undefined }) {
  const params = new URLSearchParams()
  Object.entries(searchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item))
    else if (value !== undefined) params.set(key, value)
  })
  const query = params.toString()
  return query ? `?${query}` : ""
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const category = await prisma.category.findUnique({
    where: { slug },
    select: {
      title: true,
      description: true,
    },
  })

  if (!category) {
    return {
      title: "Category Not Found",
    }
  }

  const canonicalPath = getCategoryPathBySlug(await fetchCategoryPathRows(), slug)
  const metaDescription = buildCategoryMetaDescription(category.title, category.description)

  return {
    title: category.title,
    description: metaDescription,
    alternates: canonicalPath
      ? {
          canonical: canonicalPath,
        }
      : undefined,
  }
}

export default async function LegacyCategoryPage({ params, searchParams }: Props) {
  const { slug } = await params
  const resolvedSearchParams = await searchParams
  const canonicalPath = getCategoryPathBySlug(await fetchCategoryPathRows(), slug)

  if (!canonicalPath) {
    notFound()
  }

  permanentRedirect(`${canonicalPath}${buildQueryString(resolvedSearchParams)}`)
}
