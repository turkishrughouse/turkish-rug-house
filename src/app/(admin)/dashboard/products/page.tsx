import { Suspense } from "react"
import { getProductAdminStats, getProductOptions, getProducts } from "@/lib/actions/product-actions"
import { ProductList } from "@/components/admin/products/product-list"
import { getSessionUser } from "@/lib/auth-server"
import { prisma } from "@/lib/db"
import { resolveAdminLanguage } from "@/lib/admin/i18n"
import { requireAdminSection } from "@/lib/admin-guard"

export default async function ProductsPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    await requireAdminSection("products")
    const user = await getSessionUser("admin")
    const profile = user
        ? await prisma.customerProfile.findUnique({
            where: { userId: user.id },
            select: { locale: true },
        }).catch(() => null)
        : null
    const lang = resolveAdminLanguage(profile?.locale)

    const params = await searchParams
    const page = Number(params.page) || 1
    const perPageParam = Number(params.perPage)
    const perPage = [20, 50, 100, 200].includes(perPageParam) ? perPageParam : 20
    const query = (params.q as string) || ""
    const status = (params.status as string) || "all"
    const category = (params.category as string) || ""
    const productType = (params.type as string) || ""
    const stock = (params.stock as string) || ""
    const brand = (params.brand as string) || ""
    const scheduleDate = (params.scheduleDate as string) || ""

    const statusFilter = status === "published" || status === "draft" ? status : undefined
    const stockStatus = stock === "instock" || stock === "outofstock" ? stock : undefined

    const [{ products, metadata }, stats, options] = await Promise.all([
        getProducts(
            page,
            perPage,
            query,
            statusFilter,
            undefined,
            category || undefined,
            {
                types: productType ? [productType] : undefined,
                styles: brand ? [brand] : undefined,
                stockStatus,
                featuredOnly: status === "featured",
                trashOnly: status === "trash",
                scheduledDate: status === "schedule" ? scheduleDate : undefined,
                // No creatorId filter — Admin sees the full shared product catalog
            }
        ),
        getProductAdminStats(query),
        getProductOptions(),
    ])

    return (
        <div className="flex-1 space-y-6 p-6 pt-5">
            <Suspense fallback={<div>{lang === "tr" ? "Ürünler yükleniyor..." : "Loading products..."}</div>}>
                <ProductList
                    lang={lang}
                    key={`${page}-${perPage}-${query}-${status}-${category}-${productType}-${stock}-${brand}`}
                    initialProducts={products}
                    metadata={metadata}
                    stats={stats}
                    filters={{
                        q: query,
                        status,
                        category,
                        type: productType,
                        stock,
                        brand,
                        scheduleDate,
                    }}
                    filterOptions={{
                        categories: options.categories,
                        types: options.types,
                        brands: options.styles,
                    }}
                />
            </Suspense>
        </div>
    )
}
