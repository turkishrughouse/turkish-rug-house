import { AdminSidebar } from "@/components/admin/sidebar"
import { ExternalLink } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth"
import { NotificationCenter } from "@/components/admin/notifications/notification-center"
import { isAdminRole } from "@/lib/rbac"
import { prisma } from "@/lib/db"
import type { CSSProperties } from "react"
import { getAdminTheme } from "@/lib/admin/theme"
import { AdminKeyboardShortcuts } from "@/components/admin/keyboard-shortcuts"
import { CacheActionButton } from "@/components/admin/cache-action-button"
import { adminText, resolveAdminLanguage } from "@/lib/admin/i18n"
import { AdminLanguageSwitcher } from "@/components/admin/language-switcher"
import { AdminHeaderSearch } from "@/components/admin/admin-header-search"

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    let user: Awaited<ReturnType<typeof getSessionUser>> = null
    try {
        user = await getSessionUser("admin")
    } catch (error) {
        console.error("[admin-layout] failed to resolve admin session", error)
        user = null
    }
    if (!user || !isAdminRole(user.role)) {
        redirect("/rughouse/login")
    }
    let profile: {
        avatarUrl: string | null
        adminColorScheme: string | null
        showToolbar: boolean | null
        disableSyntaxHighlighting: boolean | null
        enableKeyboardShortcuts: boolean | null
        locale: string | null
    } | null = null
    try {
        profile = await prisma.customerProfile.findUnique({
            where: { userId: user.id },
            select: {
                avatarUrl: true,
                adminColorScheme: true,
                showToolbar: true,
                disableSyntaxHighlighting: true,
                enableKeyboardShortcuts: true,
                locale: true,
            },
        })
    } catch (error) {
        // Keep admin shell accessible even if profile table/fields are temporarily out of sync.
        console.error("[admin-layout] profile lookup failed, using defaults", error)
        profile = null
    }
    const theme = getAdminTheme("light")
    const lang = resolveAdminLanguage(profile?.locale)
    const t = adminText[lang]
    const adminStyle = {
        "--admin-sidebar-bg": theme.sidebarBg,
        "--admin-header-bg": theme.headerBg,
        "--admin-header-text": theme.headerText,
        "--admin-header-muted": theme.headerMuted,
        "--admin-header-hover-bg": theme.headerHoverBg,
        "--admin-header-input-bg": theme.headerInputBg,
        "--admin-header-input-border": theme.headerInputBorder,
        "--admin-nav-divider": theme.navDivider,
        "--admin-header-display": profile?.showToolbar === false ? "none" : "flex",
        "--admin-nav-text": theme.navText,
        "--admin-nav-hover-bg": theme.navHoverBg,
        "--admin-nav-hover-text": theme.navHoverText,
        "--admin-nav-active-bg": theme.navActiveBg,
        "--admin-nav-active-text": theme.navActiveText,
    } as CSSProperties

    return (
        <div
            className={`admin-shell flex min-h-screen w-full bg-[#f4f7fb] text-slate-900 ${profile?.disableSyntaxHighlighting ? "admin-no-syntax" : ""}`}
            style={adminStyle}
            data-admin-shortcuts={profile?.enableKeyboardShortcuts ? "on" : "off"}
        >
            <AdminKeyboardShortcuts enabled={Boolean(profile?.enableKeyboardShortcuts)} />
            <div className="admin-shell-sidebar">
                <AdminSidebar user={{ ...user, locale: profile?.locale, avatarUrl: profile?.avatarUrl }} />
            </div>
            <main className="admin-shell-main flex min-h-screen min-w-0 flex-1 flex-col" lang={(profile?.locale || "en_US").replace("_", "-")}>
                <header
                    className="admin-shell-header admin-header-surface h-[80px] border-b border-[#dce3ed] items-center px-6 justify-between sticky top-0 z-30 shrink-0 shadow-[0_1px_0_rgba(15,23,42,0.03)]"
                    style={{ display: "var(--admin-header-display)" }}
                >

                    {/* Left: Global Search */}
                    <AdminHeaderSearch placeholder={t.searchPlaceholder} />

                    {/* Right: Actions */}
                    <div className="flex items-center gap-6">

                        {/* Visit Site Link */}
                        <Link
                            href="/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="admin-header-action flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 group"
                        >
                            <ExternalLink className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                            <span>{t.visitSite}</span>
                        </Link>
                        <CacheActionButton labels={{ clear: t.cache.clear, clearing: t.cache.clearing }} />

                        <div className="flex items-center gap-4">
                            <NotificationCenter lang={lang} />
                            <AdminLanguageSwitcher initialLocale={profile?.locale || "en_US"} lang={lang} />
                        </div>
                    </div>
                </header>
                <div className="admin-shell-scroll h-auto min-h-[calc(100vh-80px)] flex-1 overflow-y-visible">
                    {children}
                </div>
            </main>
        </div>
    )
}
