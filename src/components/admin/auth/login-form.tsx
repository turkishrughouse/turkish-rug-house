"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type LoginSuccessPayload = {
  error?: string
  redirectTo?: string
  user?: {
    id: string
    email: string
    name: string | null
    role: string
  }
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function waitForAdminSession(expectedRole?: string, attempts = 8) {
  for (let index = 0; index < attempts; index += 1) {
    const res = await fetch("/api/auth/session?portal=admin", {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Cache-Control": "no-store" },
    })
    const json = await res.json().catch(() => null as null | {
      authenticated?: boolean
      user?: { role?: string | null }
    })

    if (res.ok && json?.authenticated && json.user) {
      if (!expectedRole || json.user.role === expectedRole) {
        return true
      }
    }

    await delay(150)
  }

  return false
}

export function LoginForm() {
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch("/api/auth/login?portal=admin", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      })
      const json = await res.json().catch(() => null as null | LoginSuccessPayload)
      if (!res.ok) {
        throw new Error(json?.error || "Login failed")
      }
      if (json?.redirectTo === "/account") {
        throw new Error("This account is a customer account. Please use storefront login.")
      }
      const sessionReady = await waitForAdminSession(json?.user?.role)
      if (!sessionReady) {
        throw new Error("Login completed but session was not ready. Please try again.")
      }
      toast.success("Login successful")
      window.location.replace(json?.redirectTo || "/admin")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">Email Address or Username</label>
        <Input
          type="text"
          name="identifier"
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="name@company.com or username"
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
