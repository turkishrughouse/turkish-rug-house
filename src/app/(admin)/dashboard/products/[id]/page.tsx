import { notFound } from "next/navigation"
import { ProductForm } from "@/components/admin/products/product-form"
import { getProduct, getProductOptions } from "@/lib/actions/product-actions"
import { getSessionUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { resolveAdminLanguage } from "@/lib/admin/i18n"

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function EditProductPage({ params }: PageProps) {
    const { id } = await params
    const user = await getSessionUser("admin")
    const profile = user
        ? await prisma.customerProfile.findUnique({
            where: { userId: user.id },
            select: { locale: true },
        }).catch(() => null)
        : null
    const lang = resolveAdminLanguage(profile?.locale)

    let product = null
    let options: {
        categories: any[];
        types: any[];
        styles: any[];
        colors: any[];
        sizes: any[];
        ages: any[];
        categoryAttributeMap?: Record<string, {
            typeIds: string[]
            styleIds: string[]
            colorIds: string[]
            sizeIds: string[]
            ageIds: string[]
        }>;
    } = {
        categories: [],
        types: [],
        styles: [],
        colors: [],
        sizes: [],
        ages: [],
        categoryAttributeMap: {}
    }

    try {
        const [prod, opts] = await Promise.all([
            getProduct(id),
            getProductOptions()
        ])
        product = prod
        options = opts
    } catch (error) {
        console.error("Error fetching product or options:", error)
    }

    if (!product) notFound()

    return (
        <div className="px-6 pt-6 pb-1">
            <ProductForm lang={lang} initialData={product} options={options} />
        </div>
    )
}
