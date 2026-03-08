"use client"

import { useState } from "react"
import { Check, ChevronDown, Languages } from "lucide-react"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { AdminLanguage } from "@/lib/admin/i18n"

type AdminLanguageSwitcherProps = {
  initialLocale: string
  lang: AdminLanguage
}

export function AdminLanguageSwitcher({ initialLocale, lang }: AdminLanguageSwitcherProps) {
  const [locale, setLocale] = useState(initialLocale || "en_US")
  const [saving, setSaving] = useState(false)
  const isTr = lang === "tr"

  const updateLocale = async (nextLocale: string) => {
    if (saving || nextLocale === locale) return
    setSaving(true)
    try {
      const res = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
      })
      const json = await res.json().catch(() => null as { error?: string } | null)
      if (!res.ok) throw new Error(json?.error || "Failed to update admin language")
      setLocale(nextLocale)
      toast.success(isTr ? "Admin dili güncellendi" : "Admin language updated")
      window.location.reload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (isTr ? "Dil güncellenemedi" : "Language update failed"))
    } finally {
      setSaving(false)
    }
  }

  const current = locale.toLowerCase().startsWith("tr") ? "TR" : "EN"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={saving}
          className="admin-header-action inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium disabled:opacity-60"
          aria-label={isTr ? "Dil seçimi" : "Language switcher"}
        >
          <Languages className="h-4 w-4" />
          <span>{current}</span>
          <ChevronDown className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem className="cursor-pointer" onClick={() => updateLocale("tr_TR")}>
          <Check className={`mr-2 h-4 w-4 ${locale.toLowerCase().startsWith("tr") ? "opacity-100" : "opacity-0"}`} />
          Türkçe
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onClick={() => updateLocale("en_US")}>
          <Check className={`mr-2 h-4 w-4 ${!locale.toLowerCase().startsWith("tr") ? "opacity-100" : "opacity-0"}`} />
          English
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
