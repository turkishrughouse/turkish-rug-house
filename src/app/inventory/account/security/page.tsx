import { InventoryPortalShell } from "@/components/inventory/inventory-portal-shell"
import { InventoryAccountSecurityForm } from "@/components/inventory/inventory-account-security-form"
import { requireInventoryUser } from "@/lib/inventory-auth"

export const dynamic = "force-dynamic"

export default async function InventoryAccountSecurityPage() {
  await requireInventoryUser()

  return (
    <InventoryPortalShell
      title="Password / Security"
      description="Change your password and keep your inventory access secure."
    >
      <InventoryAccountSecurityForm />
    </InventoryPortalShell>
  )
}
