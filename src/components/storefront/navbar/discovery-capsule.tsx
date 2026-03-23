"use client"

import * as React from "react"
import { useState, useRef } from "react"
import dynamic from "next/dynamic"
import { SearchBar } from "./search-bar"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"

const RugHouseDropdown = dynamic(
    () => import("./rug-house-dropdown").then((mod) => mod.RugHouseDropdown),
    { ssr: false }
)

const SharedMegaPanel = dynamic(
    () => import("./shared-mega-panel").then((mod) => mod.SharedMegaPanel),
    { ssr: false }
)

type DiscoveryMenuNode = {
    id: string
    label: string
    url: string
    children: DiscoveryMenuNode[]
}

export function DiscoveryCapsule({
    compact = false,
    infoItems = [],
}: {
    compact?: boolean
    infoItems?: DiscoveryMenuNode[]
}) {
    const HOVER_OPEN_DELAY_MS = 400
    // State to track which tab is active (open)
    const [activeTab, setActiveTab] = useState<'categories' | 'information' | null>(null)
    const openTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    // Handlers
    const handleMouseEnter = (tab: 'categories' | 'information') => {
        if (openTimeoutRef.current) {
            clearTimeout(openTimeoutRef.current)
            openTimeoutRef.current = null
        }
        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current)
            closeTimeoutRef.current = null
        }
        openTimeoutRef.current = setTimeout(() => {
            setActiveTab(tab)
            openTimeoutRef.current = null
        }, HOVER_OPEN_DELAY_MS)
    }

    const handleMouseLeave = () => {
        if (openTimeoutRef.current) {
            clearTimeout(openTimeoutRef.current)
            openTimeoutRef.current = null
        }
        closeTimeoutRef.current = setTimeout(() => {
            setActiveTab(null)
        }, 150) // Short delay to allow movement to panel
    }

    const handlePanelMouseEnter = () => {
        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current)
            closeTimeoutRef.current = null
        }
    }

    return (
        <div className="w-full relative z-50">
            {/* 
               The Main Capsule Container - h-16 Full Width
               Relative positioning used for anchoring the SharedMegaPanel
            */}
            <div className="relative w-full">
                <div className={`flex items-center w-full bg-slate-50 border border-slate-200 rounded-lg shadow-sm transition-all overflow-visible ${compact ? "h-12" : "h-16"}`}>

                    {/* 1. All Categories Trigger (Auto Width + Padding) */}
                    <div className="shrink-0 pl-1 h-full flex items-center">
                        <Button
                            variant="ghost"
                            className={`${compact ? "h-12 px-4 text-sm" : "h-16 px-6 text-base"} w-auto justify-center font-semibold transition-colors rounded-md bg-transparent border-none shadow-none hover:bg-slate-100/50 gap-2 ${activeTab === 'categories' ? 'text-teal-800 bg-slate-100/50' : 'text-slate-900 hover:text-teal-700'
                                }`}
                            onMouseEnter={() => handleMouseEnter('categories')}
                            onMouseLeave={handleMouseLeave}
                        >
                            All Categories
                            <ChevronDown className="h-5 w-5 text-slate-400" />
                        </Button>
                    </div>

                    {/* Divider */}
                    <div className="h-8 w-px bg-slate-200 shrink-0" />

                    {/* 2. Search Bar (Flex-1: Fills remaining space) */}
                    <div className="flex-1 min-w-0 h-full">
                        <SearchBar />
                    </div>

                    {/* Divider */}
                    <div className="h-8 w-px bg-slate-200 shrink-0" />

                    {/* 3. Rug House Dropdown (Auto Width) */}
                    <div className="shrink-0 h-full flex items-center">
                        <div className="w-auto px-6 h-full flex justify-center">
                            <RugHouseDropdown />
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="h-8 w-px bg-slate-200 shrink-0" />

                    {/* 4. Information Trigger (Auto Width) */}
                    <div className="shrink-0 pr-1 h-full flex items-center">
                        <Button
                            variant="ghost"
                            className={`${compact ? "h-12 px-4 text-sm" : "h-16 px-6 text-base"} w-auto justify-center font-semibold transition-colors rounded-md bg-transparent border-none shadow-none hover:bg-slate-100/50 gap-2 ${activeTab === 'information' ? 'text-teal-800 bg-slate-100/50' : 'text-slate-900 hover:text-teal-700'
                                }`}
                            onMouseEnter={() => handleMouseEnter('information')}
                            onMouseLeave={handleMouseLeave}
                        >
                            Information
                            <ChevronDown className="h-5 w-5 text-slate-400" />
                        </Button>
                    </div>
                </div>

                {/* Shared Panel - Anchored left-0 (Start of container) */}
                <SharedMegaPanel
                    activeTab={activeTab}
                    infoItems={infoItems}
                    onMouseEnter={handlePanelMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    onLinkClick={() => setActiveTab(null)}
                />
            </div>
        </div>
    )
}
