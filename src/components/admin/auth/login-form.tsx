"use client"

import { useState } from "react"
import { useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    void fetch("/api/auth/reset-sessions", { method: "POST" })
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch("/api/auth/login?portal=admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const json = await res.json().catch(() => null as null | { error?: string; redirectTo?: string })
      if (!res.ok) {
        throw new Error(json?.error || "Login failed")
      }
      if (json?.redirectTo === "/account") {
        throw new Error("This account is a customer account. Please use storefront login.")
      }
      toast.success("Login successful")
      window.location.assign("/dashboard")
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
          type="email"
          name="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
        {loading ? "Signing in..." : "Sign In to Dashboard"}
      </Button>

      <p className="text-center text-xs text-slate-500">
        Bu panel sadece yetkili yoneticiler icindir.
      </p>
    </form>
  )
}
