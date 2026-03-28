"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createPortal } from "react-dom"
import { Menu, X, ShoppingBag, Box, FolderTree, Image as ImageIcon, Settings, LayoutDashboard } from "lucide-react"
import { canAccessAdminSection } from "@/lib/rbac"
import { adminText, resolveAdminLanguage } from "@/lib/admin/i18n"

type MobileNavUser = {
    role: string
    locale?: string | null
}

type MobileNavItem = {
    label: string
    href: string
    section: string
    icon: typeof LayoutDashboard
}

export function AdminMobileNav({ user }: { user: MobileNavUser }) {
    const [open, setOpen] = useState(false)
    const lang = resolveAdminLanguage(user.locale)
    const t = adminText[lang]

    useEffect(() => {
        if (!open) return
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false)
        }
        document.body.style.overflow = "hidden"
        window.addEventListener("keydown", onKeyDown)
        return () => {
            document.body.style.overflow = ""
            window.removeEventListener("keydown", onKeyDown)
        }
    }, [open])

    const items: MobileNavItem[] = [
        { label: t.sidebar.dashboard, href: "/dashboard", section: "dashboard", icon: LayoutDashboard },
        { label: t.sidebar.products, href: "/dashboard/products", section: "products", icon: ShoppingBag },
        { label: t.sidebar.orders, href: "/dashboard/orders", section: "orders", icon: Box },
        { label: t.sidebar.productsCategories, href: "/dashboard/products/categories", section: "products", icon: FolderTree },
        { label: t.sidebar.media, href: "/dashboard/media", section: "media", icon: ImageIcon },
        { label: t.sidebar.settings, href: "/dashboard/settings", section: "settings", icon: Settings },
    ].filter((item) => canAccessAdminSection(user.role, item.section))

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
                aria-label="Open admin menu"
            >
                <Menu className="h-5 w-5" />
            </button>
            {open && typeof document !== "undefined"
                ? createPortal(
                    <div className="fixed inset-0 z-[120] lg:hidden">
                        <button
                            type="button"
                            className="absolute inset-0 bg-slate-950/45"
                            aria-label="Close admin menu"
                            onClick={() => setOpen(false)}
                        />
                        <div className="absolute inset-y-0 left-0 flex w-[88vw] max-w-[360px] flex-col bg-white shadow-[0_20px_60px_rgba(15,23,42,0.3)]">
                            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
                                <span className="text-base font-semibold text-slate-900">Turkish Rug House</span>
                                <button
                                    type="button"
                                    onClick={() => setOpen(false)}
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700"
                                    aria-label="Close menu"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <nav className="flex-1 overflow-y-auto px-3 py-4">
                                <div className="space-y-1">
                                    {items.map((item) => {
                                        const Icon = item.icon
                                        return (
                                            <Link
                                                key={`${item.section}-${item.href}`}
                                                href={item.href}
                                                onClick={() => setOpen(false)}
                                                className="flex min-h-12 items-center gap-3 rounded-2xl px-4 py-3 text-base font-medium text-slate-800 hover:bg-slate-50"
                                            >
                                                <Icon className="h-5 w-5 text-slate-500" />
                                                <span>{item.label}</span>
                                            </Link>
                                        )
                                    })}
                                </div>
                            </nav>
                        </div>
                    </div>,
                    document.body,
                )
                : null}
        </>
    )
}
