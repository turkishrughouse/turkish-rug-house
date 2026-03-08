"use client"

import { useState } from "react"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"

type CacheActionButtonProps = {
  labels?: {
    clear?: string
    clearing?: string
  }
}

export function CacheActionButton({ labels }: CacheActionButtonProps) {
  const [loading, setLoading] = useState(false)

  const clearCache = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/cache", { method: "POST" })
      const json = (await res.json().catch(() => null)) as { error?: string; message?: string } | null
      if (!res.ok) throw new Error(json?.error || "Failed to clear cache")
      toast.success(json?.message || "Cache cleared")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clear cache")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={clearCache}
      disabled={loading}
      className="admin-header-action flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 disabled:opacity-60"
    >
      <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
      <span>{loading ? labels?.clearing || "Clearing..." : labels?.clear || "Clear Cache"}</span>
    </button>
  )
}
