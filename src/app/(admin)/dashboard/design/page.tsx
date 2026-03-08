"use client"

import { useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MenuManager } from "@/components/admin/menus/menu-manager"
import { ShopByCategoryMenuEditor } from "@/components/admin/design/shop-by-category-menu-editor"

type DesignTab = "banners" | "header" | "footer"

function normalizeTab(value: string | null): DesignTab {
    if (value === "header" || value === "footer" || value === "banners") return value
    return "banners"
}

export default function DesignPage() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const tab = normalizeTab(searchParams.get("tab"))

    const title = useMemo(() => {
        if (tab === "header") return "Header Menus"
        if (tab === "footer") return "Footer Menus"
        return "Banner Settings"
    }, [tab])

    const handleTabChange = (nextTab: string) => {
        const normalized = normalizeTab(nextTab)
        const params = new URLSearchParams(searchParams.toString())
        params.set("tab", normalized)
        router.replace(`${pathname}?${params.toString()}`)
    }

    return (
        <div className="p-6 max-w-[1600px] mx-auto min-h-screen pb-20">
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Design</h1>
                <p className="mt-1 text-sm text-slate-500">{title}</p>
            </div>

            <Tabs value={tab} onValueChange={handleTabChange} className="space-y-6">
                <TabsList>
                    <TabsTrigger value="banners">Banners</TabsTrigger>
                    <TabsTrigger value="header">Header</TabsTrigger>
                    <TabsTrigger value="footer">Footer</TabsTrigger>
                </TabsList>

                <TabsContent value="banners" className="space-y-4">
                    <ShopByCategoryMenuEditor />
                </TabsContent>

                <TabsContent value="header">
                    <MenuManager forcedLocation="PRIMARY_HEADER" />
                </TabsContent>

                <TabsContent value="footer">
                    <MenuManager forcedLocation="INFORMATION_FOOTER" />
                </TabsContent>
            </Tabs>
        </div>
    )
}
