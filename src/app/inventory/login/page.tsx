import { redirect } from "next/navigation"
import { InventoryLoginForm } from "@/components/inventory/inventory-login-form"
import { resolveInventorySessionUser } from "@/lib/inventory-auth"

export const dynamic = "force-dynamic"

export default async function InventoryLoginPage() {
  const sessionUser = await resolveInventorySessionUser()
  if (sessionUser) {
    redirect("/inventory")
  }

  return (
    <div className="min-h-screen bg-[#f4f0ea]">
      <div className="grid min-h-screen lg:grid-cols-[1.15fr_0.85fr]">
        <div
          className="relative hidden min-h-screen bg-cover bg-center lg:block"
          style={{
            backgroundImage:
              "url('/uploads/pages/maintenance/2002010FUNKILIM85x127-51512x-master.webp')",
          }}
        >
          <div className="absolute inset-0 bg-slate-900/20" />
        </div>

        <div className="flex items-center justify-center px-6 py-10 lg:px-12">
          <div className="w-full max-w-md rounded-3xl border border-[#dce3ed] bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
            <div className="mb-8">
              <div className="text-xs uppercase tracking-[0.35em] text-slate-500">Turkish Rug House</div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">Inventory Login</h1>
              <p className="mt-2 text-sm text-slate-600">
                Sign in to view the read-only inventory and export files.
              </p>
            </div>

            <InventoryLoginForm />
          </div>
        </div>
      </div>
    </div>
  )
}
