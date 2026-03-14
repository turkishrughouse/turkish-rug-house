"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { toast } from "sonner"

type ForgotPasswordModalProps = {
  open: boolean
  onClose: () => void
  initialEmail?: string
}

export function ForgotPasswordModal({ open, onClose, initialEmail = "" }: ForgotPasswordModalProps) {
  const defaultSuccessMessage = "If an account with that email exists, a password reset link has been sent."
  const [email, setEmail] = useState(initialEmail)
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")

  useEffect(() => {
    if (!open) return
    setEmail(initialEmail)
    setSuccessMessage("")
  }, [initialEmail, open])

  if (!open) return null

  const submit = async () => {
    const normalizedEmail = email.trim()
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      toast.error("Please enter a valid email address.")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      })
      const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string }
      if (!response.ok) {
        throw new Error(data.error || "Unable to send reset email. Please try again.")
      }

      const message = data.message || defaultSuccessMessage
      setSuccessMessage(message)
      toast.success(message)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send reset email. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/55 p-4">
      <div className="relative w-full max-w-[480px] rounded-md bg-white px-6 py-6 shadow-2xl">
        <button
          type="button"
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
          onClick={onClose}
          aria-label="Close forgotten password dialog"
        >
          <X className="h-5 w-5" />
        </button>
        <h3 className="text-2xl font-semibold text-slate-900">Forgotten Password</h3>
        <p className="mt-2 text-sm text-slate-600">
          Enter your account email address and we will send you a secure password reset link.
        </p>

        {successMessage ? (
          <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {successMessage}
          </div>
        ) : (
          <>
            <div className="mt-5 space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                placeholder="Email Address"
                autoComplete="email"
              />
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={loading}
              className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-md bg-teal-700 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-70"
            >
              {loading ? "Please wait..." : "Send Reset Link"}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
