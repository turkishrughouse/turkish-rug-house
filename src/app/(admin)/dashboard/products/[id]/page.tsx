import { notFound } from "next/navigation"
import { ProductForm } from "@/components/admin/products/product-form"
import { getProduct, getProductOptions } from "@/lib/actions/product-actions"
import { getSessionUser } from "@/lib/auth-server"
import { prisma } from "@/lib/db"
import { resolveAdminLanguage } from "@/lib/admin/i18n"
import { requireAdminSection } from "@/lib/admin-guard"

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function EditProductPage({ params }: PageProps) {
    const { id } = await params
    await requireAdminSection("products")
    const user = await getSessionUser("admin")
    if (!user) notFound()

    const ownership = await prisma.product.findFirst({
      where: { id, createdById: user.id },
      select: { id: true },
    }).catch(() => null)
    if (!ownership) notFound()
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
        materials: any[];
        categoryAttributeMap?: Record<string, {
            typeIds: string[]
            styleIds: string[]
            colorIds: string[]
            sizeIds: string[]
            ageIds: string[]
            materialIds: string[]
        }>;
    } = {
        categories: [],
        types: [],
        styles: [],
        colors: [],
        sizes: [],
        ages: [],
        materials: [],
        categoryAttributeMap: {}
    }

    try {
        options = await getProductOptions()
    } catch (error) {
        console.error("Error fetching product options:", error)
    }

    product = await getProduct(id).catch(() => null)

    if (!product) notFound()

    return (
        <div className="w-full px-6 pt-6 pb-6">
            <ProductForm lang={lang} initialData={product} options={options} />
        </div>
    )
}
