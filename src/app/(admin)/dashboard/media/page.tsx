import { MediaBrowser } from "@/components/admin/media/media-browser"

export default function MediaPage() {
  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Media</h2>
        <p className="text-slate-600">Browse all media, filter by category, and assign images into subfolders.</p>
      </div>

      <div className="h-px bg-border-subtle" />

      <MediaBrowser />
    </div>
  )
}
