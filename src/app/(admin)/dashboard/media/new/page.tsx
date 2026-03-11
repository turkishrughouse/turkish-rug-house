import { MediaAddNew } from "@/components/admin/media/media-add-new"

export default function MediaNewPage() {
  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Add New Media</h2>
      </div>

      <div className="h-px bg-border-subtle" />

      <MediaAddNew />
    </div>
  )
}
