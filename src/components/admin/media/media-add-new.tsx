"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Loader2, UploadCloud } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Folder = { name: string; count: number }

export function MediaAddNew() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [selectedFolder, setSelectedFolder] = useState("categories")
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const loadFolders = useCallback(async () => {
    const res = await fetch("/api/admin/media", { cache: "no-store" })
    const json = await res.json().catch(() => null as null | { folders?: Folder[]; error?: string })
    if (!res.ok) throw new Error(json?.error || "Failed to fetch folders")
    setFolders(json?.folders || [])
  }, [])

  useEffect(() => {
    loadFolders().catch((error) => {
      toast.error(error instanceof Error ? error.message : "Failed to load folders")
    })
  }, [loadFolders])

  const folderOptions = useMemo(() => {
    const names = Array.from(new Set(folders.map((folder) => folder.name)))
    return names.sort((a, b) => a.localeCompare(b))
  }, [folders])

  useEffect(() => {
    if (folderOptions.length === 0) return
    if (!folderOptions.includes(selectedFolder)) {
      setSelectedFolder(folderOptions[0] || "categories")
    }
  }, [folderOptions, selectedFolder])

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files || [])
    if (list.length === 0) return

    setUploading(true)
    try {
      for (const file of list) {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("folder", selectedFolder)
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })
        const json = await res.json().catch(() => null as null | { error?: string })
        if (!res.ok) throw new Error(json?.error || "Upload failed")
      }
      toast.success(`${list.length} file(s) uploaded`)
      await loadFolders()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <Card className="border border-[#dce3ed] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <CardContent className="space-y-6 p-8">
        <div className="max-w-sm">
          <Select value={selectedFolder} onValueChange={setSelectedFolder}>
            <SelectTrigger className="h-12 border-[#cfd9e4] bg-white text-[15px]">
              <SelectValue placeholder="Select folder" />
            </SelectTrigger>
            <SelectContent>
              {folderOptions.map((folder) => (
                <SelectItem key={folder} value={folder}>
                  {folder}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <label
          className={`flex min-h-[420px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-8 text-center transition ${
            uploading ? "border-slate-300 bg-slate-50" : "border-[#d1dae5] bg-[#f8fafc] hover:border-slate-400 hover:bg-white"
          }`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            void uploadFiles(event.dataTransfer.files)
          }}
        >
          {uploading ? <Loader2 className="mb-4 h-10 w-10 animate-spin text-slate-400" /> : <UploadCloud className="mb-4 h-12 w-12 text-slate-400" />}
          <p className="text-2xl font-semibold text-slate-900">Drop files to upload</p>
          <p className="my-3 text-sm text-slate-400">or</p>
          <span className="inline-flex h-11 items-center rounded-full bg-slate-900 px-5 text-sm font-medium text-white">
            Upload files
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => void uploadFiles(event.target.files || [])}
          />
        </label>

        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
            Upload files
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
