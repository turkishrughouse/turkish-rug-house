"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "sonner"

type ResetPasswordFormProps = {
  token: string
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    const validate = async () => {
      if (!token) {
        setTokenValid(false)
        setValidating(false)
        setErrorMessage("Reset link is invalid or expired. Please request a new password reset.")
        return
      }

      try {
        const response = await fetch(`/api/auth/password-reset/validate?token=${encodeURIComponent(token)}`, {
          cache: "no-store",
        })

        if (!response.ok) {
          setTokenValid(false)
          setErrorMessage("Reset link is invalid or expired. Please request a new password reset.")
          return
        }

        setTokenValid(true)
        setErrorMessage("")
      } catch {
        setTokenValid(false)
        setErrorMessage("Unable to validate this reset link right now.")
      } finally {
        setValidating(false)
      }
    }

    void validate()
  }, [token])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!tokenValid || loading) return
    if (!password || password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.")
      return
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.")
      return
    }

    setLoading(true)
    setErrorMessage("")

    try {
      const response = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      })
      const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string }

      if (!response.ok) {
        throw new Error(data.error || "Unable to reset password.")
      }

      setSuccess(true)
      toast.success(data.message || "Your password has been updated.")
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to reset password.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="border-t border-slate-200 bg-[#f5f7fb]">
      <div className="mx-auto w-full max-w-[1240px] px-6 py-10">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Reset Password</h1>
          <p className="mt-1 text-sm text-slate-600">
            Choose a new password for your Turkish Rug House customer account.
          </p>

          {validating ? (
            <p className="mt-5 text-sm text-slate-600">Validating your reset link...</p>
          ) : success ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Your password has been updated.
              </div>
              <Link
                href="/account/auth"
                className="inline-flex h-11 w-full items-center justify-center rounded bg-teal-700 text-sm font-semibold text-white hover:bg-teal-800"
              >
                Return to Sign In
              </Link>
            </div>
          ) : !tokenValid ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage || "Reset link is invalid or expired. Please request a new password reset."}
              </div>
              <Link
                href="/account/auth"
                className="inline-flex h-11 w-full items-center justify-center rounded border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Request a New Reset Link
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 w-full rounded border border-slate-300 px-3 text-sm"
                  placeholder="New Password"
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="h-11 w-full rounded border border-slate-300 px-3 text-sm"
                  placeholder="Confirm Password"
                  autoComplete="new-password"
                />
              </div>
              {errorMessage ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
              ) : null}
              <button
                type="submit"
                disabled={loading}
                className="h-11 w-full rounded bg-teal-700 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
              >
                {loading ? "Please wait..." : "Update Password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
