import { AttributesManager } from "@/components/admin/products/attributes-manager"

export default function ProductAttributesPage() {
  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Attributes</h2>
        <p className="text-slate-600">
          Manage Types, Styles, Colors, Sizes, Ages, and create new custom attribute groups.
        </p>
      </div>

      <div className="h-px bg-border-subtle" />

      <AttributesManager />
    </div>
  )
}
