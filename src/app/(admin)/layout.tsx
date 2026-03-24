import { AdminSidebar } from "@/components/admin/sidebar"
import { ChevronDown, ExternalLink } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth"
import { NotificationCenter } from "@/components/admin/notifications/notification-center"
import { isAdminRole } from "@/lib/rbac"
import { prisma } from "@/lib/db"
import type { CSSProperties } from "react"
import { getAdminTheme } from "@/lib/admin/theme"
import { AdminKeyboardShortcuts } from "@/components/admin/keyboard-shortcuts"
import { adminText, resolveAdminLanguage } from "@/lib/admin/i18n"
import { AdminHeaderSearch } from "@/components/admin/admin-header-search"
import { AdminProfileMenu } from "@/components/admin/profile-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

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
                >

                    {/* Left: Global Search */}
                    <AdminHeaderSearch placeholder={t.searchPlaceholder} />

                    {/* Right: Actions */}
                    <div className="flex items-center justify-end">
                        <div className="flex items-center gap-2 rounded-2xl border border-[color:var(--admin-header-input-border)] bg-white/80 p-1.5 shadow-sm backdrop-blur-sm">

                            {/* Visit Site Link */}
                            <Link
                                href="/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="admin-header-action group inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium transition-all duration-200"
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
                                triggerClassName="admin-header-action inline-flex h-11 items-center gap-3 rounded-xl bg-white px-3 text-left shadow-none transition-all duration-200 hover:bg-white"
                            >
                                <>
                                    <Avatar className="h-9 w-9 ring-1 ring-slate-200">
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
                                    <div className="hidden min-w-0 text-left lg:block">
                                        <p className="truncate text-sm font-semibold leading-none text-slate-900">
                                            {user.name || "Admin User"}
                                        </p>
                                        <p className="truncate pt-1 text-[11px] leading-none text-slate-500">
                                            {user.email}
                                        </p>
                                    </div>
                                    <ChevronDown className="h-4 w-4 text-slate-400" />
                                </>
                            </AdminProfileMenu>
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
