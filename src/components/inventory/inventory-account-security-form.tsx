"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function InventoryAccountSecurityForm() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters")
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error("Password confirmation does not match")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/inventory/account/security", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Failed to update password")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      toast.success("Password updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update password")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-sm border border-[#dcdcde] bg-white p-6">
      <h2 className="text-base font-medium text-slate-900">Password / Security</h2>
      <div className="mt-5 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Current Password</label>
          <Input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="h-11 bg-white border-[#dce3ed] text-slate-900"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">New Password</label>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="h-11 bg-white border-[#dce3ed] text-slate-900"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Confirm New Password</label>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="h-11 bg-white border-[#dce3ed] text-slate-900"
          />
        </div>

        <Button type="button" onClick={save} disabled={saving} className="h-11 px-5 text-sm font-semibold">
          {saving ? "Saving..." : "Change Password"}
        </Button>
      </div>
    </div>
  )
}
