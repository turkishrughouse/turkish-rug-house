import { Metadata } from "next"
import { generateCategoryMetadataByPathWithSearch, renderCategoryPage } from "@/components/storefront/category-page-content"

type Props = {
  params: Promise<{ slug: string[] }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params
  const resolvedSearchParams = await searchParams
  return generateCategoryMetadataByPathWithSearch(slug, resolvedSearchParams)
}

export default async function NestedCategoryPage({ params, searchParams }: Props) {
  const { slug } = await params
  const resolvedSearchParams = await searchParams
  return renderCategoryPage({
    slugPath: slug,
    searchParams: resolvedSearchParams,
  })
}
