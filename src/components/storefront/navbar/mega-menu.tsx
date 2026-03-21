"use client"

import * as React from "react"
import Link from "next/link"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

export const CATEGORIES = {
    byType: [
        "Vintage Rugs", "Turkish Rugs", "Vintage Kilims", "Overdyed Rugs",
        "Patchwork Vintage Rugs", "New Kilims", "Runner Rugs",
        "Hand-Knotted Rugs", "Antique Kilims", "Oversized Vintage Rugs",
        "Hand-Finished Rugs"
    ],
    byStyle: [
        "Traditional", "Tribal", "Contemporary", "Overdyed", "Patchwork",
        "Striped", "Solid", "Tulu", "Pictorial", "Floral", "Prayer",
        "Flag", "Bohemian"
    ],
    bySize: [
        "Small Size", "Medium Size", "Large Size", "Oversize",
        "Runner", "Round Rugs"
    ],
    byColor: [
        "Aqua (Blue–Green)", "Beige", "Black", "Blue", "Brown",
        "Burgundy", "Dark Blue", "Green", "Gray", "Light Blue",
        "Multicolor", "Orange", "Pink", "Purple", "Red", "Yellow"
    ],
    byAge: [
        "New", "Vintage", "Antique"
    ]
}

export function MegaMenu() {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-14 px-6 text-base font-semibold text-slate-900 hover:bg-slate-100/50 hover:text-teal-700 transition-colors data-[state=open]:text-teal-800 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-md bg-transparent border-none shadow-none outline-none">
                    All Categories
                </Button>
            </DropdownMenuTrigger>
            {/* 
               Strict Alignment: align="start" ensures it starts exactly at the left edge of the trigger.
               sideOffset={0} ensures it touches the capsule bottom if needed, or minimal gap.
            */}
            <DropdownMenuContent align="start" sideOffset={8} className="w-[1000px] p-8">
                <div className="grid grid-cols-5 gap-8">
                    {/* Column 1: By Type */}
                    <div className="space-y-4">
                        <h4 className="font-serif text-lg font-semibold text-slate-900 border-b border-slate-100 pb-2 mb-4">
                            By Type
                        </h4>
                        <ul className="space-y-2">
                            {CATEGORIES.byType.map((item) => (
                                <li key={item}>
                                    <Link href={`/category/${slugify(item)}`} className="block text-sm text-slate-600 hover:text-teal-700 hover:translate-x-1 transition-all">
                                        {item}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Column 2: By Style */}
                    <div className="space-y-4">
                        <h4 className="font-serif text-lg font-semibold text-slate-900 border-b border-slate-100 pb-2 mb-4">
                            By Style
                        </h4>
                        <ul className="space-y-2">
                            {CATEGORIES.byStyle.map((item) => (
                                <li key={item}>
                                    <Link href={`/style/${slugify(item)}`} className="block text-sm text-slate-600 hover:text-teal-700 hover:translate-x-1 transition-all">
                                        {item}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Column 3: By Size */}
                    <div className="space-y-4">
                        <h4 className="font-serif text-lg font-semibold text-slate-900 border-b border-slate-100 pb-2 mb-4">
                            By Size
                        </h4>
                        <ul className="space-y-2">
                            {CATEGORIES.bySize.map((item) => (
                                <li key={item}>
                                    <Link href={`/size/${slugify(item)}`} className="block text-sm text-slate-600 hover:text-teal-700 hover:translate-x-1 transition-all">
                                        {item}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Column 4: By Color */}
                    <div className="space-y-4">
                        <h4 className="font-serif text-lg font-semibold text-slate-900 border-b border-slate-100 pb-2 mb-4">
                            By Color
                        </h4>
                        <ul className="space-y-2">
                            {CATEGORIES.byColor.map((item) => (
                                <li key={item}>
                                    <Link href={`/color/${slugify(item)}`} className="block text-sm text-slate-600 hover:text-teal-700 hover:translate-x-1 transition-all">
                                        {item}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Column 5: By Age */}
                    <div className="space-y-4">
                        <h4 className="font-serif text-lg font-semibold text-slate-900 border-b border-slate-100 pb-2 mb-4">
                            By Age
                        </h4>
                        <ul className="space-y-2">
                            {CATEGORIES.byAge.map((item) => (
                                <li key={item}>
                                    <Link href={`/age/${slugify(item)}`} className="block text-sm text-slate-600 hover:text-teal-700 hover:translate-x-1 transition-all">
                                        {item}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

function slugify(text: string) {
    return text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '')
}
