import { getAdminLanguage } from "@/lib/admin/server-language"
import { type AdminLanguage } from "@/lib/admin/i18n"
import { getInventoryProducts } from "@/lib/admin-inventory"
import { ProductInventoryTable } from "@/components/admin/products/product-inventory-table"

export default async function ProductInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ supplier?: string; status?: string }>
}) {
  const params = await searchParams
  const lang = (await getAdminLanguage()) as AdminLanguage
  const supplier = String(params.supplier || "").trim()
  const status = String(params.status || "ALL").trim().toUpperCase()
  const inventory = await getInventoryProducts({ supplier, status })

  return (
    <div className="flex-1 space-y-6 p-6 pt-5">
      <ProductInventoryTable
        lang={lang}
        rows={inventory.rows}
        soldRows={inventory.soldRows}
        stats={inventory.stats}
        supplier={supplier}
        status={status}
        supplierOptions={inventory.supplierOptions}
        supplierPerformance={inventory.supplierPerformance}
        mode="inventory"
      />
    </div>
  )
}
