"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Loader2, Save } from "lucide-react"
import {
  ADMIN_COLOR_SCHEMES,
  applyAdminThemeToElement,
  persistAdminColorScheme,
  type AdminColorScheme,
} from "@/lib/admin/theme"

type AdminProfile = {
  id: string
  username: string
  name: string
  email: string
  firstName: string
  lastName: string
  nickname: string
  displayName: string
  website: string
  bioEn: string
  bioTr: string
  avatarUrl: string
  locale: string
  disableSyntaxHighlighting: boolean
  enableKeyboardShortcuts: boolean
  showToolbar: boolean
  adminColorScheme: AdminColorScheme
}

const LANGUAGES = [
  { value: "en_US", label: "English (United States)" },
  { value: "tr_TR", label: "Turkish (Türkiye)" },
  { value: "en_GB", label: "English (United Kingdom)" },
  { value: "de_DE", label: "Deutsch" },
  { value: "fr_FR", label: "Français" },
  { value: "es_ES", label: "Español" },
]

type AdminProfileFormProps = {
  initialProfile: AdminProfile
}

const getReadableTextColor = (hex: string) => {
  const sanitized = hex.replace("#", "")
  if (sanitized.length !== 6) return "#ffffff"
  const r = Number.parseInt(sanitized.slice(0, 2), 16)
  const g = Number.parseInt(sanitized.slice(2, 4), 16)
  const b = Number.parseInt(sanitized.slice(4, 6), 16)
  const luminance = (r * 299 + g * 587 + b * 114) / 1000
  return luminance > 145 ? "#0f172a" : "#f8fafc"
}

export function AdminProfileForm({ initialProfile }: AdminProfileFormProps) {
  const [profile, setProfile] = useState<AdminProfile>(initialProfile)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const adminShellRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    adminShellRef.current = document.querySelector<HTMLElement>(".admin-shell")
  }, [])

  useEffect(() => {
    if (adminShellRef.current) {
      applyAdminThemeToElement(adminShellRef.current, profile.adminColorScheme)
    }
    persistAdminColorScheme(profile.adminColorScheme)
  }, [profile.adminColorScheme])

  useEffect(() => {
    if (!adminShellRef.current) return
    adminShellRef.current.style.setProperty("--admin-header-display", profile.showToolbar ? "flex" : "none")
  }, [profile.showToolbar])

  useEffect(() => {
    if (!adminShellRef.current) return
    adminShellRef.current.classList.toggle("admin-no-syntax", profile.disableSyntaxHighlighting)
  }, [profile.disableSyntaxHighlighting])

  useEffect(() => {
    if (!adminShellRef.current) return
    adminShellRef.current.dataset.adminShortcuts = profile.enableKeyboardShortcuts ? "on" : "off"
  }, [profile.enableKeyboardShortcuts])

  useEffect(() => {
    document.documentElement.lang = profile.locale.replace("_", "-")
  }, [profile.locale])

  const displayNameOptions = useMemo(() => {
    const options = [
      profile.displayName,
      profile.name,
      [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim(),
      profile.nickname,
      profile.username,
      profile.email,
    ]
    return [...new Set(options.filter((v) => v && v.trim().length > 0))]
  }, [profile])

  const update = <K extends keyof AdminProfile>(key: K, value: AdminProfile[K]) => {
    setProfile((prev) => ({ ...prev, [key]: value }))
  }

  const applyColorScheme = (scheme: AdminColorScheme) => {
    update("adminColorScheme", scheme)
    if (adminShellRef.current) {
      applyAdminThemeToElement(adminShellRef.current, scheme)
    }
    persistAdminColorScheme(scheme)
    void fetch("/api/admin/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminColorScheme: scheme }),
    })
  }

  const handlePhotoUpload = async (file: File | null) => {
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("folder", "profiles")
      const res = await fetch("/api/upload", { method: "POST", body: formData })
      const json = await res.json()
      if (!res.ok || !json?.url) throw new Error(json?.error || "Photo upload failed")
      update("avatarUrl", json.url)
      toast.success("Photo uploaded")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Photo upload failed")
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    if (newPassword || confirmPassword) {
      if (newPassword.length < 8) {
        toast.error("New password must be at least 8 characters")
        return
      }
      if (newPassword !== confirmPassword) {
        toast.error("Password confirmation does not match")
        return
      }
    }

    setSaving(true)
    try {
      const payload = {
        disableSyntaxHighlighting: profile.disableSyntaxHighlighting,
        enableKeyboardShortcuts: profile.enableKeyboardShortcuts,
        showToolbar: profile.showToolbar,
        adminColorScheme: profile.adminColorScheme,
        locale: profile.locale,
        firstName: profile.firstName,
        lastName: profile.lastName,
        nickname: profile.nickname,
        displayName: profile.displayName,
        name: profile.name,
        email: profile.email,
        website: profile.website,
        bioEn: profile.bioEn,
        bioTr: profile.bioTr,
        avatarUrl: profile.avatarUrl,
        ...(newPassword ? { newPassword } : {}),
      }

      const res = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Failed to update profile")
      setProfile(json)
      setNewPassword("")
      setConfirmPassword("")
      toast.success("Profile updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-[#dce3ed] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="border-b border-[#dce3ed] px-8 py-6">
        <h1 className="text-3xl font-semibold leading-tight text-slate-900">Profile</h1>
      </div>

      <div className="space-y-10 px-8 py-8">
        <section className="space-y-5">
          <h2 className="text-2xl font-semibold text-slate-900">Personal Options</h2>
          <label className="flex items-center gap-3 text-base text-slate-700">
            <input
              type="checkbox"
              checked={profile.disableSyntaxHighlighting}
              onChange={(e) => update("disableSyntaxHighlighting", e.target.checked)}
              className="h-5 w-5 rounded border-slate-300 text-[#2271b1]"
            />
            Disable syntax highlighting when editing code
          </label>

          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-700">Administration Color Scheme</p>
            <div className="grid gap-2.5 md:grid-cols-3 xl:grid-cols-4">
              {ADMIN_COLOR_SCHEMES.map((scheme) => (
                <label
                  key={scheme.id}
                  className={`flex min-h-[76px] flex-col justify-between rounded-md border p-2.5 transition-colors ${profile.adminColorScheme === scheme.id ? "border-[#2271b1] bg-[#eff6ff]" : "border-[#dce3ed] bg-white hover:border-slate-300"}`}
                >
                  <span
                    className="mb-2 flex items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold"
                    style={{ backgroundColor: scheme.colors[0], color: getReadableTextColor(scheme.colors[0]) }}
                  >
                    <input
                      type="radio"
                      name="adminColorScheme"
                      value={scheme.id}
                      checked={profile.adminColorScheme === scheme.id}
                      onChange={() => applyColorScheme(scheme.id)}
                      className="h-4 w-4"
                    />
                    {scheme.label}
                  </span>
                  <span className="grid grid-cols-4 overflow-hidden rounded">
                    {scheme.colors.map((color) => (
                      <span key={color} className="h-5" style={{ backgroundColor: color }} />
                    ))}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-3 text-base text-slate-700">
            <input
              type="checkbox"
              checked={profile.enableKeyboardShortcuts}
              onChange={(e) => update("enableKeyboardShortcuts", e.target.checked)}
              className="h-5 w-5 rounded border-slate-300 text-[#2271b1]"
            />
            Enable keyboard shortcuts for moderation
          </label>

          <label className="flex items-center gap-3 text-base text-slate-700">
            <input
              type="checkbox"
              checked={profile.showToolbar}
              onChange={(e) => update("showToolbar", e.target.checked)}
              className="h-5 w-5 rounded border-slate-300 text-[#2271b1]"
            />
            Show Toolbar when viewing site
          </label>

          <div className="max-w-md space-y-2">
            <p className="text-base font-semibold text-slate-800">Language</p>
            <select
              value={profile.locale}
              onChange={(e) => update("locale", e.target.value)}
              className="h-9 w-full rounded-md border border-[#d0d7e2] bg-white px-2.5 text-sm text-slate-800"
            >
              {LANGUAGES.map((language) => (
                <option key={language.value} value={language.value}>
                  {language.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="space-y-5">
          <h2 className="text-2xl font-semibold text-slate-900">Name</h2>
          <div className="grid gap-4 md:grid-cols-[220px_minmax(0,680px)] md:items-center">
            <label className="text-base font-medium text-slate-800">Username</label>
            <input
              value={profile.username}
              readOnly
              className="h-9 w-full rounded-md border border-[#d0d7e2] bg-slate-100 px-2.5 text-sm text-slate-600"
            />
            <label className="text-base font-medium text-slate-800">First Name</label>
            <input
              value={profile.firstName}
              onChange={(e) => update("firstName", e.target.value)}
              className="h-9 w-full rounded-md border border-[#d0d7e2] bg-white px-2.5 text-sm text-slate-800"
            />
            <label className="text-base font-medium text-slate-800">Last Name</label>
            <input
              value={profile.lastName}
              onChange={(e) => update("lastName", e.target.value)}
              className="h-9 w-full rounded-md border border-[#d0d7e2] bg-white px-2.5 text-sm text-slate-800"
            />
            <label className="text-base font-medium text-slate-800">Nickname (required)</label>
            <input
              value={profile.nickname}
              onChange={(e) => update("nickname", e.target.value)}
              className="h-9 w-full rounded-md border border-[#d0d7e2] bg-white px-2.5 text-sm text-slate-800"
            />
            <label className="text-base font-medium text-slate-800">Display name publicly as</label>
            <select
              value={profile.displayName}
              onChange={(e) => update("displayName", e.target.value)}
              className="h-9 w-full rounded-md border border-[#d0d7e2] bg-white px-2.5 text-sm text-slate-800"
            >
              {displayNameOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="space-y-5">
          <h2 className="text-2xl font-semibold text-slate-900">Contact Info</h2>
          <div className="grid gap-4 md:grid-cols-[220px_minmax(0,680px)] md:items-center">
            <label className="text-base font-medium text-slate-800">Email (required)</label>
            <input
              type="email"
              value={profile.email}
              onChange={(e) => update("email", e.target.value)}
              className="h-9 w-full rounded-md border border-[#d0d7e2] bg-white px-2.5 text-sm text-slate-800"
            />
            <label className="text-base font-medium text-slate-800">Website</label>
            <input
              value={profile.website}
              onChange={(e) => update("website", e.target.value)}
              placeholder="https://"
              className="h-9 w-full rounded-md border border-[#d0d7e2] bg-white px-2.5 text-sm text-slate-800"
            />
          </div>
        </section>

        <section className="space-y-5">
          <h2 className="text-2xl font-semibold text-slate-900">About Yourself</h2>
          <div className="grid gap-4 md:grid-cols-[220px_minmax(0,680px)] md:items-start">
            <label className="pt-2 text-base font-medium text-slate-800">Biographical Info</label>
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-sm text-slate-600">English</p>
                <textarea
                  value={profile.bioEn}
                  onChange={(e) => update("bioEn", e.target.value)}
                  className="h-24 w-full rounded-md border border-[#d0d7e2] bg-white p-2.5 text-sm text-slate-800"
                />
              </div>
              <div>
                <p className="mb-1 text-sm text-slate-600">Türkçe</p>
                <textarea
                  value={profile.bioTr}
                  onChange={(e) => update("bioTr", e.target.value)}
                  className="h-24 w-full rounded-md border border-[#d0d7e2] bg-white p-2.5 text-sm text-slate-800"
                />
              </div>
              <p className="text-sm text-slate-500">
                Share a little biographical information to fill out your profile. This may be shown publicly.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <h2 className="text-2xl font-semibold text-slate-900">Profile Picture</h2>
          <div className="grid gap-4 md:grid-cols-[220px_minmax(0,680px)] md:items-start">
            <div className="text-base font-medium text-slate-800">Profile Picture</div>
            <div className="space-y-3">
              <div className="h-32 w-32 overflow-hidden rounded-md border border-[#d0d7e2] bg-slate-50">
                {profile.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-slate-500">
                    {profile.username.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void handlePhotoUpload(e.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-md border border-[#2271b1] px-4 py-2 text-sm font-medium text-[#2271b1] hover:bg-[#f0f7ff]"
                  disabled={uploading}
                >
                  {uploading ? "Uploading..." : "Upload photo"}
                </button>
                {profile.avatarUrl ? (
                  <button
                    type="button"
                    onClick={() => update("avatarUrl", "")}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <h2 className="text-2xl font-semibold text-slate-900">Account Management</h2>
          <div className="grid gap-4 md:grid-cols-[220px_minmax(0,680px)] md:items-start">
            <label className="pt-2 text-base font-medium text-slate-800">New Password</label>
            <div className="grid gap-3 max-w-xl">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 8 characters)"
                className="h-9 w-full rounded-md border border-[#d0d7e2] bg-white px-2.5 text-sm text-slate-800"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="h-9 w-full rounded-md border border-[#d0d7e2] bg-white px-2.5 text-sm text-slate-800"
              />
            </div>
          </div>
        </section>

        <div className="flex justify-end border-t border-[#dce3ed] pt-6">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-[#2271b1] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#135e96] disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Update Profile"}
          </button>
        </div>
      </div>
    </div>
  )
}
