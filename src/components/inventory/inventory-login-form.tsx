"use client"

import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function InventoryLoginForm() {
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch("/api/auth/login?portal=inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      })
      const json = await res.json().catch(() => null as null | { error?: string; redirectTo?: string })
      if (!res.ok) {
        throw new Error(json?.error || "Login failed")
      }
      toast.success("Login successful")
      window.location.assign(json?.redirectTo || "/inventory")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">Email Address</label>
        <Input
          type="text"
          name="identifier"
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="name@company.com"
          className="h-11 bg-white border-[#dce3ed] text-slate-900 placeholder:text-slate-400"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">Password</label>
        <Input
          type="password"
          name="password"
          autoComplete="current-password webauthn"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          className="h-11 bg-white border-[#dce3ed] text-slate-900 placeholder:text-slate-400"
          required
        />
      </div>

      <Button type="submit" className="h-11 w-full text-sm font-semibold" disabled={loading}>
        {loading ? "Signing in..." : "Sign In"}
      </Button>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Inventory access only.</span>
        <Link href="/password-reset" className="hover:text-slate-900">
          Forgot password?
        </Link>
      </div>
    </form>
  )
}
