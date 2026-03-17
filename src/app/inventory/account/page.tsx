import { InventoryPortalShell } from "@/components/inventory/inventory-portal-shell"
import { requireInventoryUser } from "@/lib/inventory-auth"

export const dynamic = "force-dynamic"

export default async function InventoryAccountPage() {
  const user = await requireInventoryUser()

  return (
    <InventoryPortalShell
      title="My Account"
      description="Manage your inventory portal account and session access."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-sm border border-[#dcdcde] bg-white p-6">
          <h2 className="text-base font-medium text-slate-900">Profile</h2>
          <div className="mt-5 space-y-4 text-sm">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Name</div>
              <div className="mt-1 text-slate-900">{user.name || "-"}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Email</div>
              <div className="mt-1 text-slate-900">{user.email}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Role</div>
              <div className="mt-1 text-slate-900">{user.role}</div>
            </div>
          </div>
        </div>

        <div className="rounded-sm border border-[#dcdcde] bg-white p-6">
          <h2 className="text-base font-medium text-slate-900">Account</h2>
          <div className="mt-5 space-y-3 text-sm text-slate-600">
            <p>Use the Settings screen to update your account name and email.</p>
            <p>Use the Password / Security screen to change your password securely.</p>
            <p>This inventory portal remains read-only for product and export access.</p>
          </div>
        </div>
      </div>
    </InventoryPortalShell>
  )
}
