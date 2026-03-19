"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Check, ChevronDown } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useStorefrontCurrency } from "@/components/storefront/currency-provider"

// State for dynamic menu items
type TopBarMenuItem = {
    id: string
    label: string
    url?: string
}

export function TopBar() {
    const HOVER_OPEN_DELAY_MS = 400
    const HOVER_CLOSE_DELAY_MS = 120
    const [items, setItems] = useState<TopBarMenuItem[]>([])
    const [language, setLanguage] = useState("English")
    const { selectedCurrency, setCurrency } = useStorefrontCurrency()
    const [loading, setLoading] = useState(true)
    const [mounted, setMounted] = useState(false)
    const [currencyOpen, setCurrencyOpen] = useState(false)
    const [currencyPanelVisible, setCurrencyPanelVisible] = useState(false)
    const [currencyPanelAnimated, setCurrencyPanelAnimated] = useState(false)
    const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const currencyWrapperRef = useRef<HTMLDivElement | null>(null)
    const hasFaqItem = items.some((item) => (item.label || "").trim().toLowerCase() === "faq")

    const clearTimers = () => {
        if (openTimerRef.current) clearTimeout(openTimerRef.current)
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
        openTimerRef.current = null
        closeTimerRef.current = null
    }

    const scheduleCurrencyOpen = () => {
        clearTimers()
        openTimerRef.current = setTimeout(() => setCurrencyOpen(true), HOVER_OPEN_DELAY_MS)
    }

    const scheduleCurrencyClose = () => {
        if (openTimerRef.current) clearTimeout(openTimerRef.current)
        closeTimerRef.current = setTimeout(() => setCurrencyOpen(false), HOVER_CLOSE_DELAY_MS)
    }

    const handleCurrencyMouseLeave = (event: React.MouseEvent<HTMLDivElement>) => {
        const nextTarget = event.relatedTarget
        if (nextTarget instanceof Node && currencyWrapperRef.current?.contains(nextTarget)) return
        scheduleCurrencyClose()
    }

    useEffect(() => {
        setMounted(true)
        return clearTimers
    }, [])

    useEffect(() => {
        if (currencyOpen) {
            setCurrencyPanelVisible(true)
            const frame = requestAnimationFrame(() => setCurrencyPanelAnimated(true))
            return () => cancelAnimationFrame(frame)
        }
        setCurrencyPanelAnimated(false)
        setCurrencyPanelVisible(false)
    }, [currencyOpen])

    useEffect(() => {
        const fetchMenu = async () => {
            try {
                const res = await fetch("/api/public/menus/TOP_BAR", { cache: "no-store" })
                if (res.ok) {
                    const data = await res.json()
                    // The API returns the Menu object with items array
                    if (data && data.items) {
                        setItems(data.items)
                    }
                }
            } catch {
                // Menu fetch failures should not spam runtime logs.
            } finally {
                setLoading(false)
            }
        }
        fetchMenu()
    }, [])

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch("/api/public/settings", { cache: "no-store" })
                if (!res.ok) return
                const data = await res.json()
                if (data?.defaultLanguage) setLanguage(data.defaultLanguage)
            } catch {
                // keep defaults
            }
        }
        fetchSettings()
    }, [])

    return (
        <div className="bg-white border-b border-slate-100 hidden md:block">
            <div className="container mx-auto px-6 h-9 flex items-center justify-between text-[11px] font-medium tracking-wide uppercase text-slate-500">
                {/* Left Side: Dynamic Helper Details */}
                <div className="flex items-center gap-6">
                    {loading ? (
                        <span className="opacity-0">Loading...</span>
                    ) : items.length > 0 ? (
                        <>
                            {items.map((item) => (
                                <Link
                                    key={item.id}
                                    href={item.url || "#"}
                                    className="hover:text-slate-900 transition-colors"
                                >
                                    {item.label}
                                </Link>
                            ))}
                            {!hasFaqItem ? (
                                <Link href="/faq" className="hover:text-slate-900 transition-colors">
                                    FAQ
                                </Link>
                            ) : null}
                        </>
                    ) : (
                        // Fallback/Default if no menu is defined
                        <>
                            <Link href="/info/about" className="hover:text-slate-900 transition-colors">
                                About Us
                            </Link>
                            <Link href="/help" className="hover:text-slate-900 transition-colors">
                                Help
                            </Link>
                            <Link href="/info/contact" className="hover:text-slate-900 transition-colors">
                                Contact
                            </Link>
                            <Link href="/faq" className="hover:text-slate-900 transition-colors">
                                FAQ
                            </Link>
                        </>
                    )}
                </div>

                {/* Right Side: Settings */}
                <div className="flex items-center gap-4">
                    {mounted ? (
                        <>
                            <DropdownMenu>
                                <DropdownMenuTrigger className="flex items-center gap-1 hover:text-slate-900 transition-colors focus:outline-none">
                                    {language}
                                    <ChevronDown className="h-3 w-3" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="text-xs">
                                    <DropdownMenuItem>English</DropdownMenuItem>
                                    <DropdownMenuItem>Turkish</DropdownMenuItem>
                                    <DropdownMenuItem>German</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <div
                                ref={currencyWrapperRef}
                                className="relative z-[120]"
                                onMouseEnter={() => {
                                    clearTimers()
                                    scheduleCurrencyOpen()
                                }}
                                onMouseLeave={handleCurrencyMouseLeave}
                            >
                                <button
                                    type="button"
                                    className="flex items-center gap-1 hover:text-slate-900 transition-colors focus:outline-none"
                                    aria-haspopup="menu"
                                    aria-expanded={currencyOpen}
                                    onClick={() => {
                                        clearTimers()
                                        setCurrencyOpen((current) => !current)
                                    }}
                                >
                                    Currencies
                                    <ChevronDown className={`h-3 w-3 transition-transform ${currencyOpen ? "rotate-180" : ""}`} />
                                </button>

                                {currencyPanelVisible ? (
                                <div
                                    className={`absolute right-0 top-full z-[130] mt-2 min-w-[180px] rounded-xl border border-slate-200 bg-white p-1 text-xs shadow-[0_18px_45px_rgba(15,23,42,0.12)] transition-[opacity,transform] duration-150 ease-out ${
                                        currencyPanelAnimated ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
                                    }`}
                                    role="menu"
                                    aria-label="Currencies"
                                    onMouseEnter={clearTimers}
                                    onMouseLeave={handleCurrencyMouseLeave}
                                >
                                    <button
                                        type="button"
                                        role="menuitemradio"
                                        aria-checked={selectedCurrency === "USD"}
                                        onClick={() => {
                                            setCurrency("USD")
                                            setCurrencyOpen(false)
                                        }}
                                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors ${
                                            selectedCurrency === "USD"
                                                ? "bg-slate-100 text-slate-900"
                                                : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                                        }`}
                                    >
                                        <span>USD ($)</span>
                                        {selectedCurrency === "USD" ? <Check className="h-3.5 w-3.5 text-slate-900" /> : null}
                                    </button>
                                    <button
                                        type="button"
                                        role="menuitemradio"
                                        aria-checked={selectedCurrency === "EUR"}
                                        onClick={() => {
                                            setCurrency("EUR")
                                            setCurrencyOpen(false)
                                        }}
                                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors ${
                                            selectedCurrency === "EUR"
                                                ? "bg-slate-100 text-slate-900"
                                                : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                                        }`}
                                    >
                                        <span>EUR (€)</span>
                                        {selectedCurrency === "EUR" ? <Check className="h-3.5 w-3.5 text-slate-900" /> : null}
                                    </button>
                                </div>
                                ) : null}
                            </div>
                        </>
                    ) : (
                        <>
                            <span>{language}</span>
                            <span>Currencies</span>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
