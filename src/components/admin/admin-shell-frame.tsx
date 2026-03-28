"use client"

import { useEffect, useState, type CSSProperties, type ReactNode } from "react"
import Link from "next/link"
import { ChevronDown, ExternalLink, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { AdminSidebar } from "@/components/admin/sidebar"
import { NotificationCenter } from "@/components/admin/notifications/notification-center"
import { AdminKeyboardShortcuts } from "@/components/admin/keyboard-shortcuts"
import { adminText, resolveAdminLanguage } from "@/lib/admin/i18n"
import { AdminHeaderSearch } from "@/components/admin/admin-header-search"
import { AdminProfileMenu } from "@/components/admin/profile-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AdminMobileNav } from "@/components/admin/mobile-nav"

const SIDEBAR_STATE_KEY = "rughouse_admin_sidebar_collapsed"

type AdminShellFrameProps = {
    children: ReactNode
    user: {
        id: string
        name: string | null
        email: string
        role: string
    }
    profile: {
        avatarUrl: string | null
        disableSyntaxHighlighting: boolean | null
        enableKeyboardShortcuts: boolean | null
        locale: string | null
    } | null
    adminStyle: CSSProperties
}

export function AdminShellFrame({ children, user, profile, adminStyle }: AdminShellFrameProps) {
    const [collapsed, setCollapsed] = useState(false)
    const lang = resolveAdminLanguage(profile?.locale)
    const t = adminText[lang]

    useEffect(() => {
        if (typeof window === "undefined") return
        const saved = window.localStorage.getItem(SIDEBAR_STATE_KEY)
        setCollapsed(saved === "1")
    }, [])

    const toggleSidebar = () => {
        setCollapsed((prev) => {
            const next = !prev
            if (typeof window !== "undefined") {
                window.localStorage.setItem(SIDEBAR_STATE_KEY, next ? "1" : "0")
            }
            return next
        })
    }

    return (
        <div
            className={`admin-shell flex min-h-screen w-full overflow-x-hidden bg-[#f4f7fb] text-slate-900 ${profile?.disableSyntaxHighlighting ? "admin-no-syntax" : ""}`}
            style={adminStyle}
            data-admin-shortcuts={profile?.enableKeyboardShortcuts ? "on" : "off"}
        >
            <AdminKeyboardShortcuts enabled={Boolean(profile?.enableKeyboardShortcuts)} />
            <div className={`admin-shell-sidebar hidden shrink-0 border-r border-[#dce3ed] transition-[width] duration-300 ease-out lg:block ${collapsed ? "w-20" : "w-64"}`}>
                <AdminSidebar user={{ ...user, locale: profile?.locale, avatarUrl: profile?.avatarUrl }} collapsed={collapsed} />
            </div>
            <main className="admin-shell-main flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden" lang={(profile?.locale || "en_US").replace("_", "-")}>
                <header className="admin-shell-header admin-header-surface sticky top-0 z-40 flex min-h-[72px] items-center justify-between gap-3 border-b border-[#dce3ed] px-3 shadow-[0_1px_0_rgba(15,23,42,0.03)] sm:px-4 lg:h-[80px] lg:gap-6 lg:px-6">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="lg:hidden">
                            <AdminMobileNav user={{ role: user.role, locale: profile?.locale }} />
                        </div>
                        <button
                            type="button"
                            onClick={toggleSidebar}
                            className="hidden h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 lg:inline-flex"
                            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                        >
                            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
                        </button>
                        <div className="min-w-0 flex-1">
                            <AdminHeaderSearch placeholder={t.searchPlaceholder} />
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center self-center justify-end">
                        <div className="flex items-center gap-1 rounded-2xl border border-[color:var(--admin-header-input-border)] bg-white/80 p-1 shadow-sm backdrop-blur-sm sm:gap-2 sm:p-1.5">
                            <Link
                                href="/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="admin-header-action group hidden h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium transition-all duration-200 sm:inline-flex"
                            >
                                <ExternalLink className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                                <span>{t.visitSite}</span>
                            </Link>
                            <NotificationCenter lang={lang} />
                            <AdminProfileMenu
                                name={user.name}
                                email={user.email}
                                avatarUrl={profile?.avatarUrl}
                                showName={false}
                                triggerClassName="admin-header-action inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-2 text-left shadow-none transition-all duration-200 hover:bg-white sm:h-11 sm:gap-2.5 sm:px-3"
                            >
                                <>
                                    <div className="flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 p-0.5">
                                    <Avatar className="h-7 w-7 rounded-full sm:h-9 sm:w-9">
                                        <AvatarImage src={profile?.avatarUrl || undefined} />
                                        <AvatarFallback>
                                            {(user.name || user.email)
                                                .split(" ")
                                                .filter(Boolean)
                                                .map((part) => part[0])
                                                .join("")
                                                .slice(0, 2)
                                                .toUpperCase() || "AD"}
                                        </AvatarFallback>
                                    </Avatar>
                                    </div>
                                    <div className="hidden min-w-0 text-left lg:block">
                                        <p className="truncate text-sm font-semibold leading-none text-slate-900">
                                            {user.name || "Admin User"}
                                        </p>
                                        <p className="truncate pt-1 text-[11px] leading-none text-slate-500">
                                            {user.email}
                                        </p>
                                    </div>
                                    <ChevronDown className="h-4 w-4 shrink-0 self-center text-slate-400" />
                                </>
                            </AdminProfileMenu>
                        </div>
                    </div>
                </header>
                <div className="admin-shell-scroll h-auto min-h-[calc(100vh-72px)] flex-1 overflow-x-hidden overflow-y-visible lg:min-h-[calc(100vh-80px)]">
                    {children}
                </div>
            </main>
        </div>
    )
}
