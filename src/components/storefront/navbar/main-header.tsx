"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { ChevronDown, ChevronRight, Heart, House, Menu, Search, Shuffle, ShoppingBag, UserCircle2, X } from "lucide-react"
import { getCartSummary, getCartUpdateEventName, readCart } from "@/lib/storefront/cart"
import { toast } from "sonner"

import { DiscoveryCapsule } from "./discovery-capsule"
import { formatCurrency, type CurrencySettings } from "@/lib/storefront/currency"

type MobileMenuItem = {
    id: string
    label: string
    url: string
    children: MobileMenuItem[]
}

export function MainHeader({
    initialBrandPrimary,
    initialBrandSecondary,
    initialMaintenanceMode,
    initialCurrencySettings,
    initialSendPasswordSetupLink,
    initialMobileCategoriesMenu,
    initialMobilePagesMenu,
}: {
    initialBrandPrimary: string
    initialBrandSecondary: string
    initialMaintenanceMode: boolean
    initialCurrencySettings: CurrencySettings
    initialSendPasswordSetupLink: boolean
    initialMobileCategoriesMenu: MobileMenuItem[]
    initialMobilePagesMenu: MobileMenuItem[]
}) {
    const router = useRouter()
    const appleEnabled = process.env.NEXT_PUBLIC_ENABLE_APPLE_LOGIN === "true"
    const [brandPrimary] = useState(initialBrandPrimary)
    const [brandSecondary] = useState(initialBrandSecondary)
    const [maintenanceMode] = useState(initialMaintenanceMode)
    const [currencySettings] = useState<CurrencySettings>(initialCurrencySettings)
    const [cartCount, setCartCount] = useState(0)
    const [cartTotal, setCartTotal] = useState(0)
    const [compareCount, setCompareCount] = useState(0)
    const [wishlistCount, setWishlistCount] = useState(0)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [mobileMenuTab, setMobileMenuTab] = useState<"categories" | "pages">("categories")
    const [mobileSearch, setMobileSearch] = useState("")
    const [mobileCategoriesMenu] = useState<MobileMenuItem[]>(initialMobileCategoriesMenu)
    const [mobilePagesMenu] = useState<MobileMenuItem[]>(initialMobilePagesMenu)
    const [mobileOpenItems, setMobileOpenItems] = useState<Record<string, boolean>>({})
    const [cartPreviewOpen, setCartPreviewOpen] = useState(false)
    const [loginDrawerOpen, setLoginDrawerOpen] = useState(false)
    const [authMode, setAuthMode] = useState<"login" | "register">("login")
    const [cartItems, setCartItems] = useState<ReturnType<typeof readCart>>([])
    const [registerName, setRegisterName] = useState("")
    const [registerPhone, setRegisterPhone] = useState("")
    const [registerOptIn, setRegisterOptIn] = useState(true)
    const [loginEmail, setLoginEmail] = useState("")
    const [loginPassword, setLoginPassword] = useState("")
    const [loginLoading, setLoginLoading] = useState(false)
    const [sendPasswordSetupLink] = useState(initialSendPasswordSetupLink)
    const cartPreviewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const refreshCart = () => {
        const items = readCart()
        const summary = getCartSummary(items)
        setCartItems(items)
        setCartCount(summary.count)
        setCartTotal(summary.total)
    }

    useEffect(() => {
        const eventName = getCartUpdateEventName()
        const onUpdate = () => refreshCart()
        window.addEventListener(eventName, onUpdate)
        window.addEventListener("storage", onUpdate)
        const timer = window.setTimeout(onUpdate, 0)
        return () => {
            window.clearTimeout(timer)
            window.removeEventListener(eventName, onUpdate)
            window.removeEventListener("storage", onUpdate)
        }
    }, [])

    useEffect(() => {
        const readEngagement = () => {
            try {
                const compareRaw = window.localStorage.getItem("rughouse_compare")
                const compareParsed = compareRaw ? JSON.parse(compareRaw) : []
                setCompareCount(Array.isArray(compareParsed) ? compareParsed.length : 0)

                const wishlistRaw = window.localStorage.getItem("rughouse_wishlist")
                const wishlistParsed = wishlistRaw ? JSON.parse(wishlistRaw) : []
                setWishlistCount(Array.isArray(wishlistParsed) ? wishlistParsed.length : 0)
            } catch {
                setCompareCount(0)
                setWishlistCount(0)
            }
        }
        readEngagement()
        window.addEventListener("storage", readEngagement)
        window.addEventListener("rughouse:engagement-updated", readEngagement as EventListener)
        return () => {
            window.removeEventListener("storage", readEngagement)
            window.removeEventListener("rughouse:engagement-updated", readEngagement as EventListener)
        }
    }, [])

    useEffect(() => {
        if (typeof document === "undefined") return
        if (!mobileMenuOpen) return
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = "hidden"
        return () => {
            document.body.style.overflow = previousOverflow
        }
    }, [mobileMenuOpen])

    const openCartPreview = () => {
        if (cartPreviewTimeoutRef.current) {
            clearTimeout(cartPreviewTimeoutRef.current)
            cartPreviewTimeoutRef.current = null
        }
        cartPreviewTimeoutRef.current = setTimeout(() => setCartPreviewOpen(true), 400)
    }

    const closeCartPreview = () => {
        if (cartPreviewTimeoutRef.current) clearTimeout(cartPreviewTimeoutRef.current)
        cartPreviewTimeoutRef.current = setTimeout(() => setCartPreviewOpen(false), 400)
    }

    useEffect(() => {
        return () => {
            if (cartPreviewTimeoutRef.current) {
                clearTimeout(cartPreviewTimeoutRef.current)
            }
        }
    }, [])

    const submitLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoginLoading(true)
        try {
            const res = await fetch("/api/auth/login?portal=customer", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: loginEmail, password: loginPassword }),
            })
            const json = await res.json().catch(
                () => null as null | { error?: string; code?: string; provider?: string; redirectTo?: string }
            )
            if (!res.ok) {
                if (json?.code === "SOCIAL_LOGIN_REQUIRED" && json?.provider) {
                    toast.info(`Continue with ${json.provider.toUpperCase()} for this account`)
                    window.location.assign(
                        json.redirectTo || `/api/auth/social/start?provider=${json.provider}&redirectTo=%2Faccount`
                    )
                    return
                }
                throw new Error(json?.error || "Login failed")
            }
            toast.success("Login successful")
            try {
                window.localStorage.setItem("rughouse_customer_authed", "1")
            } catch {
                // ignore local storage issues
            }
            setLoginDrawerOpen(false)
            window.dispatchEvent(new Event("rughouse:auth-updated"))
            const redirectTo = json && typeof json === "object" && "redirectTo" in json ? String((json as { redirectTo?: string }).redirectTo || "") : ""
            window.location.assign(redirectTo || "/account")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Login failed")
        } finally {
            setLoginLoading(false)
        }
    }

    const submitRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoginLoading(true)
        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: registerName,
                    phone: registerPhone,
                    email: loginEmail,
                    password: loginPassword,
                    marketingOptIn: registerOptIn,
                    source: "account",
                }),
            })
            const json = await res.json().catch(() => null as null | { error?: string; redirectTo?: string })
            if (!res.ok) throw new Error(json?.error || "Register failed")
            toast.success("Account created")
            try {
                window.localStorage.setItem("rughouse_customer_authed", "1")
            } catch {
                // ignore local storage issues
            }
            setLoginDrawerOpen(false)
            window.dispatchEvent(new Event("rughouse:auth-updated"))
            window.location.assign(json?.redirectTo || "/account")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Register failed")
        } finally {
            setLoginLoading(false)
        }
    }

    const onMobileSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        const query = mobileSearch.trim()
        const target = query ? `/shop?q=${encodeURIComponent(query)}` : "/shop"
        setMobileMenuOpen(false)
        router.push(target)
    }

    const toggleMobileItem = (id: string) => {
        setMobileOpenItems((prev) => ({ ...prev, [id]: !prev[id] }))
    }

    const renderMobileMenuItems = (items: MobileMenuItem[], depth = 0): React.ReactNode => {
        return items.map((item) => {
            const hasChildren = item.children.length > 0
            const isOpen = Boolean(mobileOpenItems[item.id])
            const isExternal = item.url.startsWith("http://") || item.url.startsWith("https://")
            return (
                <div key={item.id} className="border-b border-slate-200">
                    <div className={`flex items-center ${depth > 0 ? "bg-slate-50/70" : "bg-[#f7f7f7]"}`}>
                        {hasChildren ? (
                            <button
                                type="button"
                                onClick={() => toggleMobileItem(item.id)}
                                className={`flex h-[52px] flex-1 items-center px-4 text-left text-[15px] font-semibold tracking-wide text-slate-800 ${depth > 0 ? "pl-8 text-[14px] font-medium" : ""}`}
                            >
                                {item.label}
                            </button>
                        ) : isExternal ? (
                            <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => setMobileMenuOpen(false)}
                                className={`flex h-[52px] flex-1 items-center px-4 text-[15px] font-semibold tracking-wide text-slate-800 ${depth > 0 ? "pl-8 text-[14px] font-medium" : ""}`}
                            >
                                {item.label}
                            </a>
                        ) : (
                            <Link
                                href={item.url}
                                onClick={() => setMobileMenuOpen(false)}
                                className={`flex h-[52px] flex-1 items-center px-4 text-[15px] font-semibold tracking-wide text-slate-800 ${depth > 0 ? "pl-8 text-[14px] font-medium" : ""}`}
                            >
                                {item.label}
                            </Link>
                        )}

                        {hasChildren ? (
                            <button
                                type="button"
                                onClick={() => toggleMobileItem(item.id)}
                                className="inline-flex h-[52px] w-[52px] items-center justify-center border-l border-slate-200 bg-emerald-700 text-white"
                                aria-label={isOpen ? "Collapse submenu" : "Expand submenu"}
                            >
                                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                            </button>
                        ) : (
                            <span className="inline-flex h-[52px] w-[52px] items-center justify-center border-l border-slate-200 text-slate-400">
                                <ChevronRight className="h-4 w-4" />
                            </span>
                        )}
                    </div>
                    {hasChildren && isOpen ? <div>{renderMobileMenuItems(item.children, depth + 1)}</div> : null}
                </div>
            )
        })
    }

    return (
        <div className="bg-white border-b border-slate-100 shadow-sm relative z-40">
            <div className="container mx-auto px-3 sm:px-4 lg:px-6">
                {maintenanceMode && (
                    <div className="pt-3">
                        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                            Maintenance mode is active. Checkout actions may be temporarily unavailable.
                        </div>
                    </div>
                )}

                <div className="md:hidden pb-3">
                    <div className="flex h-16 items-center justify-between">
                        <button
                            type="button"
                            onClick={() => setMobileMenuOpen(true)}
                            className="inline-flex h-10 w-10 items-center justify-center text-slate-800"
                            aria-label="Open mobile menu"
                        >
                            <Menu className="h-7 w-7" />
                        </button>
                        <Link href="/" className="flex flex-col items-center group">
                            <span className="font-serif text-[26px] font-bold leading-none tracking-tight text-slate-900">{brandPrimary}</span>
                            <span className="-mt-1 font-serif text-[26px] font-bold leading-none tracking-tight text-teal-700">{brandSecondary}</span>
                        </Link>
                        <Link href="/basket" className="relative inline-flex h-10 w-10 items-center justify-center text-slate-700">
                            <ShoppingBag className="h-7 w-7" strokeWidth={1.8} />
                            <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[11px] font-bold text-white">
                                {cartCount}
                            </span>
                        </Link>
                    </div>
                    <form onSubmit={onMobileSearchSubmit} className="flex h-12 overflow-hidden border border-slate-300 bg-white">
                        <input
                            value={mobileSearch}
                            onChange={(event) => setMobileSearch(event.target.value)}
                            placeholder="Search for products"
                            className="h-full flex-1 px-4 text-lg text-slate-700 placeholder:text-slate-400 outline-none"
                        />
                        <button type="submit" className="inline-flex h-full w-14 items-center justify-center bg-emerald-700 text-white">
                            <Search className="h-5 w-5" />
                        </button>
                    </form>
                </div>

                <div className="hidden md:flex h-20 items-center justify-between">
                    <Link href="/" className="flex flex-col shrink-0 group">
                        <span className="font-serif text-3xl font-bold text-slate-900 tracking-tight leading-none group-hover:text-teal-900 transition-colors">
                            {brandPrimary}
                        </span>
                        <span className="font-serif text-3xl font-bold text-teal-700 tracking-tight leading-none -mt-1 group-hover:text-teal-800 transition-colors">
                            {brandSecondary}
                        </span>
                    </Link>

                    <div className="relative flex items-center gap-4">
                        <Link href="/wishlist" className="relative inline-flex h-9 items-center text-slate-700 hover:text-slate-900">
                            <Heart className="h-5 w-5" />
                            <span className="absolute -right-2 -top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-lime-500 px-1 text-[10px] font-bold text-white">
                                {wishlistCount}
                            </span>
                        </Link>
                        <Link href="/compare" className="relative inline-flex h-9 items-center text-slate-700 hover:text-slate-900">
                            <Shuffle className="h-5 w-5" />
                            <span className="absolute -right-2 -top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-lime-500 px-1 text-[10px] font-bold text-white">
                                {compareCount}
                            </span>
                        </Link>

                        <div className="relative" onMouseEnter={openCartPreview} onMouseLeave={closeCartPreview}>
                            <button
                                type="button"
                                onClick={() => router.push("/basket")}
                                className="group flex h-9 items-center gap-2 rounded-md px-1 hover:bg-slate-50 transition-colors"
                            >
                                <div className="relative text-slate-500">
                                    <ShoppingBag className="h-6 w-6" strokeWidth={1.8} />
                                    <span className="absolute -right-2 -top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-lime-500 px-1 text-[10px] font-bold text-white">
                                        {cartCount}
                                    </span>
                                </div>
                                <div className="leading-none">
                                    <p className="text-base font-semibold text-slate-800">{formatCurrency(cartTotal, currencySettings)}</p>
                                </div>
                            </button>

                            {cartPreviewOpen ? (
                                <div className="absolute right-0 top-[calc(100%+8px)] z-[120] w-[min(92vw,360px)] rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
                                    <div className="mb-2 flex items-center justify-between">
                                        <p className="text-sm font-semibold text-slate-900">Basket</p>
                                        <span className="text-xs text-slate-500">{cartCount} item(s)</span>
                                    </div>
                                    {cartItems.length === 0 ? (
                                        <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-center text-sm text-slate-500">
                                            Your basket is empty.
                                        </div>
                                    ) : (
                                        <div className="max-h-[260px] space-y-2 overflow-auto pr-1">
                                            {cartItems.slice(0, 4).map((item) => (
                                                <div key={item.productId} className="flex items-center gap-2 rounded-md border border-slate-200 p-2">
                                                    <Link href={`/product/${item.slug}`} className="h-12 w-12 shrink-0 overflow-hidden rounded border border-slate-200">
                                                        <img src={item.image || "/placeholder.jpg"} alt={item.title} className="h-full w-full object-cover" />
                                                    </Link>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-xs font-medium text-slate-900">{item.title}</p>
                                                        <p className="text-xs text-slate-500">
                                                            {item.quantity} x {formatCurrency(item.price, currencySettings)}
                                                        </p>
                                                    </div>
                                                    <p className="text-xs font-semibold text-emerald-700">
                                                        {formatCurrency(item.price * item.quantity, currencySettings)}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div className="mt-3 border-t border-slate-200 pt-3">
                                        <div className="mb-2 flex items-center justify-between text-sm">
                                            <span className="text-slate-700">Subtotal</span>
                                            <span className="font-semibold text-slate-900">{formatCurrency(cartTotal, currencySettings)}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => window.location.assign("/basket")}
                                                className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                            >
                                                View Basket
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => window.location.assign("/checkout")}
                                                className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md bg-emerald-700 text-xs font-semibold text-white hover:bg-emerald-800"
                                            >
                                                Checkout
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>

                <div className="hidden md:block">
                    <DiscoveryCapsule />
                </div>

            </div>

            {mobileMenuOpen ? (
                <div className="fixed inset-0 z-[220]">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
                    <aside className="absolute left-0 top-0 h-full w-full max-w-[620px] bg-[#f7f7f7] shadow-[0_20px_60px_rgba(15,23,42,0.35)]">
                        <div className="flex items-center justify-between border-b border-slate-300 px-4 py-4">
                            <h3 className="text-[22px] font-semibold tracking-tight text-slate-900">Menu</h3>
                            <button type="button" onClick={() => setMobileMenuOpen(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-slate-700">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={onMobileSearchSubmit} className="border-b border-slate-300 bg-white px-4 py-4">
                            <div className="flex h-12 items-center border border-slate-300 bg-white">
                                <input
                                    value={mobileSearch}
                                    onChange={(event) => setMobileSearch(event.target.value)}
                                    placeholder="Search for products"
                                    className="h-full flex-1 px-3 text-[17px] text-slate-700 outline-none placeholder:text-slate-400"
                                />
                                <button type="submit" className="inline-flex h-full w-12 items-center justify-center text-slate-500">
                                    <Search className="h-6 w-6" />
                                </button>
                            </div>
                        </form>

                        <div className="grid grid-cols-2 border-b border-slate-300 bg-[#ececec]">
                            <button
                                type="button"
                                onClick={() => setMobileMenuTab("categories")}
                                className={`h-14 text-[17px] font-semibold tracking-wide ${mobileMenuTab === "categories" ? "border-b-2 border-emerald-600 text-slate-900" : "text-slate-500"}`}
                            >
                                All Categories
                            </button>
                            <button
                                type="button"
                                onClick={() => setMobileMenuTab("pages")}
                                className={`h-14 text-[17px] font-semibold tracking-wide ${mobileMenuTab === "pages" ? "border-b-2 border-emerald-600 text-slate-900" : "text-slate-500"}`}
                            >
                                Pages
                            </button>
                        </div>

                        <div className="h-[calc(100%-186px)] overflow-y-auto pb-24">
                            {mobileMenuTab === "categories" ? (
                                mobileCategoriesMenu.length > 0 ? (
                                    <div>{renderMobileMenuItems(mobileCategoriesMenu)}</div>
                                ) : (
                                    <p className="px-4 py-6 text-sm text-slate-500">No categories menu found.</p>
                                )
                            ) : mobilePagesMenu.length > 0 ? (
                                <div>{renderMobileMenuItems(mobilePagesMenu)}</div>
                            ) : (
                                <p className="px-4 py-6 text-sm text-slate-500">No pages found.</p>
                            )}
                        </div>
                    </aside>
                </div>
            ) : null}

            <div className="fixed inset-x-0 bottom-0 z-[320] grid grid-cols-4 border-t border-slate-300 bg-white md:hidden">
                <Link href="/" className="flex h-16 flex-col items-center justify-center gap-1 text-[12px] font-semibold text-slate-700">
                    <House className="h-5 w-5" />
                    <span>Home</span>
                </Link>
                <Link href="/basket" className="relative flex h-16 flex-col items-center justify-center gap-1 text-[12px] font-semibold text-slate-700">
                    <ShoppingBag className="h-5 w-5" />
                    <span>Cart</span>
                    <span className="absolute right-7 top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
                        {cartCount}
                    </span>
                </Link>
                <Link href="/compare" className="relative flex h-16 flex-col items-center justify-center gap-1 text-[12px] font-semibold text-slate-700">
                    <Shuffle className="h-5 w-5" />
                    <span>Compare</span>
                    <span className="absolute right-7 top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
                        {compareCount}
                    </span>
                </Link>
                <button
                    type="button"
                    onClick={() => setLoginDrawerOpen(true)}
                    className="flex h-16 flex-col items-center justify-center gap-1 text-[12px] font-semibold text-slate-700"
                >
                    <UserCircle2 className="h-5 w-5" />
                    <span>My Account</span>
                </button>
            </div>

            {loginDrawerOpen ? (
                <div className="fixed inset-0 z-[230]">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setLoginDrawerOpen(false)} />
                    <aside className="absolute right-0 top-0 h-full w-full max-w-[360px] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.35)] flex flex-col animate-in slide-in-from-right duration-300">
                        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5">
                            <h3 className="text-3xl font-semibold text-slate-900">Sign in</h3>
                            <button type="button" className="inline-flex items-center gap-1 text-sm text-slate-700 hover:text-slate-900" onClick={() => setLoginDrawerOpen(false)}>
                                <X className="h-5 w-5" />
                                <span>Close</span>
                            </button>
                        </div>

                        <div className="px-4 pt-4">
                            <div className="inline-flex rounded-md border border-slate-200 p-1">
                                <button
                                    type="button"
                                    onClick={() => setAuthMode("login")}
                                    className={`rounded px-3 py-1.5 text-xs font-semibold ${authMode === "login" ? "bg-slate-900 text-white" : "text-slate-600"}`}
                                >
                                    Login
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAuthMode("register")}
                                    className={`rounded px-3 py-1.5 text-xs font-semibold ${authMode === "register" ? "bg-slate-900 text-white" : "text-slate-600"}`}
                                >
                                    Register
                                </button>
                            </div>
                        </div>

                        <form onSubmit={authMode === "login" ? submitLogin : submitRegister} className="p-4 space-y-4">
                            {authMode === "register" ? (
                                <>
                                    <div>
                                        <label className="text-sm text-slate-700">Full name <span className="text-red-500">*</span></label>
                                        <input
                                            required
                                            type="text"
                                            value={registerName}
                                            onChange={(e) => setRegisterName(e.target.value)}
                                            className="mt-2 h-11 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm text-slate-700">Phone <span className="text-red-500">*</span></label>
                                        <input
                                            required
                                            type="text"
                                            value={registerPhone}
                                            onChange={(e) => setRegisterPhone(e.target.value)}
                                            className="mt-2 h-11 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                                        />
                                    </div>
                                </>
                            ) : null}
                            <div>
                                <label className="text-sm text-slate-700">Username or email address <span className="text-red-500">*</span></label>
                                <input
                                    required
                                    type="email"
                                    name="email"
                                    autoComplete="username"
                                    value={loginEmail}
                                    onChange={(e) => setLoginEmail(e.target.value)}
                                    className="mt-2 h-11 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                                />
                            </div>
                            <div>
                                <label className="text-sm text-slate-700">Password <span className="text-red-500">*</span></label>
                                <input
                                    required
                                    type="password"
                                    name="password"
                                    autoComplete={authMode === "login" ? "current-password webauthn" : "new-password"}
                                    value={loginPassword}
                                    onChange={(e) => setLoginPassword(e.target.value)}
                                    className="mt-2 h-11 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                                />
                            </div>
                            <button type="submit" disabled={loginLoading} className="h-11 w-full rounded bg-lime-600 text-sm font-semibold text-white hover:bg-lime-700 disabled:opacity-60">
                                {loginLoading ? "PLEASE WAIT..." : authMode === "login" ? "LOG IN" : "CREATE ACCOUNT"}
                            </button>
                            {authMode === "register" && sendPasswordSetupLink ? (
                                <p className="text-xs text-slate-500">
                                    Password setup link email is enabled from settings.
                                </p>
                            ) : null}
                            <div className="flex items-center justify-between text-sm">
                                <label className="inline-flex items-center gap-2 text-slate-700">
                                    <input type="checkbox" className="h-4 w-4 accent-lime-600" />
                                    Remember me
                                </label>
                                <Link href="/info/help" className="text-lime-600 hover:underline">Lost your password?</Link>
                            </div>
                            {authMode === "register" ? (
                                <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={registerOptIn}
                                        onChange={(e) => setRegisterOptIn(e.target.checked)}
                                        className="h-4 w-4 accent-lime-600"
                                    />
                                    Send me discounts, new products, and category updates
                                </label>
                            ) : null}
                        </form>

                        <div className="px-4">
                            <div className="flex items-center gap-3 text-xs font-semibold uppercase text-slate-500">
                                <span className="h-px flex-1 bg-slate-200" />
                                Or login with
                                <span className="h-px flex-1 bg-slate-200" />
                            </div>
                            <Link href="/api/auth/social/start?provider=google&redirectTo=%2Faccount" className="mt-4 inline-flex h-11 w-full items-center justify-center rounded bg-[#4285F4] text-sm font-semibold text-white">
                                Continue with Google
                            </Link>
                            {appleEnabled ? (
                                <Link href="/api/auth/social/start?provider=apple&redirectTo=%2Faccount" className="mt-3 inline-flex h-11 w-full items-center justify-center rounded bg-black text-sm font-semibold text-white">
                                    Continue with Apple
                                </Link>
                            ) : null}
                        </div>

                        <div className="mt-auto border-t border-slate-200 px-4 py-6 text-center">
                            <p className="text-sm text-slate-600">No account yet?</p>
                            <Link href="/account/auth" className="mt-2 inline-block text-sm font-semibold uppercase text-slate-800 underline decoration-lime-600 decoration-2 underline-offset-4">
                                Create an account
                            </Link>
                        </div>
                    </aside>
                </div>
            ) : null}
        </div>
    )
}
