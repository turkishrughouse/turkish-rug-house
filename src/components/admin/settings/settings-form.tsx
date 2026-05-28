"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import type { SiteSettings } from "@/lib/site-settings"
import type { CurrencyRateDiagnostics } from "@/lib/storefront/currency-rate-policy"

interface SettingsFormProps {
    initialSettings: SiteSettings
    initialAdminLocale: string
    currencyDiagnostics: CurrencyRateDiagnostics
}

export function SettingsForm({ initialSettings, initialAdminLocale, currencyDiagnostics }: SettingsFormProps) {
    const router = useRouter()
    const [settings, setSettings] = useState<SiteSettings>(initialSettings)
    const [saving, setSaving] = useState(false)

    const cardSurface = "bg-white border border-[#dce3ed] shadow-[0_8px_24px_rgba(15,23,42,0.05)]"
    const inputSurface = "bg-white border-[#dce3ed] text-slate-900 placeholder:text-slate-400"

    const patch = (key: keyof SiteSettings, value: unknown) => {
        setSettings((prev) => ({ ...prev, [key]: value }))
    }

    const handleSave = async (partial?: Partial<SiteSettings>) => {
        setSaving(true)
        try {
            const body = partial ?? settings
            const res = await fetch("/api/admin/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                toast.error(data.error || "Failed to save settings")
                return
            }
            toast.success("Settings saved")
            router.refresh()
        } catch {
            toast.error("Failed to save settings")
        } finally {
            setSaving(false)
        }
    }

    const SaveButton = ({ label = "Save" }: { label?: string }) => (
        <Button onClick={() => handleSave()} disabled={saving} size="sm">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {label}
        </Button>
    )

    return (
        <Tabs defaultValue="general" className="space-y-6">
            <TabsList className="flex flex-wrap gap-1 h-auto">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="contact">Contact</TabsTrigger>
                <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
                <TabsTrigger value="shop">Shop</TabsTrigger>
                <TabsTrigger value="payment">Payment</TabsTrigger>
                <TabsTrigger value="mail">Mail</TabsTrigger>
                <TabsTrigger value="currency">Currency</TabsTrigger>
            </TabsList>

            {/* General */}
            <TabsContent value="general">
                <Card className={cardSurface}>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-slate-900">General Settings</CardTitle>
                        <SaveButton />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Site Name</Label>
                                <Input
                                    className={inputSurface}
                                    value={settings.siteName}
                                    onChange={(e) => patch("siteName", e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Site Tagline</Label>
                                <Input
                                    className={inputSurface}
                                    value={settings.siteTagline}
                                    onChange={(e) => patch("siteTagline", e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Default Meta Title</Label>
                            <Input
                                className={inputSurface}
                                value={settings.defaultMetaTitle}
                                onChange={(e) => patch("defaultMetaTitle", e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Default Meta Description</Label>
                            <Textarea
                                className="h-24 bg-white border-[#dce3ed] text-slate-900 placeholder:text-slate-400"
                                value={settings.defaultMetaDescription}
                                onChange={(e) => patch("defaultMetaDescription", e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Brand Primary Color</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="color"
                                        className="w-12 h-10 p-1 border-[#dce3ed] cursor-pointer"
                                        value={settings.brandPrimary}
                                        onChange={(e) => patch("brandPrimary", e.target.value)}
                                    />
                                    <Input
                                        className={inputSurface}
                                        value={settings.brandPrimary}
                                        onChange={(e) => patch("brandPrimary", e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Brand Secondary Color</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="color"
                                        className="w-12 h-10 p-1 border-[#dce3ed] cursor-pointer"
                                        value={settings.brandSecondary}
                                        onChange={(e) => patch("brandSecondary", e.target.value)}
                                    />
                                    <Input
                                        className={inputSurface}
                                        value={settings.brandSecondary}
                                        onChange={(e) => patch("brandSecondary", e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Default Language</Label>
                                <Input
                                    className={inputSurface}
                                    value={settings.defaultLanguage}
                                    onChange={(e) => patch("defaultLanguage", e.target.value)}
                                    placeholder="en_US"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Default Currency</Label>
                                <Input
                                    className={inputSurface}
                                    value={settings.defaultCurrency}
                                    onChange={(e) => patch("defaultCurrency", e.target.value)}
                                    placeholder="USD"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

            {/* Contact */}
            <TabsContent value="contact">
                <Card className={cardSurface}>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-slate-900">Contact & Support</CardTitle>
                        <SaveButton />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Support Email</Label>
                                <Input
                                    className={inputSurface}
                                    type="email"
                                    value={settings.supportEmail}
                                    onChange={(e) => patch("supportEmail", e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Support Phone</Label>
                                <Input
                                    className={inputSurface}
                                    value={settings.supportPhone}
                                    onChange={(e) => patch("supportPhone", e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Contact Hero Title</Label>
                            <Input
                                className={inputSurface}
                                value={settings.contactHeroTitle}
                                onChange={(e) => patch("contactHeroTitle", e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Contact Hero Description</Label>
                            <Textarea
                                className="h-20 bg-white border-[#dce3ed] text-slate-900 placeholder:text-slate-400"
                                value={settings.contactHeroDescription}
                                onChange={(e) => patch("contactHeroDescription", e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Store Address Line 1</Label>
                                <Input
                                    className={inputSurface}
                                    value={settings.storeAddressLine1}
                                    onChange={(e) => patch("storeAddressLine1", e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Store Address Line 2</Label>
                                <Input
                                    className={inputSurface}
                                    value={settings.storeAddressLine2}
                                    onChange={(e) => patch("storeAddressLine2", e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>City</Label>
                                <Input
                                    className={inputSurface}
                                    value={settings.storeCity}
                                    onChange={(e) => patch("storeCity", e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Postcode</Label>
                                <Input
                                    className={inputSurface}
                                    value={settings.storePostcode}
                                    onChange={(e) => patch("storePostcode", e.target.value)}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

            {/* Maintenance */}
            <TabsContent value="maintenance">
                <Card className={cardSurface}>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-slate-900">Maintenance Mode</CardTitle>
                        <SaveButton />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-3">
                            <Switch
                                checked={settings.maintenanceMode}
                                onCheckedChange={(v) => patch("maintenanceMode", v)}
                            />
                            <Label>Enable Maintenance Mode</Label>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Maintenance Title</Label>
                            <Input
                                className={inputSurface}
                                value={settings.maintenanceTitle}
                                onChange={(e) => patch("maintenanceTitle", e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Maintenance Message</Label>
                            <Textarea
                                className="h-24 bg-white border-[#dce3ed] text-slate-900 placeholder:text-slate-400"
                                value={settings.maintenanceMessage}
                                onChange={(e) => patch("maintenanceMessage", e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Maintenance Image URL</Label>
                            <Input
                                className={inputSurface}
                                value={settings.maintenanceImageUrl}
                                onChange={(e) => patch("maintenanceImageUrl", e.target.value)}
                            />
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

            {/* Shop */}
            <TabsContent value="shop">
                <Card className={cardSurface}>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-slate-900">Shop Settings</CardTitle>
                        <SaveButton />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Flat Shipping Rate</Label>
                                <Input
                                    className={inputSurface}
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    value={settings.flatShippingRate}
                                    onChange={(e) => patch("flatShippingRate", parseFloat(e.target.value) || 0)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Local Pickup Rate</Label>
                                <Input
                                    className={inputSurface}
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    value={settings.localPickupRate}
                                    onChange={(e) => patch("localPickupRate", parseFloat(e.target.value) || 0)}
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-3">
                                <Switch
                                    checked={settings.checkoutEnabled}
                                    onCheckedChange={(v) => patch("checkoutEnabled", v)}
                                />
                                <Label>Enable Checkout</Label>
                            </div>
                            <div className="flex items-center gap-3">
                                <Switch
                                    checked={settings.enableGuestCheckout}
                                    onCheckedChange={(v) => patch("enableGuestCheckout", v)}
                                />
                                <Label>Enable Guest Checkout</Label>
                            </div>
                            <div className="flex items-center gap-3">
                                <Switch
                                    checked={settings.enableCoupons}
                                    onCheckedChange={(v) => patch("enableCoupons", v)}
                                />
                                <Label>Enable Coupons</Label>
                            </div>
                            <div className="flex items-center gap-3">
                                <Switch
                                    checked={settings.enableTaxes}
                                    onCheckedChange={(v) => patch("enableTaxes", v)}
                                />
                                <Label>Enable Taxes</Label>
                            </div>
                            <div className="flex items-center gap-3">
                                <Switch
                                    checked={settings.hideOutOfStockOnShop}
                                    onCheckedChange={(v) => patch("hideOutOfStockOnShop", v)}
                                />
                                <Label>Hide Out of Stock on Shop</Label>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

            {/* Payment */}
            <TabsContent value="payment">
                <div className="space-y-6">
                    <Card className={cardSurface}>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-slate-900">Stripe</CardTitle>
                            </div>
                            <div className="flex items-center gap-3">
                                <Switch
                                    checked={settings.stripeEnabled}
                                    onCheckedChange={(v) => patch("stripeEnabled", v)}
                                />
                                <SaveButton />
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1.5">
                                <Label>Publishable Key</Label>
                                <Input
                                    className={inputSurface}
                                    value={settings.stripePublishableKey}
                                    onChange={(e) => patch("stripePublishableKey", e.target.value)}
                                    placeholder="pk_..."
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Secret Key</Label>
                                <Input
                                    className={inputSurface}
                                    type="password"
                                    value={settings.stripeSecretKey}
                                    onChange={(e) => patch("stripeSecretKey", e.target.value)}
                                    placeholder="sk_..."
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Webhook Secret</Label>
                                <Input
                                    className={inputSurface}
                                    type="password"
                                    value={settings.stripeWebhookSecret}
                                    onChange={(e) => patch("stripeWebhookSecret", e.target.value)}
                                    placeholder="whsec_..."
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className={cardSurface}>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-slate-900">PayPal</CardTitle>
                            </div>
                            <div className="flex items-center gap-3">
                                <Switch
                                    checked={settings.paypalEnabled}
                                    onCheckedChange={(v) => patch("paypalEnabled", v)}
                                />
                                <SaveButton />
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1.5">
                                <Label>Client ID</Label>
                                <Input
                                    className={inputSurface}
                                    value={settings.paypalClientId}
                                    onChange={(e) => patch("paypalClientId", e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Client Secret</Label>
                                <Input
                                    className={inputSurface}
                                    type="password"
                                    value={settings.paypalClientSecret}
                                    onChange={(e) => patch("paypalClientSecret", e.target.value)}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>

            {/* Mail */}
            <TabsContent value="mail">
                <Card className={cardSurface}>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-slate-900">Outgoing Mail (SMTP)</CardTitle>
                        <SaveButton />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>SMTP Host</Label>
                                <Input
                                    className={inputSurface}
                                    value={settings.outgoingMailHost}
                                    onChange={(e) => patch("outgoingMailHost", e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>SMTP Port</Label>
                                <Input
                                    className={inputSurface}
                                    type="number"
                                    value={settings.outgoingMailPort}
                                    onChange={(e) => patch("outgoingMailPort", parseInt(e.target.value) || 587)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Username</Label>
                                <Input
                                    className={inputSurface}
                                    value={settings.outgoingMailUser}
                                    onChange={(e) => patch("outgoingMailUser", e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Password</Label>
                                <Input
                                    className={inputSurface}
                                    type="password"
                                    value={settings.outgoingMailPassword}
                                    onChange={(e) => patch("outgoingMailPassword", e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>From Name</Label>
                                <Input
                                    className={inputSurface}
                                    value={settings.outgoingMailFromName}
                                    onChange={(e) => patch("outgoingMailFromName", e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>From Email</Label>
                                <Input
                                    className={inputSurface}
                                    type="email"
                                    value={settings.outgoingMailFromEmail}
                                    onChange={(e) => patch("outgoingMailFromEmail", e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Switch
                                checked={settings.outgoingMailSecure}
                                onCheckedChange={(v) => patch("outgoingMailSecure", v)}
                            />
                            <Label>Use SSL/TLS</Label>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

            {/* Currency */}
            <TabsContent value="currency">
                <Card className={cardSurface}>
                    <CardHeader>
                        <CardTitle className="text-slate-900">Currency Rate Diagnostics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="rounded-lg border border-[#dce3ed] bg-slate-50 p-4 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-600">USD → EUR Rate</span>
                                <span className="font-mono font-medium text-slate-900">{currencyDiagnostics.usdToEurRate}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600">Source</span>
                                <span className="font-medium text-slate-900 capitalize">{currencyDiagnostics.rateSource}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600">Provider</span>
                                <span className="font-medium text-slate-900">{currencyDiagnostics.rateProvider}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600">Freshness</span>
                                <span className={`font-medium ${
                                    currencyDiagnostics.freshness === "fresh"
                                        ? "text-green-700"
                                        : currencyDiagnostics.freshness === "stale"
                                            ? "text-amber-700"
                                            : "text-red-700"
                                }`}>
                                    {currencyDiagnostics.freshness}
                                </span>
                            </div>
                            {currencyDiagnostics.rateFetchedAt && (
                                <div className="flex justify-between">
                                    <span className="text-slate-600">Fetched At</span>
                                    <span className="text-slate-900">
                                        {new Date(currencyDiagnostics.rateFetchedAt).toLocaleString()}
                                    </span>
                                </div>
                            )}
                            {currencyDiagnostics.cacheAgeMs !== null && (
                                <div className="flex justify-between">
                                    <span className="text-slate-600">Cache Age</span>
                                    <span className="text-slate-900">
                                        {Math.round(currencyDiagnostics.cacheAgeMs / 1000 / 60)} min
                                    </span>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className={`${cardSurface} mt-6`}>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-slate-900">Display</CardTitle>
                        <SaveButton />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Thousand Separator</Label>
                                <Input
                                    className={inputSurface}
                                    value={settings.thousandSeparator}
                                    maxLength={1}
                                    onChange={(e) => patch("thousandSeparator", e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Decimal Separator</Label>
                                <Input
                                    className={inputSurface}
                                    value={settings.decimalSeparator}
                                    maxLength={1}
                                    onChange={(e) => patch("decimalSeparator", e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Decimal Places</Label>
                                <Input
                                    className={inputSurface}
                                    type="number"
                                    min={0}
                                    max={4}
                                    value={settings.numberOfDecimals}
                                    onChange={(e) => patch("numberOfDecimals", parseInt(e.target.value) || 2)}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    )
}
