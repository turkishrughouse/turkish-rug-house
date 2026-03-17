"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type InventoryAccountProfile = {
  name: string
  email: string
}

export function InventoryAccountSettingsForm({
  initialProfile,
}: {
  initialProfile: InventoryAccountProfile
}) {
  const [profile, setProfile] = useState(initialProfile)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/inventory/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Failed to update account")
      setProfile({
        name: json.name || "",
        email: json.email || "",
      })
      toast.success("Account updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update account")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-sm border border-[#dcdcde] bg-white p-6">
      <h2 className="text-base font-medium text-slate-900">Account Settings</h2>
      <div className="mt-5 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Name</label>
          <Input
            value={profile.name}
            onChange={(e) => setProfile((state) => ({ ...state, name: e.target.value }))}
            className="h-11 bg-white border-[#dce3ed] text-slate-900"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Email</label>
          <Input
            type="email"
            value={profile.email}
            onChange={(e) => setProfile((state) => ({ ...state, email: e.target.value }))}
            className="h-11 bg-white border-[#dce3ed] text-slate-900"
          />
        </div>

        <Button type="button" onClick={save} disabled={saving} className="h-11 px-5 text-sm font-semibold">
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  )
}
