import { ProductForm } from "@/components/admin/products/product-form"
import { getProductOptions } from "@/lib/actions/product-actions"
import { getSessionUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { resolveAdminLanguage } from "@/lib/admin/i18n"

export default async function NewProductPage() {
    const user = await getSessionUser("admin")
    const profile = user
        ? await prisma.customerProfile.findUnique({
            where: { userId: user.id },
            select: { locale: true },
        }).catch(() => null)
        : null
    const lang = resolveAdminLanguage(profile?.locale)

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
        options = await getProductOptions()
    } catch (error) {
        console.error("Failed to fetch product options:", error)
        // We continue with empty options to verify if page renders
    }

    return (
        <div className="px-6 pt-6 pb-1">
            <ProductForm lang={lang} options={options} />
        </div>
    )
}
