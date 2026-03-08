"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Eye, Save, RotateCcw, Monitor, Smartphone, Tablet } from "lucide-react"
import { PreviewProductCard } from "@/components/admin/preview/product-card"
import { PREVIEW_PRODUCTS } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

// Types for our design state
type DesignState = {
    gridColumns: number
    gap: 'tight' | 'normal' | 'loose'
    cardRatio: 'square' | 'portrait' | 'landscape'
    titleSize: 'sm' | 'md' | 'lg'
    priceStyle: 'simple' | 'bold'
    badgeStyle: 'minimal' | 'solid'
}

const DEFAULT_STATE: DesignState = {
    gridColumns: 3,
    gap: 'normal',
    cardRatio: 'portrait',
    titleSize: 'md',
    priceStyle: 'simple',
    badgeStyle: 'minimal'
}

export default function DesignModule() {
    const [settings, setSettings] = useState<DesignState>(DEFAULT_STATE)
    const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')

    const handleReset = () => setSettings(DEFAULT_STATE)
    const handleSave = () => {
        // API Call placeholder
        alert("Settings Saved (Simulated)")
    }

    // Derived classes for preview container
    const gridClass = {
        1: "grid-cols-1",
        2: "grid-cols-2",
        3: "grid-cols-3",
        4: "grid-cols-4",
    }[viewport === 'mobile' ? 1 : viewport === 'tablet' ? 2 : settings.gridColumns]

    const gapClass = {
        tight: "gap-4",
        normal: "gap-8",
        loose: "gap-12",
    }[settings.gap]

    const viewportWidth = {
        desktop: "w-full",
        tablet: "w-[768px]",
        mobile: "w-[375px]"
    }[viewport]

    return (
        <div className="h-[calc(100vh-4rem)] flex overflow-hidden">
            {/* LEFT: Controls */}
            <div className="w-[400px] border-r bg-card h-full overflow-y-auto p-6 flex flex-col gap-8 shadow-xl z-10">
                <div>
                    <h2 className="text-2xl font-bold">Design Studio</h2>
                    <p className="text-muted-foreground">Live style customization</p>
                </div>

                <div className="space-y-6">
                    {/* Grid Settings */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Grid Layout</h3>
                        <div className="grid gap-2">
                            <Label>Columns (Desktop)</Label>
                            <div className="flex gap-2">
                                {[2, 3, 4].map(n => (
                                    <Button
                                        key={n}
                                        variant={settings.gridColumns === n ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setSettings({ ...settings, gridColumns: n })}
                                    >
                                        {n}
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>Spacing</Label>
                            <div className="flex gap-2">
                                {(['tight', 'normal', 'loose'] as const).map(g => (
                                    <Button
                                        key={g}
                                        variant={settings.gap === g ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setSettings({ ...settings, gap: g })}
                                        className="capitalize"
                                    >
                                        {g}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Card Settings */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Product Card</h3>
                        <div className="grid gap-2">
                            <Label>Aspect Ratio</Label>
                            <div className="flex gap-2">
                                {(['square', 'portrait', 'landscape'] as const).map(r => (
                                    <Button
                                        key={r}
                                        variant={settings.cardRatio === r ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setSettings({ ...settings, cardRatio: r })}
                                        className="capitalize"
                                    >
                                        {r}
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>Typography</Label>
                            <div className="flex gap-2">
                                {(['sm', 'md', 'lg'] as const).map(s => (
                                    <Button
                                        key={s}
                                        variant={settings.titleSize === s ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setSettings({ ...settings, titleSize: s })}
                                        className="capitalize"
                                    >
                                        {s}
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>Badges</Label>
                            <div className="flex gap-2">
                                {(['minimal', 'solid'] as const).map(b => (
                                    <Button
                                        key={b}
                                        variant={settings.badgeStyle === b ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setSettings({ ...settings, badgeStyle: b })}
                                        className="capitalize"
                                    >
                                        {b}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-auto pt-6 border-t flex gap-2">
                    <Button className="flex-1" onClick={handleSave}>
                        <Save className="mr-2 h-4 w-4" /> Save Changes
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleReset}>
                        <RotateCcw className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* RIGHT: Live Preview Canvas */}
            <div className="flex-1 bg-secondary/50 flex flex-col h-full overflow-hidden">
                {/* Preview Toolbar */}
                <div className="h-12 border-b bg-card flex items-center justify-between px-4">
                    <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Live Preview</span>
                    </div>
                    <div className="flex items-center bg-secondary rounded-md p-1">
                        <Button
                            variant={viewport === 'desktop' ? "default" : "ghost"}
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setViewport('desktop')}
                        >
                            <Monitor className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={viewport === 'tablet' ? "default" : "ghost"}
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setViewport('tablet')}
                        >
                            <Tablet className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={viewport === 'mobile' ? "default" : "ghost"}
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setViewport('mobile')}
                        >
                            <Smartphone className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Canvas Area */}
                <div className="flex-1 overflow-auto p-8 flex justify-center">
                    <div className={cn("bg-background shadow-2xl transition-all duration-500 ease-in-out border min-h-[800px]", viewportWidth)}>
                        {/* Mock Store Header */}
                        <div className="h-16 border-b flex items-center px-8 justify-between">
                            <span className="font-bold tracking-widest text-lg">KILIM</span>
                            <div className="text-sm space-x-6 text-muted-foreground hidden md:block">
                                <span>New Arrivals</span>
                                <span>Vintage</span>
                                <span>Contemporary</span>
                            </div>
                        </div>

                        {/* Mock Content */}
                        <div className="p-8 md:p-12">
                            <div className="mb-12 text-center max-w-2xl mx-auto space-y-4">
                                <h1 className="text-3xl md:text-4xl font-light">Vintage Collection</h1>
                                <p className="text-muted-foreground">Hand-knotted masterpieces from Anatolia.</p>
                            </div>

                            <div className={cn("grid transition-all duration-300", gridClass, gapClass)}>
                                {PREVIEW_PRODUCTS.map(p => {
                                    const { id, ...productProps } = p
                                    return <PreviewProductCard key={id} product={productProps} settings={settings} />
                                })}
                                {PREVIEW_PRODUCTS.map(p => {
                                    const { id, ...productProps } = p
                                    return <PreviewProductCard key={id + '_copy'} product={productProps} settings={settings} />
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
