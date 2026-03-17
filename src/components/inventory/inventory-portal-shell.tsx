"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  Box,
  Download,
  LogOut,
  Menu,
  Settings,
  Shield,
  UserRound,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

type PortalShellProps = {
  title: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
}

const NAV_ITEMS = [
  { href: "/inventory", label: "Inventory", icon: Box },
  { href: "/inventory#inventory-downloads", label: "Downloads", icon: Download },
  { href: "/inventory/account", label: "My Account", icon: UserRound },
  { href: "/inventory/account/settings", label: "Settings", icon: Settings },
  { href: "/inventory/account/security", label: "Password / Security", icon: Shield },
]

export function InventoryPortalShell({ title, description, actions, children }: PortalShellProps) {
  const pathname = usePathname()
  const [loggingOut, setLoggingOut] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const logout = async () => {
    setLoggingOut(true)
    try {
      const res = await fetch("/api/auth/logout?portal=inventory", { method: "POST" })
      if (!res.ok) throw new Error("Logout failed")
      window.location.assign("/inventory/login")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Logout failed")
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f4ee] text-slate-900">
      <div className="min-h-screen">
        <aside
          onMouseLeave={() => setSidebarOpen(false)}
          className={`fixed inset-y-0 left-0 z-40 hidden border-r border-[#e5ddd2] bg-white/90 backdrop-blur md:flex md:flex-col md:transition-[width] md:duration-200 ${
            sidebarOpen ? "w-[240px]" : "w-[76px]"
          }`}
        >
          <button
            type="button"
            onMouseEnter={() => setSidebarOpen(true)}
            className="flex h-16 items-center gap-3 px-5 text-left"
            aria-label="Open inventory navigation"
          >
            <Menu className="h-5 w-5 shrink-0 text-slate-500" />
            <div className="min-w-0 overflow-hidden">
              <div className={`whitespace-nowrap text-xs uppercase tracking-[0.22em] text-slate-500 transition-opacity duration-150 ${sidebarOpen ? "opacity-100" : "opacity-0"}`}>
                Inventory
              </div>
            </div>
          </button>

          <nav className="flex-1 space-y-1 px-3 pb-4">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const active =
                pathname === item.href ||
                (item.href !== "/inventory" && pathname.startsWith(item.href.replace("#inventory-downloads", "")))
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors ${active ? "bg-[#eef3f1] text-slate-900" : "text-slate-600 hover:bg-[#f6f8f7] hover:text-slate-900"}`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className={`whitespace-nowrap transition-opacity duration-150 ${sidebarOpen ? "opacity-100" : "opacity-0"}`}>
                    {item.label}
                  </span>
                </Link>
              )
            })}
          </nav>

          <div className="border-t border-[#ece6dc] p-3">
            <button
              type="button"
              onClick={logout}
              disabled={loggingOut}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-600 transition-colors hover:bg-[#f6f8f7] hover:text-slate-900"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              <span className={`whitespace-nowrap transition-opacity duration-150 ${sidebarOpen ? "opacity-100" : "opacity-0"}`}>
                {loggingOut ? "Logging out..." : "Logout"}
              </span>
            </button>
          </div>
        </aside>

        <div className="min-w-0 md:pl-[76px]">
          <div className="border-b border-[#e5ddd2] bg-[#f8f4ee]/90 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-[1480px] flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Turkish Rug House</div>
                <h1 className="mt-2 text-[30px] font-medium tracking-tight text-slate-900">{title}</h1>
                {description ? <p className="mt-2 text-sm text-slate-600">{description}</p> : null}
              </div>
              {actions ? <div id="inventory-downloads" className="flex items-center gap-2">{actions}</div> : null}
            </div>
          </div>

          <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8">
            <div className="mb-4 flex gap-2 overflow-x-auto md:hidden">
              {NAV_ITEMS.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/inventory" && pathname.startsWith(item.href.replace("#inventory-downloads", "")))
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`whitespace-nowrap rounded-full border px-3 py-2 text-sm ${active ? "border-[#d8e3df] bg-[#eef3f1] text-slate-900" : "border-[#e5ddd2] bg-white text-slate-600"}`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>

            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
