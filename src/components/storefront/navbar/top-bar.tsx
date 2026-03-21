"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ChevronDown } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// State for dynamic menu items
type TopBarMenuItem = {
    id: string
    label: string
    url?: string
}

export function TopBar() {
    const [items, setItems] = useState<TopBarMenuItem[]>([])
    const [language, setLanguage] = useState("English")
    const [currency, setCurrency] = useState("USD")
    const [loading, setLoading] = useState(true)
    const [mounted, setMounted] = useState(false)
    const hasFaqItem = items.some((item) => (item.label || "").trim().toLowerCase() === "faq")

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        const fetchMenu = async () => {
            try {
                const res = await fetch("/api/public/menus/TOP_NAV")
                if (res.ok) {
                    const data = await res.json()
                    // The API returns the Menu object with items array
                    if (data && data.items) {
                        setItems(data.items)
                    }
                }
            } catch (error) {
                console.error("Failed to fetch TOPBAR menu", error)
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
                if (data?.defaultCurrency) setCurrency(data.defaultCurrency)
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

                            <DropdownMenu>
                                <DropdownMenuTrigger className="flex items-center gap-1 hover:text-slate-900 transition-colors focus:outline-none">
                                    {currency}
                                    <ChevronDown className="h-3 w-3" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="text-xs">
                                    <DropdownMenuItem>USD ($)</DropdownMenuItem>
                                    <DropdownMenuItem>EUR (€)</DropdownMenuItem>
                                    <DropdownMenuItem>GBP (£)</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </>
                    ) : (
                        <>
                            <span>{language}</span>
                            <span>{currency}</span>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
