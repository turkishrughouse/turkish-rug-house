import { InventoryPortalShell } from "@/components/inventory/inventory-portal-shell"
import { InventoryAccountSettingsForm } from "@/components/inventory/inventory-account-settings-form"
import { requireInventoryUser } from "@/lib/inventory-auth"

export const dynamic = "force-dynamic"

export default async function InventoryAccountSettingsPage() {
  const user = await requireInventoryUser()

  return (
    <InventoryPortalShell
      title="Settings"
      description="Update your inventory profile information without affecting product data."
    >
      <InventoryAccountSettingsForm
        initialProfile={{
          name: user.name || "",
          email: user.email,
        }}
      />
    </InventoryPortalShell>
  )
}
