"use client"

import Link from "next/link"
import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { ForgotPasswordModal } from "@/components/storefront/forgot-password-modal"

export default function AccountAuthPage() {
  const searchParams = useSearchParams()
  const authError = searchParams.get("error")
  const appleEnabled = process.env.NEXT_PUBLIC_ENABLE_APPLE_LOGIN === "true"
  const socialErrorText =
    authError === "google_not_configured"
      ? "Google sign-in is not configured yet. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in server environment."
      : authError === "apple_not_configured"
        ? "Apple sign-in is not configured yet. Please set APPLE_CLIENT_ID and APPLE_CLIENT_SECRET in server environment."
        : authError === "apple_disabled"
          ? "Apple sign-in is currently disabled."
        : authError
          ? `Social login error: ${authError}`
          : null
  const [mode, setMode] = useState<"login" | "register">("login")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [addressEnabled, setAddressEnabled] = useState(false)
  const [addressConsent, setAddressConsent] = useState(false)
  const [addressLine1, setAddressLine1] = useState("")
  const [addressLine2, setAddressLine2] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [postalCode, setPostalCode] = useState("")
  const [country, setCountry] = useState("")
  const [countryCode, setCountryCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const endpoint = mode === "login" ? "/api/auth/login?portal=customer" : "/api/auth/register"
      const body =
        mode === "login"
          ? { email, password }
          : {
              name,
              phone,
              email,
              password,
              marketingOptIn: true,
              source: "account" as const,
              saveAddressToProfile: addressEnabled && addressConsent && Boolean(addressLine1.trim()),
              address: addressEnabled
                ? {
                    label: "Primary",
                    fullName: name,
                    phoneNumber: phone,
                    country,
                    countryCode,
                    state,
                    city,
                    addressLine1,
                    addressLine2,
                    postalCode,
                  }
                : undefined,
            }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(
        () => null as null | { error?: string; redirectTo?: string; code?: string; provider?: string }
      )
      if (!res.ok) {
        if (json?.code === "SOCIAL_LOGIN_REQUIRED" && json?.provider) {
          toast.info(`Continue with ${json.provider.toUpperCase()} for this account`)
          window.location.assign(json.redirectTo || `/api/auth/social/start?provider=${json.provider}&redirectTo=%2Faccount`)
          return
        }
        throw new Error(json?.error || "Request failed")
      }
      try {
        window.localStorage.setItem("rughouse_customer_authed", "1")
      } catch {
        // ignore local storage issues
      }
      window.dispatchEvent(new Event("rughouse:auth-updated"))
      window.location.assign(json?.redirectTo || "/account")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Request failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="border-t border-slate-200 bg-[#f5f7fb]">
      <div className="mx-auto w-full max-w-[1240px] px-6 py-10">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Customer Sign in / Register</h1>
          <p className="mt-1 text-sm text-slate-600">{appleEnabled ? "Google, Apple or your email/password." : "Google or your email/password."}</p>
          {socialErrorText ? (
            <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {socialErrorText}
            </p>
          ) : null}

          <div className="mt-4 inline-flex rounded-md border border-slate-200 p-1">
            <button type="button" className={`rounded px-3 py-1.5 text-xs font-semibold ${mode === "login" ? "bg-slate-900 text-white" : "text-slate-600"}`} onClick={() => setMode("login")}>
              Sign in
            </button>
            <button
              type="button"
              className={`rounded px-3 py-1.5 text-xs font-semibold ${
                mode === "register" ? "bg-slate-900 text-white" : "text-slate-600"
              }`}
              onClick={() => setMode("register")}
            >
              Register
            </button>
          </div>

          <form onSubmit={submit} className="mt-4 space-y-3">
            {mode === "register" ? (
              <>
                <input value={name} onChange={(e) => setName(e.target.value)} required className="h-11 w-full rounded border border-slate-300 px-3 text-sm" placeholder="Full name" />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} required className="h-11 w-full rounded border border-slate-300 px-3 text-sm" placeholder="Phone (required)" />
                <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <input className="mt-1 h-4 w-4" type="checkbox" checked={addressEnabled} onChange={(e) => setAddressEnabled(e.target.checked)} />
                  <span>I want to add my address now</span>
                </label>
                {addressEnabled ? (
                  <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
                    <input value={country} onChange={(e) => setCountry(e.target.value)} className="h-11 w-full rounded border border-slate-300 px-3 text-sm" placeholder="Country" />
                    <input value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className="h-11 w-full rounded border border-slate-300 px-3 text-sm" placeholder="Country code" />
                    <input value={state} onChange={(e) => setState(e.target.value)} className="h-11 w-full rounded border border-slate-300 px-3 text-sm" placeholder="State / Region" />
                    <input value={city} onChange={(e) => setCity(e.target.value)} className="h-11 w-full rounded border border-slate-300 px-3 text-sm" placeholder="City" />
                    <input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} className="h-11 w-full rounded border border-slate-300 px-3 text-sm md:col-span-2" placeholder="Address line 1" />
                    <input value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} className="h-11 w-full rounded border border-slate-300 px-3 text-sm md:col-span-2" placeholder="Address line 2" />
                    <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="h-11 w-full rounded border border-slate-300 px-3 text-sm" placeholder="ZIP / Postal code" />
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-xs text-slate-500">
                      Full name and phone number will be saved from your account details.
                    </div>
                  </div>
                ) : null}
                {addressEnabled ? (
                  <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <input className="mt-1 h-4 w-4" type="checkbox" checked={addressConsent} onChange={(e) => setAddressConsent(e.target.checked)} />
                    <span>Save this address to my account for faster checkout next time.</span>
                  </label>
                ) : null}
              </>
            ) : null}
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              name="email"
              autoComplete="username"
              required
              className="h-11 w-full rounded border border-slate-300 px-3 text-sm"
              placeholder="Email"
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              name="password"
              autoComplete={mode === "login" ? "current-password webauthn" : "new-password"}
              required
              className="h-11 w-full rounded border border-slate-300 px-3 text-sm"
              placeholder="Password"
            />
            <button disabled={loading} className="h-11 w-full rounded bg-teal-700 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60">
              {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          {mode === "login" ? (
            <button
              type="button"
              className="mt-3 inline-block text-sm text-teal-700 underline underline-offset-4"
              onClick={() => setForgotPasswordOpen(true)}
            >
              Forgotten Password
            </button>
          ) : null}

          <div className="mt-5 space-y-2">
            <Link href="/api/auth/social/start?provider=google&redirectTo=%2Faccount" className="inline-flex h-11 w-full items-center justify-center rounded bg-[#4285F4] text-sm font-semibold text-white">
              Continue with Google
            </Link>
            {appleEnabled ? (
              <Link href="/api/auth/social/start?provider=apple&redirectTo=%2Faccount" className="inline-flex h-11 w-full items-center justify-center rounded bg-black text-sm font-semibold text-white">
                Continue with Apple
              </Link>
            ) : null}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            For reliable order updates, please keep your email, phone, and shipping address current in your account/checkout details.
          </p>
        </div>
      </div>
      <ForgotPasswordModal open={forgotPasswordOpen} onClose={() => setForgotPasswordOpen(false)} initialEmail={email} />
    </section>
  )
}
