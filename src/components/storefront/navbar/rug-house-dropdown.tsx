"use client"

import { type FormEvent, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"

import { ChevronDown, Heart, LogIn, Package, Search, UserCircle2, UserPlus, X } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export function RugHouseDropdown() {
    const HOVER_OPEN_DELAY_MS = 400
    const [open, setOpen] = useState(false)
    const [guestOpen, setGuestOpen] = useState(false)
    const [guestModalMode, setGuestModalMode] = useState<null | "login" | "register">(null)
    const [showRegisterSuccess, setShowRegisterSuccess] = useState(false)
    const [loading, setLoading] = useState(false)
    const [loginEmail, setLoginEmail] = useState("")
    const [loginPassword, setLoginPassword] = useState("")
    const [registerFirstName, setRegisterFirstName] = useState("")
    const [registerLastName, setRegisterLastName] = useState("")
    const [registerEmail, setRegisterEmail] = useState("")
    const [registerPhone, setRegisterPhone] = useState("")
    const [registerPassword, setRegisterPassword] = useState("")
    const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState("")
    const [registerOptIn, setRegisterOptIn] = useState(true)
    // Keep first client render identical to server render to avoid hydration mismatch.
    const [isCustomerAuthenticated, setIsCustomerAuthenticated] = useState(false)
    const timeoutRef = useRef<NodeJS.Timeout | null>(null)
    const openTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const guestTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const guestOpenTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const pathname = usePathname()
    const onAccountPage = Boolean(pathname?.startsWith("/account") && pathname !== "/account/auth")

    useEffect(() => {
        const loadSession = async () => {
            try {
                const res = await fetch("/api/auth/session?portal=customer", { cache: "no-store" })
                if (!res.ok) return
                const json = (await res.json()) as { authenticated?: boolean; user?: { role?: string } }
                const authenticated = Boolean(json.authenticated && json.user?.role === "CUSTOMER")
                setIsCustomerAuthenticated(authenticated)
                try {
                    if (authenticated) window.localStorage.setItem("rughouse_customer_authed", "1")
                    else window.localStorage.removeItem("rughouse_customer_authed")
                } catch {
                    // ignore local storage issues
                }
            } catch {
                // Keep last known auth state on transient request errors.
            }
        }
        void loadSession()
        const onFocus = () => {
            void loadSession()
        }
        const interval = window.setInterval(() => {
            if (document.visibilityState === "visible") {
                void loadSession()
            }
        }, 15000)
        window.addEventListener("focus", onFocus)
        window.addEventListener("rughouse:auth-updated", onFocus as EventListener)
        return () => {
            window.clearInterval(interval)
            window.removeEventListener("focus", onFocus)
            window.removeEventListener("rughouse:auth-updated", onFocus as EventListener)
        }
    }, [])

    const handleMouseEnter = () => {
        if (!isCustomerAuthenticated) return
        if (openTimeoutRef.current) {
            clearTimeout(openTimeoutRef.current)
            openTimeoutRef.current = null
        }
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
        }
        openTimeoutRef.current = setTimeout(() => {
            setOpen(true)
            openTimeoutRef.current = null
        }, HOVER_OPEN_DELAY_MS)
    }

    const handleMouseLeave = () => {
        if (!isCustomerAuthenticated) return
        if (openTimeoutRef.current) {
            clearTimeout(openTimeoutRef.current)
            openTimeoutRef.current = null
        }
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
        }
        timeoutRef.current = setTimeout(() => {
            setOpen(false)
        }, 120)
    }

    const handleGuestMouseEnter = () => {
        if (guestOpenTimeoutRef.current) {
            clearTimeout(guestOpenTimeoutRef.current)
            guestOpenTimeoutRef.current = null
        }
        if (guestTimeoutRef.current) {
            clearTimeout(guestTimeoutRef.current)
            guestTimeoutRef.current = null
        }
        guestOpenTimeoutRef.current = setTimeout(() => {
            setGuestOpen(true)
            guestOpenTimeoutRef.current = null
        }, HOVER_OPEN_DELAY_MS)
    }

    const handleGuestMouseLeave = () => {
        if (guestOpenTimeoutRef.current) {
            clearTimeout(guestOpenTimeoutRef.current)
            guestOpenTimeoutRef.current = null
        }
        if (guestTimeoutRef.current) {
            clearTimeout(guestTimeoutRef.current)
        }
        guestTimeoutRef.current = setTimeout(() => {
            setGuestOpen(false)
        }, 120)
    }

    const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (loading) return
        setLoading(true)
        try {
            const res = await fetch("/api/auth/login?portal=customer", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword }),
            })
            const data = (await res.json().catch(() => ({}))) as { error?: string; redirectTo?: string }
            if (!res.ok) {
                toast.error(data.error || "Login failed")
                return
            }
            setGuestModalMode(null)
            setGuestOpen(false)
            setIsCustomerAuthenticated(true)
            window.dispatchEvent(new Event("rughouse:auth-updated"))
            window.location.href = data.redirectTo || "/account"
        } catch {
            toast.error("Login failed")
        } finally {
            setLoading(false)
        }
    }

    const submitRegister = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (loading) return
        if (registerPassword !== registerPasswordConfirm) {
            toast.error("Passwords do not match")
            return
        }
        setLoading(true)
        try {
            const fullName = `${registerFirstName} ${registerLastName}`.trim()
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: fullName,
                    email: registerEmail.trim(),
                    phone: registerPhone.trim(),
                    password: registerPassword,
                    marketingOptIn: registerOptIn,
                    source: "account",
                }),
            })
            const data = (await res.json().catch(() => ({}))) as { error?: string; redirectTo?: string; requiresEmailVerification?: boolean }
            if (!res.ok) {
                toast.error(data.error || "Registration failed")
                return
            }
            setGuestModalMode(null)
            setGuestOpen(false)
            setShowRegisterSuccess(true)
            setRegisterFirstName("")
            setRegisterLastName("")
            setRegisterEmail("")
            setRegisterPhone("")
            setRegisterPassword("")
            setRegisterPasswordConfirm("")
        } catch {
            toast.error("Registration failed")
        } finally {
            setLoading(false)
        }
    }

    if (!isCustomerAuthenticated && !onAccountPage) {
        return (
            <>
                <div
                    className="relative h-full flex items-center justify-center w-full"
                    onMouseEnter={handleGuestMouseEnter}
                    onMouseLeave={handleGuestMouseLeave}
                >
                    <button
                        type="button"
                        className="inline-flex h-16 w-full items-center justify-center gap-2 rounded-md px-4 text-left text-slate-900 hover:bg-slate-100/50"
                        onClick={() => setGuestOpen((current) => !current)}
                    >
                        <UserCircle2 className="h-8 w-8 shrink-0 text-teal-800" />
                        <span className="flex flex-col leading-tight">
                            <span className="text-base font-semibold text-slate-900">Account</span>
                            <span className="text-xs font-medium text-slate-600">Login / Register</span>
                        </span>
                    </button>

                    {guestOpen ? (
                        <div className="absolute left-1/2 top-[calc(100%-2px)] z-[90] w-52 -translate-x-1/2 rounded-sm border border-slate-200 bg-white p-0 text-slate-700 shadow-xl">
                            <button
                                type="button"
                                className="flex w-full items-center gap-2.5 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                onClick={() => {
                                    setGuestModalMode("login")
                                    setGuestOpen(false)
                                }}
                            >
                                <LogIn className="h-5 w-5 text-slate-500" />
                                <span className="text-[15px] text-slate-700">Login</span>
                            </button>
                            <button
                                type="button"
                                className="flex w-full items-center gap-2.5 border-t border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                onClick={() => {
                                    setGuestModalMode("register")
                                    setGuestOpen(false)
                                }}
                            >
                                <UserPlus className="h-5 w-5 text-slate-500" />
                                <span className="text-[15px] text-slate-700">Register</span>
                            </button>
                        </div>
                    ) : null}
                </div>

                {guestModalMode === "login" ? (
                    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/55 p-4">
                        <div className="relative w-full max-w-[480px] rounded-md bg-white px-6 py-6 shadow-2xl">
                            <button
                                type="button"
                                className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
                                onClick={() => setGuestModalMode(null)}
                            >
                                <X className="h-5 w-5" />
                            </button>
                            <h3 className="text-2xl font-semibold text-slate-900">Returning Customer</h3>
                            <form className="mt-5 space-y-4" onSubmit={submitLogin}>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-slate-700">E-Mail Address</label>
                                    <input
                                        required
                                        type="email"
                                        value={loginEmail}
                                        onChange={(event) => setLoginEmail(event.target.value)}
                                        className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                                        placeholder="E-Mail Address"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-slate-700">Password</label>
                                    <input
                                        required
                                        type="password"
                                        value={loginPassword}
                                        onChange={(event) => setLoginPassword(event.target.value)}
                                        className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                                        placeholder="Password"
                                    />
                                </div>
                                <Link href="/info/help" className="inline-block text-sm text-teal-700 underline underline-offset-4">
                                    Forgotten Password
                                </Link>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="inline-flex h-10 w-full items-center justify-center rounded-md bg-teal-700 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-70"
                                >
                                    {loading ? "Please wait..." : "Login"}
                                </button>
                            </form>
                        </div>
                    </div>
                ) : null}

                {guestModalMode === "register" ? (
                    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/55 p-4">
                        <div className="relative w-full max-w-[640px] max-h-[88vh] overflow-y-auto rounded-md bg-white px-6 py-6 shadow-2xl">
                            <button
                                type="button"
                                className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
                                onClick={() => setGuestModalMode(null)}
                            >
                                <X className="h-5 w-5" />
                            </button>
                            <h3 className="text-2xl font-semibold text-slate-900">Your Personal Details</h3>
                            <form className="mt-5 space-y-3.5" onSubmit={submitRegister}>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-slate-700">First Name</label>
                                    <input
                                        required
                                        type="text"
                                        value={registerFirstName}
                                        onChange={(event) => setRegisterFirstName(event.target.value)}
                                        className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                                        placeholder="First Name"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-slate-700">Last Name</label>
                                    <input
                                        required
                                        type="text"
                                        value={registerLastName}
                                        onChange={(event) => setRegisterLastName(event.target.value)}
                                        className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                                        placeholder="Last Name"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-slate-700">E-Mail *</label>
                                    <input
                                        required
                                        type="email"
                                        value={registerEmail}
                                        onChange={(event) => setRegisterEmail(event.target.value)}
                                        className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                                        placeholder="E-Mail"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-slate-700">Telephone</label>
                                    <input
                                        required
                                        type="text"
                                        value={registerPhone}
                                        onChange={(event) => setRegisterPhone(event.target.value)}
                                        className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                                        placeholder="Telephone"
                                    />
                                </div>
                                <h4 className="pt-1 text-xl font-semibold text-slate-900">Your Password</h4>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-slate-700">Password *</label>
                                    <input
                                        required
                                        type="password"
                                        value={registerPassword}
                                        onChange={(event) => setRegisterPassword(event.target.value)}
                                        className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                                        placeholder="Password"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-slate-700">Password Confirm *</label>
                                    <input
                                        required
                                        type="password"
                                        value={registerPasswordConfirm}
                                        onChange={(event) => setRegisterPasswordConfirm(event.target.value)}
                                        className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                                        placeholder="Password Confirm"
                                    />
                                </div>
                                <h4 className="pt-1 text-xl font-semibold text-slate-900">Newsletter</h4>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-slate-700">Subscribe</label>
                                    <div className="flex items-center gap-6 text-sm text-slate-700">
                                        <label className="inline-flex items-center gap-2">
                                            <input type="radio" name="register-subscribe" checked={registerOptIn} onChange={() => setRegisterOptIn(true)} />
                                            <span>Yes</span>
                                        </label>
                                        <label className="inline-flex items-center gap-2">
                                            <input type="radio" name="register-subscribe" checked={!registerOptIn} onChange={() => setRegisterOptIn(false)} />
                                            <span>No</span>
                                        </label>
                                    </div>
                                </div>
                                <label className="inline-flex items-center gap-2 pt-1 text-sm text-slate-700">
                                    <input required type="checkbox" />
                                    <span>
                                        I have read and agree to the{" "}
                                        <Link href="/info/privacy-policy" className="text-teal-700 underline underline-offset-4">
                                            Privacy Policy
                                        </Link>
                                    </span>
                                </label>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="inline-flex h-10 w-full items-center justify-center rounded-md bg-teal-700 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-70"
                                >
                                    {loading ? "Please wait..." : "Register"}
                                </button>
                            </form>
                        </div>
                    </div>
                ) : null}

                {showRegisterSuccess ? (
                    <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/45 p-4">
                        <div className="w-full max-w-[420px] rounded-md bg-white p-5 shadow-2xl">
                            <h4 className="text-base font-semibold text-slate-900">Registration completed</h4>
                            <p className="mt-2 text-sm text-slate-600">
                                Your account has been created successfully. You can log in immediately.
                            </p>
                            <button
                                type="button"
                                className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-md bg-teal-700 text-sm font-semibold text-white hover:bg-teal-800"
                                onClick={() => setShowRegisterSuccess(false)}
                            >
                                OK
                            </button>
                        </div>
                    </div>
                ) : null}
            </>
        )
    }

    return (
        <div
            className="relative h-full flex items-center justify-center w-full"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <Button
                variant="ghost"
                className={`h-16 w-full justify-center px-4 font-medium gap-2 text-base rounded-md bg-transparent border-none shadow-none ${
                    open ? "text-teal-800 bg-slate-100/50" : "text-slate-700 hover:text-slate-900 hover:bg-slate-100/50"
                }`}
            >
                My Account
                <ChevronDown className="h-5 w-5 text-slate-400" />
            </Button>

            {open ? (
                <div className="absolute left-1/2 top-[calc(100%-2px)] z-[80] w-56 -translate-x-1/2 rounded-md border border-slate-200 bg-white p-2 text-slate-900 shadow-xl">
                    <div className="flex flex-col gap-1">
                        <Link href="/account" className="flex items-center gap-3 rounded-md p-2.5 text-slate-800 hover:bg-slate-50">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-600">
                                <LogIn className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-sm font-medium text-slate-900">My Account</span>
                                <span className="text-[10px] text-slate-500">Manage profile</span>
                            </div>
                        </Link>
                        <Link href="/account?tab=orders" className="flex items-center gap-3 rounded-md p-2.5 text-slate-800 hover:bg-slate-50">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-600">
                                <Package className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-sm font-medium text-slate-900">Orders</span>
                                <span className="text-[10px] text-slate-500">Track & history</span>
                            </div>
                        </Link>
                        <Link href="/wishlist" className="flex items-center gap-3 rounded-md p-2.5 text-slate-800 hover:bg-slate-50">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-600">
                                <Heart className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-sm font-medium text-slate-900">Wishlist</span>
                                <span className="text-[10px] text-slate-500">Saved items</span>
                            </div>
                        </Link>
                        <Link href="/saved-searches" className="flex items-center gap-3 rounded-md p-2.5 text-slate-800 hover:bg-slate-50">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-600">
                                <Search className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-sm font-medium text-slate-900">Saved Searches</span>
                                <span className="text-[10px] text-slate-500">Search history</span>
                            </div>
                        </Link>
                    </div>
                </div>
            ) : null}
        </div>
    )
}
