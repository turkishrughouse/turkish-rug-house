import { getAdminLanguage } from "@/lib/admin/server-language"
import { type AdminLanguage } from "@/lib/admin/i18n"
import { ProductIntegrationTabs } from "@/components/admin/products/product-integration-tabs"

export default async function ProductIntegrationPage() {
  const lang = (await getAdminLanguage()) as AdminLanguage
  return <ProductIntegrationTabs lang={lang} />
}
