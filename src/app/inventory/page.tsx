import type { Metadata } from "next"
import { getInventoryProducts } from "@/lib/admin-inventory"
import { PublicInventoryView } from "@/components/inventory/public-inventory-view"
import { requireInventoryUser } from "@/lib/inventory-auth"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
}

export default async function InventoryPage() {
  await requireInventoryUser()
  const inventory = await getInventoryProducts({
    status: "ALL",
    includeSoldData: false,
  })

  return <PublicInventoryView rows={inventory.rows} />
}
