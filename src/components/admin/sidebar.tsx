"use client"

import Link from "next/link"
import {
    LayoutDashboard,
    BarChart3,
    ShoppingBag,
    FileText,
    Image as ImageIcon,
    Settings,
    Users,
    Menu,
    Box,
    Inbox
} from "lucide-react"
import { useState, useRef, useEffect, type ComponentType } from "react"
import { createPortal } from "react-dom"
import { usePathname } from "next/navigation"
import { getUnreadOpenOrderCount } from "@/lib/admin/notification-state"
import { canAccessAdminSection } from "@/lib/rbac"
import { adminText, resolveAdminLanguage } from "@/lib/admin/i18n"
import { AdminProfileMenu } from "@/components/admin/profile-menu"

type NavSubItem = {
    name: string
    href: string
}

type NavItem = {
    name: string
    href: string
    section: string
    icon: ComponentType<{ className?: string }>
    items?: NavSubItem[]
    disableDirectLink?: boolean
}

type SidebarUser = {
    name: string | null
    email: string
    role: string
    locale?: string | null
    avatarUrl?: string | null
}

interface AdminSidebarProps {
    user: SidebarUser
}

const SIDEBAR_NOTIFICATION_POLL_MS = 3000

export function AdminSidebar({ user }: AdminSidebarProps) {
    const [activeItem, setActiveItem] = useState<{ id: string, items: NavSubItem[], rect: DOMRect } | null>(null)
    const [messageCount, setMessageCount] = useState(0)
    const [orderCount, setOrderCount] = useState(0)
    const pathname = usePathname()
    const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const canUsePortal = typeof window !== "undefined"
    const lang = resolveAdminLanguage(user.locale)
    const t = adminText[lang]
    const navItems: NavItem[] = [
        { name: t.sidebar.dashboard, href: "/dashboard", section: "dashboard", icon: LayoutDashboard },
        {
            name: t.sidebar.analytics,
            href: "#",
            section: "analytics",
            icon: BarChart3,
            disableDirectLink: true,
            items: [
                { name: t.sidebar.analyticsOverview, href: "/dashboard/analytics/overview" },
                { name: t.sidebar.analyticsProducts, href: "/dashboard/analytics/products" },
                { name: t.sidebar.analyticsRevenue, href: "/dashboard/analytics/revenue" },
                { name: t.sidebar.analyticsOrders, href: "/dashboard/analytics/orders" },
                { name: t.sidebar.analyticsVariations, href: "/dashboard/analytics/variations" },
                { name: t.sidebar.analyticsCategories, href: "/dashboard/analytics/categories" },
                { name: t.sidebar.analyticsCoupons, href: "/dashboard/analytics/coupons" },
                { name: t.sidebar.analyticsTaxes, href: "/dashboard/analytics/taxes" },
                { name: t.sidebar.analyticsDownloads, href: "/dashboard/analytics/downloads" },
                { name: t.sidebar.analyticsStock, href: "/dashboard/analytics/stock" },
                { name: t.sidebar.analyticsSettings, href: "/dashboard/analytics/settings" },
            ]
        },
        {
            name: t.sidebar.products,
            href: "/dashboard/products",
            section: "products",
            icon: ShoppingBag,
            items: [
                { name: t.sidebar.productsAll, href: "/dashboard/products" },
                { name: t.sidebar.productsAdd, href: "/dashboard/products/new" },
                { name: t.sidebar.productsCategories, href: "/dashboard/products/categories" },
                { name: t.sidebar.productsAttributes, href: "/dashboard/products/attributes" },
                { name: t.sidebar.productsIntegration, href: "/dashboard/products/integration" },
            ]
        },
        {
            name: t.sidebar.orders,
            href: "#",
            section: "orders",
            icon: Box,
            disableDirectLink: true,
            items: [
                { name: t.sidebar.orders, href: "/dashboard/orders" },
                { name: t.sidebar.ordersCoupons, href: "/dashboard/orders/coupons" },
                { name: t.sidebar.ordersReports, href: "/dashboard/orders/reports" },
                { name: t.sidebar.ordersSettings, href: "/dashboard/orders/settings" },
            ]
        },
        { name: t.sidebar.messages, href: "/dashboard/messages", section: "messages", icon: Inbox },
        {
            name: t.sidebar.design,
            href: "/dashboard/design?tab=banners",
            section: "menus",
            icon: Menu,
            items: [
                { name: t.sidebar.designBanners, href: "/dashboard/design?tab=banners" },
                { name: t.sidebar.designHeader, href: "/dashboard/design?tab=header" },
                { name: t.sidebar.designFooter, href: "/dashboard/design?tab=footer" },
            ],
        },
        { name: t.sidebar.pages, href: "/dashboard/pages", section: "pages", icon: FileText },
        {
            name: t.sidebar.media,
            href: "/dashboard/media",
            section: "media",
            icon: ImageIcon,
            items: [
                { name: "Add New", href: "/dashboard/media/new" },
            ],
        },
        { name: t.sidebar.users, href: "/dashboard/users", section: "users", icon: Users },
        { name: t.sidebar.settings, href: "/dashboard/settings", section: "settings", icon: Settings },
    ]

    const initials = (user.name || user.email)
        .split(" ")
        .filter(Boolean)
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    const visibleNavItems = navItems.filter((item) => canAccessAdminSection(user.role, item.section))
    const canSeeOrders = canAccessAdminSection(user.role, "orders")
    const canSeeMessages = canAccessAdminSection(user.role, "messages")
    const sidebarCountsInFlightRef = useRef(false)

    useEffect(() => {
        // Close flyout on scroll or resize to prevent misalignment
        const handleScrollOrResize = () => setActiveItem(null)
        window.addEventListener("scroll", handleScrollOrResize, { capture: true })
        window.addEventListener("resize", handleScrollOrResize)

        return () => {
            window.removeEventListener("scroll", handleScrollOrResize, { capture: true })
            window.removeEventListener("resize", handleScrollOrResize)
        }
    }, [])

    useEffect(() => {
        // Always collapse flyout when route changes.
        const timer = window.setTimeout(() => setActiveItem(null), 0)
        return () => window.clearTimeout(timer)
    }, [pathname])

    useEffect(() => {
        let cancelled = false

        const fetchSidebarCounts = async () => {
            if (sidebarCountsInFlightRef.current) return
            sidebarCountsInFlightRef.current = true
            try {
                const notificationsResponsePromise = (canSeeOrders || canSeeMessages)
                    ? fetch("/api/admin/notifications", { cache: "no-store" })
                    : Promise.resolve(null)
                const notificationsResponse = await notificationsResponsePromise

                if (cancelled) return

                if (notificationsResponse?.ok) {
                    const data = await notificationsResponse.json() as { meta?: { unreadMessages?: number; openOrders?: number; openOrderIds?: string[] } }
                    if (canSeeMessages) {
                        setMessageCount(Number(data?.meta?.unreadMessages || 0))
                    }

                    if (!canSeeOrders) return

                    const openOrderIds = Array.isArray(data?.meta?.openOrderIds)
                        ? data.meta.openOrderIds.filter((id): id is string => typeof id === "string")
                        : []

                    if (openOrderIds.length > 0) {
                        setOrderCount(getUnreadOpenOrderCount(openOrderIds))
                    } else {
                        setOrderCount(Number(data?.meta?.openOrders || 0))
                    }
                }
            } catch {
                // sidebar indicator should not block navigation
            } finally {
                sidebarCountsInFlightRef.current = false
            }
        }

        void fetchSidebarCounts()
        const handleSidebarRefresh = () => {
            void fetchSidebarCounts()
        }
        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                void fetchSidebarCounts()
            }
        }

        window.addEventListener("admin-messages-updated", handleSidebarRefresh as EventListener)
        window.addEventListener("admin-orders-updated", handleSidebarRefresh as EventListener)
        window.addEventListener("admin-notifications-updated", handleSidebarRefresh as EventListener)
        window.addEventListener("focus", handleSidebarRefresh)
        document.addEventListener("visibilitychange", handleVisibilityChange)

        const intervalId = window.setInterval(() => {
            void fetchSidebarCounts()
        }, SIDEBAR_NOTIFICATION_POLL_MS)

        const stream = typeof EventSource !== "undefined" ? new EventSource("/api/admin/messages/stream") : null
        if (stream) {
            stream.onmessage = (event) => {
                try {
                    const payload = JSON.parse(event.data) as { type?: string }
                    if (payload.type !== "new_message") return
                    void fetchSidebarCounts()
                } catch {
                    // ignore malformed sse payloads
                }
            }
        }

        return () => {
            cancelled = true
            window.clearInterval(intervalId)
            window.removeEventListener("admin-messages-updated", handleSidebarRefresh as EventListener)
            window.removeEventListener("admin-orders-updated", handleSidebarRefresh as EventListener)
            window.removeEventListener("admin-notifications-updated", handleSidebarRefresh as EventListener)
            window.removeEventListener("focus", handleSidebarRefresh)
            document.removeEventListener("visibilitychange", handleVisibilityChange)
            stream?.close()
        }
    }, [pathname, canSeeOrders, canSeeMessages])

    const handleMouseEnter = (item: NavItem, e: React.MouseEvent<HTMLDivElement>) => {
        if (!item.items) {
            handleMouseLeave()
            return
        }

        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current)
            closeTimeoutRef.current = null
        }

        const rect = e.currentTarget.getBoundingClientRect()
        setActiveItem({
            id: item.name,
            items: item.items,
            rect
        })
    }

    const handleMouseLeave = () => {
        if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)

        closeTimeoutRef.current = setTimeout(() => {
            setActiveItem(null)
        }, 150) // 150ms bridge time
    }

    const handleFlyoutMouseEnter = () => {
        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current)
            closeTimeoutRef.current = null
        }
    }

    return (
        <>
            <div className="admin-sidebar-surface w-64 border-r border-[#dce3ed] h-full flex flex-col shadow-[1px_0_16px_rgba(15,23,42,0.03)] z-20 relative">
                <div className="h-[80px] flex items-center px-6 border-b border-[#dce3ed] shrink-0">
                    <span className="font-bold text-lg tracking-wider bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
                        RUGHOUSE
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto py-6 px-4">
                    <nav className="space-y-1">
                        {visibleNavItems.map((item, index) => (
                            <div key={`${item.section}-${item.name}-${index}`}>
                                {index > 0 && <div className="my-1.5 h-[1px]" style={{ backgroundColor: "var(--admin-nav-divider)" }} />}

                                <div
                                    className="group relative"
                                    onMouseEnter={(e) => handleMouseEnter(item, e)}
                                    onMouseLeave={handleMouseLeave}
                                >
                                    {item.disableDirectLink ? (
                                        <button
                                            type="button"
                                            onClick={() => setActiveItem(null)}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-all duration-200 group-hover:translate-x-1 text-left ${activeItem?.id === item.name
                                                ? "bg-slate-900 text-white"
                                                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                                                }`}
                                        >
                                            <item.icon className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                                            <span>{item.name}</span>
                                            {item.section === "orders" && orderCount > 0 ? (
                                                <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-semibold text-white">
                                                    {orderCount > 99 ? "99+" : orderCount}
                                                </span>
                                            ) : null}
                                            {item.items && (
                                                <div className={`ml-auto w-1 h-1 rounded-full group-hover:bg-slate-600 ${activeItem?.id === item.name ? 'bg-white' : 'bg-slate-300'
                                                    }`} />
                                            )}
                                        </button>
                                    ) : (
                                        <Link
                                            href={item.href}
                                            onClick={() => setActiveItem(null)}
                                            className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-all duration-200 group-hover:translate-x-1 ${activeItem?.id === item.name
                                                ? "bg-slate-900 text-white"
                                                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                                                }`}
                                        >
                                            <item.icon className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                                            <span>{item.name}</span>
                                            {item.section === "orders" && orderCount > 0 ? (
                                                <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-semibold text-white">
                                                    {orderCount > 99 ? "99+" : orderCount}
                                                </span>
                                            ) : null}
                                            {item.section === "messages" && messageCount > 0 ? (
                                                <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-semibold text-white">
                                                    {messageCount > 99 ? "99+" : messageCount}
                                                </span>
                                            ) : null}

                                            {item.items && (
                                                <div className={`ml-auto w-1 h-1 rounded-full group-hover:bg-slate-600 ${activeItem?.id === item.name ? 'bg-white' : 'bg-slate-300'
                                                    }`} />
                                            )}
                                        </Link>
                                    )}
                                </div>
                            </div>
                        ))}
                    </nav>
                </div>

                <div className="p-4 border-t border-[#e8eef5] bg-slate-50/55">
                    <AdminProfileMenu
                        name={user.name}
                        email={user.email}
                        avatarUrl={user.avatarUrl}
                        showName={false}
                        hoverOpenDelayMs={400}
                        side="top"
                        triggerClassName="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-slate-100"
                    >
                        <>
                            <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-xs ring-2 ring-white">
                                {initials || "AD"}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-slate-700">{user.name || t.sidebar.adminUser}</span>
                                <span className="text-[10px] text-muted-foreground">{user.email}</span>
                            </div>
                        </>
                    </AdminProfileMenu>
                </div>
            </div>

            {/* Portal Flyout */}
            {canUsePortal && activeItem && createPortal(
                <div
                    className="fixed z-[9999]"
                    style={{
                        top: activeItem.rect.top,
                        left: activeItem.rect.right + 8, // 8px offset
                    }}
                    onMouseEnter={handleFlyoutMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    {/* Invisible bridge to prevent closing when crossing gap */}
                    <div
                        className="absolute -left-4 top-0 bottom-0 w-4 bg-transparent"
                        style={{ height: activeItem.rect.height }}
                    />

                    <div className="bg-popover border text-popover-foreground shadow-lg rounded-lg overflow-hidden py-1 w-48 animate-in fade-in zoom-in-95 duration-200 slide-in-from-left-2">
                        {activeItem.items.map((subItem) => (
                            <Link
                                key={subItem.href}
                                href={subItem.href}
                                className="block px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                            >
                                {subItem.name}
                            </Link>
                        ))}
                    </div>
                </div>,
                document.body
            )}
        </>
    )
}
