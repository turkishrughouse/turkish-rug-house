"use client"

import Link from "next/link"
import { Search, ShoppingBag, User } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function Header() {
    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-100">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-8">
                {/* Logo */}
                <Link href="/" className="text-xl font-bold tracking-tight shrink-0">
                    Turkish Rug House
                </Link>

                {/* Search */}
                <div className="hidden md:flex flex-1 max-w-md relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search for rugs..."
                        className="pl-9 bg-slate-50 border-slate-200 focus-visible:ring-offset-0 focus-visible:ring-1 focus-visible:ring-slate-300 rounded-full"
                    />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="text-slate-600 hover:text-slate-900">
                        <User className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-slate-600 hover:text-slate-900 relative">
                        <ShoppingBag className="h-5 w-5" />
                        <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-teal-600 rounded-full border border-white"></span>
                    </Button>
                </div>
            </div>
        </header>
    )
}
