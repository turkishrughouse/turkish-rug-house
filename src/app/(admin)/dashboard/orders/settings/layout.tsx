import { OrderSettingsTabs } from "@/components/admin/orders/order-settings-tabs"

export default function OrderSettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 space-y-5 p-8 pt-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Order Settings</h1>
        <p className="text-slate-600">Select a section and manage settings from the panel below.</p>
      </div>

      <OrderSettingsTabs />

      <div>{children}</div>
    </div>
  )
}
