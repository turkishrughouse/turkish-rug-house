import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth"
import { isAdminRole } from "@/lib/rbac"
import { prisma } from "@/lib/db"
import type { CSSProperties } from "react"
import { getAdminTheme } from "@/lib/admin/theme"
import { AdminShellFrame } from "@/components/admin/admin-shell-frame"

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
        <AdminShellFrame user={user} profile={profile} adminStyle={adminStyle}>
            {children}
        </AdminShellFrame>
    )
}
