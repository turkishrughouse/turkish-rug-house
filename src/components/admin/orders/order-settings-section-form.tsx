"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import type { SiteSettings } from "@/lib/site-settings"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const REGION_PRESETS: Record<string, string[]> = {
  TR: ["Istanbul", "Ankara", "Izmir", "Bursa", "Antalya"],
  US: ["New York", "California", "Texas", "Florida", "Illinois"],
  DE: ["Berlin", "Bavaria", "Hamburg", "Hesse", "Saxony"],
  GB: ["England", "Scotland", "Wales", "Northern Ireland"],
  FR: ["Ile-de-France", "Auvergne-Rhone-Alpes", "Provence-Alpes-Cote d'Azur"],
  IT: ["Lazio", "Lombardy", "Sicily", "Tuscany"],
  ES: ["Madrid", "Catalonia", "Andalusia", "Valencia"],
  CA: ["Ontario", "Quebec", "British Columbia", "Alberta"],
  AU: ["New South Wales", "Victoria", "Queensland", "Western Australia"],
}

const CITY_PRESETS: Record<string, string[]> = {
  TR: ["Istanbul", "Ankara", "Izmir", "Bursa", "Antalya", "Konya", "Adana", "Gaziantep"],
  US: ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio"],
  DE: ["Berlin", "Hamburg", "Munich", "Cologne", "Frankfurt", "Stuttgart"],
  GB: ["London", "Birmingham", "Manchester", "Liverpool", "Leeds", "Glasgow"],
  FR: ["Paris", "Lyon", "Marseille", "Toulouse", "Nice", "Bordeaux"],
  IT: ["Rome", "Milan", "Naples", "Turin", "Florence", "Bologna"],
  ES: ["Madrid", "Barcelona", "Valencia", "Seville", "Malaga", "Bilbao"],
  CA: ["Toronto", "Montreal", "Vancouver", "Calgary", "Ottawa", "Edmonton"],
  AU: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Canberra"],
}

type CountryOption = { code: string; label: string; regions: string[] }

function buildAllCountryOptions(): CountryOption[] {
  try {
    const display = new Intl.DisplayNames(["en"], { type: "region" })
    const excluded = new Set(["EU", "UN", "XA", "XB", "ZZ"])
    const byLabel = new Map<string, CountryOption>()

    for (let i = 65; i <= 90; i += 1) {
      for (let j = 65; j <= 90; j += 1) {
        const code = String.fromCharCode(i) + String.fromCharCode(j)
        if (excluded.has(code)) continue
        const label = display.of(code)
        if (!label || label === code) continue
        const current = byLabel.get(label)
        const next: CountryOption = { code, label, regions: REGION_PRESETS[code] || [] }
        if (!current || REGION_PRESETS[code]) {
          byLabel.set(label, next)
        }
      }
    }

    const list = Array.from(byLabel.values()).sort((a, b) => a.label.localeCompare(b.label))
    if (list.length > 0) return list
  } catch {
    // fallback below
  }

  return Object.entries(REGION_PRESETS)
    .map(([code, regions]) => ({ code, label: code, regions }))
    .sort((a, b) => a.code.localeCompare(b.code))
}

const COUNTRY_REGION_OPTIONS = buildAllCountryOptions()

function parseCountryState(raw: string) {
  const [countryPart, ...regionParts] = (raw || "").split("-")
  const regionRaw = regionParts.join("-").trim()
  const fallback = COUNTRY_REGION_OPTIONS[0]
  const country = COUNTRY_REGION_OPTIONS.find((item) => item.code === countryPart) || fallback
  const region = country.regions.length === 0 ? regionRaw : (country.regions.includes(regionRaw) ? regionRaw : country.regions[0])
  return { country, region }
}

function buildCountryStateValue(countryCode: string, region: string) {
  const safeRegion = region.trim()
  return safeRegion.length > 0 ? `${countryCode}-${safeRegion}` : countryCode
}

type SectionKey =
  | "general"
  | "shipping"
  | "payments"
  | "accounts-privacy"
  | "emails"
  | "advanced"

export function OrderSettingsSectionForm({
  section,
  label,
}: {
  section: SectionKey
  label: string
}) {
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [pendingSellingCountry, setPendingSellingCountry] = useState("TR")
  const [activePaymentTab, setActivePaymentTab] = useState<"gpay" | "applepay" | "paypal" | "stripe">("gpay")

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/admin/settings", { cache: "no-store" })
        if (!res.ok) throw new Error("Failed to load settings")
        const json = (await res.json()) as SiteSettings
        setSettings(json)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load settings")
      }
    }
    void load()
  }, [])

  useEffect(() => {
    if (!settings) return
    if (settings.paymentDefaultProvider === "paypal") {
      setActivePaymentTab("paypal")
      return
    }
    if (settings.paymentDefaultProvider === "applepay") {
      setActivePaymentTab("applepay")
      return
    }
    if (settings.paymentDefaultProvider === "gpay") {
      setActivePaymentTab("gpay")
      return
    }
    setActivePaymentTab("stripe")
  }, [settings])

  const save = async (patch: Partial<SiteSettings>) => {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      const json = (await res.json().catch(() => null)) as SiteSettings | { error?: string } | null
      if (!res.ok) throw new Error((json as { error?: string } | null)?.error || "Failed to save settings")
      setSettings(json as SiteSettings)
      toast.success(`${label} settings saved`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    "h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"

  const renderContent = () => {
    if (!settings) return null
    const update = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) =>
      setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))

    if (section === "general") {
      const { country: selectedCountry, region: selectedRegion } = parseCountryState(settings.storeCountryState)
      const cityOptions = CITY_PRESETS[selectedCountry.code] || []
      const selectedSellingCountries = settings.sellingCountries
      const selectedSellingCountrySet = new Set(selectedSellingCountries)
      return (
        <div className="space-y-10">
          <section>
            <h3 className="text-2xl font-semibold text-slate-900">Store Address</h3>
            <p className="mt-2 text-sm text-slate-600">
              This is where your business is located. Tax rates and shipping rates use this address.
            </p>
            <div className="mt-6 space-y-4">
              <FieldRow label="Address line 1">
                <input className={inputClass} value={settings.storeAddressLine1} onChange={(e) => update("storeAddressLine1", e.target.value)} />
              </FieldRow>
              <FieldRow label="Address line 2">
                <input className={inputClass} value={settings.storeAddressLine2} onChange={(e) => update("storeAddressLine2", e.target.value)} />
              </FieldRow>
              <FieldRow label="City">
                {cityOptions.length > 0 ? (
                  <select
                    className={inputClass}
                    value={cityOptions.includes(settings.storeCity) ? settings.storeCity : ""}
                    onChange={(e) => update("storeCity", e.target.value)}
                  >
                    <option value="">Select city</option>
                    {cityOptions.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={inputClass}
                    value={settings.storeCity}
                    onChange={(e) => update("storeCity", e.target.value)}
                    placeholder="City"
                  />
                )}
              </FieldRow>
              <FieldRow label="Country / State">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <select
                    className={inputClass}
                    value={selectedCountry.code}
                    onChange={(e) => {
                      const nextCountry =
                        COUNTRY_REGION_OPTIONS.find((item) => item.code === e.target.value) || COUNTRY_REGION_OPTIONS[0]
                      const nextRegion = nextCountry.regions[0] || ""
                      update("storeCountryState", buildCountryStateValue(nextCountry.code, nextRegion))
                      const nextCities = CITY_PRESETS[nextCountry.code] || []
                      if (nextCities.length > 0) {
                        update("storeCity", nextCities[0])
                      } else {
                        update("storeCity", "")
                      }
                    }}
                  >
                    {COUNTRY_REGION_OPTIONS.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  {selectedCountry.regions.length > 0 ? (
                    <select
                      className={inputClass}
                      value={selectedRegion}
                      onChange={(e) => update("storeCountryState", buildCountryStateValue(selectedCountry.code, e.target.value))}
                    >
                      {selectedCountry.regions.map((region) => (
                        <option key={region} value={region}>
                          {region}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className={inputClass}
                      value={selectedRegion}
                      onChange={(e) => update("storeCountryState", buildCountryStateValue(selectedCountry.code, e.target.value))}
                      placeholder="State / Province / Region"
                    />
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  You can type any state/province manually for all countries.
                </p>
              </FieldRow>
              <FieldRow label="Postcode / ZIP">
                <input className={inputClass} value={settings.storePostcode} onChange={(e) => update("storePostcode", e.target.value)} />
              </FieldRow>
            </div>
          </section>

          <section>
            <h3 className="text-2xl font-semibold text-slate-900">General options</h3>
            <div className="mt-6 space-y-4">
              <FieldRow label="Selling location(s)">
                <select
                  className={inputClass}
                  value={settings.sellingLocationMode}
                  onChange={(e) => update("sellingLocationMode", e.target.value as SiteSettings["sellingLocationMode"])}
                >
                  <option value="all">Sell to all countries</option>
                  <option value="specific">Sell to specific countries</option>
                </select>
              </FieldRow>
              {settings.sellingLocationMode === "specific" ? (
                <FieldRow label="Specific country list">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        className={`${inputClass} min-w-[260px] max-w-[420px]`}
                        value={pendingSellingCountry}
                        onChange={(e) => setPendingSellingCountry(e.target.value)}
                      >
                        {COUNTRY_REGION_OPTIONS.map((country) => (
                          <option key={country.code} value={country.code}>
                            {country.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="h-11 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        onClick={() => {
                          if (selectedSellingCountrySet.has(pendingSellingCountry)) return
                          update("sellingCountries", [...selectedSellingCountries, pendingSellingCountry])
                        }}
                      >
                        Add country
                      </button>
                    </div>
                    {selectedSellingCountries.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedSellingCountries.map((code) => {
                          const match = COUNTRY_REGION_OPTIONS.find((item) => item.code === code)
                          return (
                            <span
                              key={code}
                              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-700"
                            >
                              {match?.label || code}
                              <button
                                type="button"
                                className="text-slate-500 hover:text-red-600"
                                onClick={() => update("sellingCountries", selectedSellingCountries.filter((item) => item !== code))}
                                aria-label={`Remove ${match?.label || code}`}
                              >
                                ×
                              </button>
                            </span>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">No country selected yet.</p>
                    )}
                  </div>
                </FieldRow>
              ) : null}
              <FieldRow label="Shipping location(s)">
                <select
                  className={inputClass}
                  value={settings.shippingLocationMode}
                  onChange={(e) => update("shippingLocationMode", e.target.value as SiteSettings["shippingLocationMode"])}
                >
                  <option value="all-sell">Ship to all countries you sell to</option>
                  <option value="specific">Ship to specific countries only</option>
                </select>
              </FieldRow>
              <FieldRow label="Default customer location">
                <select
                  className={inputClass}
                  value={settings.defaultCustomerLocation}
                  onChange={(e) => update("defaultCustomerLocation", e.target.value as SiteSettings["defaultCustomerLocation"])}
                >
                  <option value="shop-country">Shop country/region</option>
                  <option value="no-location">No location by default</option>
                  <option value="geolocate">Geolocate</option>
                </select>
              </FieldRow>
            </div>
          </section>

          <section>
            <h3 className="text-2xl font-semibold text-slate-900">Address autocomplete</h3>
            <FieldRow label="">
              <label className="inline-flex items-center gap-3 text-sm text-slate-800">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={settings.enableAddressAutocomplete}
                  onChange={(e) => update("enableAddressAutocomplete", e.target.checked)}
                />
                Enable predictive address search
              </label>
            </FieldRow>
          </section>

          <section>
            <h3 className="text-2xl font-semibold text-slate-900">Taxes and coupons</h3>
            <div className="mt-6 space-y-6">
              <FieldRow label="Enable taxes">
                <label className="inline-flex items-center gap-3 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300"
                    checked={settings.enableTaxes}
                    onChange={(e) => update("enableTaxes", e.target.checked)}
                  />
                  Enable tax rates and calculations
                </label>
              </FieldRow>
              <FieldRow label="Enable coupons">
                <div className="space-y-3">
                  <label className="inline-flex items-center gap-3 text-sm text-slate-800">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                      checked={settings.enableCoupons}
                      onChange={(e) => update("enableCoupons", e.target.checked)}
                    />
                    Enable the use of coupon codes
                  </label>
                  <label className="inline-flex items-center gap-3 text-sm text-slate-800">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                      checked={settings.sequentialCoupons}
                      onChange={(e) => update("sequentialCoupons", e.target.checked)}
                    />
                    Calculate coupon discounts sequentially
                  </label>
                </div>
              </FieldRow>
            </div>
          </section>

          <section>
            <h3 className="text-2xl font-semibold text-slate-900">Currency options</h3>
            <div className="mt-6 space-y-4">
              <FieldRow label="Currency">
                <select className={inputClass} value={settings.defaultCurrency} onChange={(e) => update("defaultCurrency", e.target.value)}>
                  <option value="TRY">Turkish lira (₺) — TRY</option>
                  <option value="USD">United States (US$) — USD</option>
                  <option value="EUR">Euro (€) — EUR</option>
                  <option value="GBP">Pound sterling (£) — GBP</option>
                </select>
              </FieldRow>
              <FieldRow label="Currency position">
                <select
                  className={inputClass}
                  value={settings.currencyPosition}
                  onChange={(e) => update("currencyPosition", e.target.value as SiteSettings["currencyPosition"])}
                >
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                  <option value="left-space">Left with space</option>
                  <option value="right-space">Right with space</option>
                </select>
              </FieldRow>
              <FieldRow label="Thousand separator">
                <input className={`${inputClass} max-w-[120px]`} value={settings.thousandSeparator} onChange={(e) => update("thousandSeparator", e.target.value.slice(0, 1))} />
              </FieldRow>
              <FieldRow label="Decimal separator">
                <input className={`${inputClass} max-w-[120px]`} value={settings.decimalSeparator} onChange={(e) => update("decimalSeparator", e.target.value.slice(0, 1))} />
              </FieldRow>
              <FieldRow label="Number of decimals">
                <input
                  className={`${inputClass} max-w-[120px]`}
                  value={settings.numberOfDecimals}
                  onChange={(e) => update("numberOfDecimals", Math.max(0, Math.min(4, Number(e.target.value || 0))))}
                  type="number"
                  min={0}
                  max={4}
                />
              </FieldRow>
            </div>
          </section>

          <button
            type="button"
            onClick={() =>
              save({
                storeAddressLine1: settings.storeAddressLine1,
                storeAddressLine2: settings.storeAddressLine2,
                storeCity: settings.storeCity,
                storeCountryState: settings.storeCountryState,
                storePostcode: settings.storePostcode,
                sellingLocationMode: settings.sellingLocationMode,
                sellingCountries: settings.sellingCountries,
                shippingLocationMode: settings.shippingLocationMode,
                defaultCustomerLocation: settings.defaultCustomerLocation,
                enableAddressAutocomplete: settings.enableAddressAutocomplete,
                enableTaxes: settings.enableTaxes,
                enableCoupons: settings.enableCoupons,
                sequentialCoupons: settings.sequentialCoupons,
                defaultCurrency: settings.defaultCurrency,
                currencyPosition: settings.currencyPosition,
                thousandSeparator: settings.thousandSeparator,
                decimalSeparator: settings.decimalSeparator,
                numberOfDecimals: settings.numberOfDecimals,
              })
            }
            disabled={saving}
            className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      )
    }

    if (section === "accounts-privacy") {
      return (
        <section className="space-y-8">
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-[240px_1fr] lg:gap-6">
            <h4 className="text-sm font-semibold text-slate-900">Checkout</h4>
            <div className="space-y-5">
              <label className="block text-sm text-slate-800">
                <span className="inline-flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300"
                    checked={settings.enableGuestCheckout}
                    onChange={(e) => update("enableGuestCheckout", e.target.checked)}
                  />
                  Enable guest checkout
                </span>
                <span className="mt-2 block text-sm text-slate-500">
                  Allows customers to checkout without an account.
                </span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 lg:grid-cols-[240px_1fr] lg:gap-6">
            <h4 className="text-sm font-semibold text-slate-900">Account creation</h4>
            <div className="space-y-4">
              <p className="text-sm font-semibold text-slate-900">Allow customers to create an account</p>
              <label className="block text-sm text-slate-800">
                <span className="inline-flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300"
                    checked={settings.accountCreationDuringCheckout}
                    onChange={(e) => update("accountCreationDuringCheckout", e.target.checked)}
                  />
                  During checkout
                </span>
                <span className="mt-2 block text-sm text-slate-500">
                  Customers can create an account before placing their order.
                </span>
              </label>
              <label className="inline-flex items-center gap-3 text-sm text-slate-800">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={settings.accountCreationOnMyAccountPage}
                  onChange={(e) => update("accountCreationOnMyAccountPage", e.target.checked)}
                />
                On &quot;My account&quot; page
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 lg:grid-cols-[240px_1fr] lg:gap-6">
            <h4 className="text-sm font-semibold text-slate-900">Account creation options</h4>
            <div className="space-y-3">
              <label className="block text-sm text-slate-800">
                <span className="inline-flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300"
                    checked={settings.sendPasswordSetupLink}
                    onChange={(e) => update("sendPasswordSetupLink", e.target.checked)}
                  />
                  Send password setup link (recommended)
                </span>
                <span className="mt-2 block text-sm text-slate-500">
                  New users receive an email to set up their password.
                </span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 lg:grid-cols-[240px_1fr] lg:gap-6">
            <h4 className="text-sm font-semibold text-slate-900">Account erasure requests</h4>
            <div className="space-y-5">
              <label className="block text-sm text-slate-800">
                <span className="inline-flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300"
                    checked={settings.removePersonalDataOnErasureRequest}
                    onChange={(e) => update("removePersonalDataOnErasureRequest", e.target.checked)}
                  />
                  Remove personal data from orders on request
                </span>
                <span className="mt-2 block text-sm text-slate-500">
                  When handling an account erasure request, should personal data within orders be retained or removed?
                </span>
              </label>

              <label className="block text-sm text-slate-800">
                <span className="inline-flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300"
                    checked={settings.removeDownloadsOnErasureRequest}
                    onChange={(e) => update("removeDownloadsOnErasureRequest", e.target.checked)}
                  />
                  Remove access to downloads on request
                </span>
                <span className="mt-2 block text-sm text-slate-500">
                  When handling an account erasure request, should access to downloadable files be revoked and download logs cleared?
                </span>
              </label>

              <label className="block text-sm text-slate-800">
                <span className="inline-flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300"
                    checked={settings.allowBulkPersonalDataRemoval}
                    onChange={(e) => update("allowBulkPersonalDataRemoval", e.target.checked)}
                  />
                  Allow personal data to be removed in bulk from orders
                </span>
                <span className="mt-2 block text-sm text-slate-500">
                  Adds an option to the orders screen for removing personal data in bulk. Note that removing personal data cannot be undone.
                </span>
              </label>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              save({
                enableGuestCheckout: settings.enableGuestCheckout,
                accountCreationDuringCheckout: settings.accountCreationDuringCheckout,
                accountCreationOnMyAccountPage: settings.accountCreationOnMyAccountPage,
                sendPasswordSetupLink: settings.sendPasswordSetupLink,
                removePersonalDataOnErasureRequest: settings.removePersonalDataOnErasureRequest,
                removeDownloadsOnErasureRequest: settings.removeDownloadsOnErasureRequest,
                allowBulkPersonalDataRemoval: settings.allowBulkPersonalDataRemoval,
              })
            }
            disabled={saving}
            className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </section>
      )
    }

    if (section === "shipping") {
      return (
        <section className="space-y-5">
          <h3 className="text-2xl font-semibold text-slate-900">Shipping options</h3>
          <label className="inline-flex items-center gap-3 text-sm text-slate-800">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={settings.autoCarrierRates}
              onChange={(e) => update("autoCarrierRates", e.target.checked)}
            />
            Enable live carrier rates (DHL / UPS / FedEx)
          </label>
          <FieldRow label="Shipping location(s)">
            <select
              className={inputClass}
              value={settings.shippingLocationMode}
              onChange={(e) => update("shippingLocationMode", e.target.value as SiteSettings["shippingLocationMode"])}
            >
              <option value="all-sell">Ship to all countries you sell to</option>
              <option value="specific">Ship to specific countries only</option>
            </select>
          </FieldRow>
          <FieldRow label="Flat rate">
            <input
              type="number"
              min={0}
              className={inputClass}
              value={settings.flatShippingRate}
              onChange={(e) => update("flatShippingRate", Math.max(0, Number(e.target.value || 0)))}
            />
          </FieldRow>
          <FieldRow label="Local pickup rate">
            <input
              type="number"
              min={0}
              className={inputClass}
              value={settings.localPickupRate}
              onChange={(e) => update("localPickupRate", Math.max(0, Number(e.target.value || 0)))}
            />
          </FieldRow>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-3 rounded-lg border border-slate-200 p-4">
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={settings.dhlEnabled} onChange={(e) => update("dhlEnabled", e.target.checked)} />
                DHL API
              </label>
              <input className={inputClass} placeholder="API key" value={settings.dhlApiKey} onChange={(e) => update("dhlApiKey", e.target.value)} />
              <input className={inputClass} placeholder="API secret" type="password" value={settings.dhlApiSecret} onChange={(e) => update("dhlApiSecret", e.target.value)} />
              <input className={inputClass} placeholder="Account number" value={settings.dhlAccountNumber} onChange={(e) => update("dhlAccountNumber", e.target.value)} />
              <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={settings.dhlUseSandbox} onChange={(e) => update("dhlUseSandbox", e.target.checked)} />
                Use sandbox
              </label>
            </div>
            <div className="space-y-3 rounded-lg border border-slate-200 p-4">
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={settings.upsEnabled} onChange={(e) => update("upsEnabled", e.target.checked)} />
                UPS API
              </label>
              <input className={inputClass} placeholder="Client ID" value={settings.upsClientId} onChange={(e) => update("upsClientId", e.target.value)} />
              <input className={inputClass} placeholder="Client secret" type="password" value={settings.upsClientSecret} onChange={(e) => update("upsClientSecret", e.target.value)} />
              <input className={inputClass} placeholder="Account number" value={settings.upsAccountNumber} onChange={(e) => update("upsAccountNumber", e.target.value)} />
              <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={settings.upsUseSandbox} onChange={(e) => update("upsUseSandbox", e.target.checked)} />
                Use sandbox
              </label>
            </div>
            <div className="space-y-3 rounded-lg border border-slate-200 p-4">
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={settings.fedexEnabled} onChange={(e) => update("fedexEnabled", e.target.checked)} />
                FedEx API
              </label>
              <input className={inputClass} placeholder="API key" value={settings.fedexApiKey} onChange={(e) => update("fedexApiKey", e.target.value)} />
              <input className={inputClass} placeholder="API secret" type="password" value={settings.fedexApiSecret} onChange={(e) => update("fedexApiSecret", e.target.value)} />
              <input className={inputClass} placeholder="Account number" value={settings.fedexAccountNumber} onChange={(e) => update("fedexAccountNumber", e.target.value)} />
              <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={settings.fedexUseSandbox} onChange={(e) => update("fedexUseSandbox", e.target.checked)} />
                Use sandbox
              </label>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              save({
                shippingLocationMode: settings.shippingLocationMode,
                autoCarrierRates: settings.autoCarrierRates,
                flatShippingRate: settings.flatShippingRate,
                localPickupRate: settings.localPickupRate,
                dhlEnabled: settings.dhlEnabled,
                dhlApiKey: settings.dhlApiKey,
                dhlApiSecret: settings.dhlApiSecret,
                dhlAccountNumber: settings.dhlAccountNumber,
                dhlUseSandbox: settings.dhlUseSandbox,
                upsEnabled: settings.upsEnabled,
                upsClientId: settings.upsClientId,
                upsClientSecret: settings.upsClientSecret,
                upsAccountNumber: settings.upsAccountNumber,
                upsUseSandbox: settings.upsUseSandbox,
                fedexEnabled: settings.fedexEnabled,
                fedexApiKey: settings.fedexApiKey,
                fedexApiSecret: settings.fedexApiSecret,
                fedexAccountNumber: settings.fedexAccountNumber,
                fedexUseSandbox: settings.fedexUseSandbox,
              })
            }
            disabled={saving}
            className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </section>
      )
    }

    if (section === "payments") {
      return (
        <section className="space-y-5">
          <h3 className="text-2xl font-semibold text-slate-900">Payment behavior</h3>
          <label className="inline-flex items-center gap-3 text-sm text-slate-800">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={settings.checkoutEnabled}
              onChange={(e) => update("checkoutEnabled", e.target.checked)}
            />
            Enable checkout and order placement
          </label>
          <FieldRow label="Currency">
            <select className={inputClass} value={settings.defaultCurrency} onChange={(e) => update("defaultCurrency", e.target.value)}>
              <option value="TRY">Turkish lira (₺) — TRY</option>
              <option value="USD">United States (US$) — USD</option>
              <option value="EUR">Euro (€) — EUR</option>
              <option value="GBP">Pound sterling (£) — GBP</option>
            </select>
          </FieldRow>
          <FieldRow label="Default checkout provider">
            <select
              className={inputClass}
              value={settings.paymentDefaultProvider}
              onChange={(e) => update("paymentDefaultProvider", e.target.value as SiteSettings["paymentDefaultProvider"])}
            >
              <option value="gpay">Google Pay</option>
              <option value="applepay">Apple Pay</option>
              <option value="paypal">PayPal</option>
              <option value="stripe">Stripe</option>
            </select>
          </FieldRow>

          <Tabs value={activePaymentTab} onValueChange={(value) => setActivePaymentTab(value as "gpay" | "applepay" | "paypal" | "stripe")}>
            <TabsList className="h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
              <TabsTrigger value="gpay" className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium data-[state=active]:border-slate-900 data-[state=active]:bg-slate-900 data-[state=active]:text-white">
                Google Pay
              </TabsTrigger>
              <TabsTrigger value="applepay" className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium data-[state=active]:border-slate-900 data-[state=active]:bg-slate-900 data-[state=active]:text-white">
                Apple Pay
              </TabsTrigger>
              <TabsTrigger value="paypal" className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium data-[state=active]:border-slate-900 data-[state=active]:bg-slate-900 data-[state=active]:text-white">
                PayPal
              </TabsTrigger>
              <TabsTrigger value="stripe" className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium data-[state=active]:border-slate-900 data-[state=active]:bg-slate-900 data-[state=active]:text-white">
                Stripe
              </TabsTrigger>
            </TabsList>

            <TabsContent value="gpay" className="rounded-lg border border-slate-200 p-4">
              <div className="space-y-3">
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={settings.googlePayEnabled} onChange={(e) => update("googlePayEnabled", e.target.checked)} />
                  Enable Google Pay
                </label>
                <input className={inputClass} placeholder="Merchant ID" value={settings.googlePayMerchantId} onChange={(e) => update("googlePayMerchantId", e.target.value)} />
                <input className={inputClass} placeholder="Merchant name" value={settings.googlePayMerchantName} onChange={(e) => update("googlePayMerchantName", e.target.value)} />
                <input className={inputClass} placeholder="Gateway API key" value={settings.googlePayApiKey} onChange={(e) => update("googlePayApiKey", e.target.value)} />
                <input className={inputClass} placeholder="Gateway API secret" type="password" value={settings.googlePayApiSecret} onChange={(e) => update("googlePayApiSecret", e.target.value)} />
                <input className={inputClass} placeholder="Allowed IPs (comma separated)" value={settings.googlePayAllowedIps} onChange={(e) => update("googlePayAllowedIps", e.target.value)} />
              </div>
            </TabsContent>

            <TabsContent value="applepay" className="rounded-lg border border-slate-200 p-4">
              <div className="space-y-3">
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={settings.applePayEnabled} onChange={(e) => update("applePayEnabled", e.target.checked)} />
                  Enable Apple Pay
                </label>
                <input className={inputClass} placeholder="Merchant ID" value={settings.applePayMerchantId} onChange={(e) => update("applePayMerchantId", e.target.value)} />
                <input className={inputClass} placeholder="Merchant name" value={settings.applePayMerchantName} onChange={(e) => update("applePayMerchantName", e.target.value)} />
                <input className={inputClass} placeholder="Merchant domain" value={settings.applePayDomain} onChange={(e) => update("applePayDomain", e.target.value)} />
                <input className={inputClass} placeholder="Gateway API key" value={settings.applePayApiKey} onChange={(e) => update("applePayApiKey", e.target.value)} />
                <input className={inputClass} placeholder="Gateway API secret" type="password" value={settings.applePayApiSecret} onChange={(e) => update("applePayApiSecret", e.target.value)} />
                <input className={inputClass} placeholder="Allowed IPs (comma separated)" value={settings.applePayAllowedIps} onChange={(e) => update("applePayAllowedIps", e.target.value)} />
              </div>
            </TabsContent>

            <TabsContent value="paypal" className="rounded-lg border border-slate-200 p-4">
              <div className="space-y-3">
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={settings.paypalEnabled} onChange={(e) => update("paypalEnabled", e.target.checked)} />
                  Enable PayPal
                </label>
                <select className={inputClass} value={settings.paypalMode} onChange={(e) => update("paypalMode", e.target.value as SiteSettings["paypalMode"])}>
                  <option value="sandbox">Sandbox</option>
                  <option value="live">Live</option>
                </select>
                <input className={inputClass} placeholder="Client ID" value={settings.paypalClientId} onChange={(e) => update("paypalClientId", e.target.value)} />
                <input className={inputClass} placeholder="Client secret" type="password" value={settings.paypalClientSecret} onChange={(e) => update("paypalClientSecret", e.target.value)} />
                <input className={inputClass} placeholder="Allowed IPs (comma separated)" value={settings.paypalAllowedIps} onChange={(e) => update("paypalAllowedIps", e.target.value)} />
              </div>
            </TabsContent>

            <TabsContent value="stripe" className="rounded-lg border border-slate-200 p-4">
              <div className="space-y-3">
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={settings.stripeEnabled} onChange={(e) => update("stripeEnabled", e.target.checked)} />
                  Enable Stripe
                </label>
                <input className={inputClass} placeholder="Publishable key" value={settings.stripePublishableKey} onChange={(e) => update("stripePublishableKey", e.target.value)} />
                <input className={inputClass} placeholder="Secret key" type="password" value={settings.stripeSecretKey} onChange={(e) => update("stripeSecretKey", e.target.value)} />
                <input className={inputClass} placeholder="Webhook secret" type="password" value={settings.stripeWebhookSecret} onChange={(e) => update("stripeWebhookSecret", e.target.value)} />
                <input className={inputClass} placeholder="Allowed IPs (comma separated)" value={settings.stripeAllowedIps} onChange={(e) => update("stripeAllowedIps", e.target.value)} />
              </div>
            </TabsContent>
          </Tabs>
          <button
            type="button"
            onClick={() =>
              save({
                checkoutEnabled: settings.checkoutEnabled,
                defaultCurrency: settings.defaultCurrency,
                paymentDefaultProvider: settings.paymentDefaultProvider,
                googlePayEnabled: settings.googlePayEnabled,
                googlePayMerchantId: settings.googlePayMerchantId,
                googlePayMerchantName: settings.googlePayMerchantName,
                googlePayApiKey: settings.googlePayApiKey,
                googlePayApiSecret: settings.googlePayApiSecret,
                googlePayAllowedIps: settings.googlePayAllowedIps,
                applePayEnabled: settings.applePayEnabled,
                applePayMerchantId: settings.applePayMerchantId,
                applePayMerchantName: settings.applePayMerchantName,
                applePayDomain: settings.applePayDomain,
                applePayApiKey: settings.applePayApiKey,
                applePayApiSecret: settings.applePayApiSecret,
                applePayAllowedIps: settings.applePayAllowedIps,
                stripeEnabled: settings.stripeEnabled,
                stripePublishableKey: settings.stripePublishableKey,
                stripeSecretKey: settings.stripeSecretKey,
                stripeWebhookSecret: settings.stripeWebhookSecret,
                stripeAllowedIps: settings.stripeAllowedIps,
                paypalEnabled: settings.paypalEnabled,
                paypalClientId: settings.paypalClientId,
                paypalClientSecret: settings.paypalClientSecret,
                paypalMode: settings.paypalMode,
                paypalAllowedIps: settings.paypalAllowedIps,
              })
            }
            disabled={saving}
            className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </section>
      )
    }

    if (section === "emails") {
      return (
        <section className="space-y-5">
          <h3 className="text-2xl font-semibold text-slate-900">Email and contact defaults</h3>
          <p className="text-sm text-slate-600">
            Configure outgoing (SMTP) and incoming (IMAP/POP3) mail server details and order email automation.
          </p>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4 rounded-lg border border-slate-200 p-4">
              <h4 className="text-base font-semibold text-slate-900">Outgoing mail server (SMTP)</h4>
              <FieldRow label="SMTP host">
                <input
                  className={inputClass}
                  value={settings.outgoingMailHost}
                  onChange={(e) => update("outgoingMailHost", e.target.value)}
                  placeholder="smtp.yourdomain.com"
                />
              </FieldRow>
              <FieldRow label="SMTP port">
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  max={65535}
                  value={settings.outgoingMailPort}
                  onChange={(e) => update("outgoingMailPort", Math.max(1, Math.min(65535, Number(e.target.value || 465))))}
                />
              </FieldRow>
              <FieldRow label="Secure connection (SSL)">
                <label className="inline-flex items-center gap-3 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300"
                    checked={settings.outgoingMailSecure}
                    onChange={(e) => update("outgoingMailSecure", e.target.checked)}
                  />
                  Enable secure SMTP
                </label>
              </FieldRow>
              <FieldRow label="SMTP username">
                <input className={inputClass} value={settings.outgoingMailUser} onChange={(e) => update("outgoingMailUser", e.target.value)} />
              </FieldRow>
              <FieldRow label="SMTP password">
                <input
                  className={inputClass}
                  type="password"
                  value={settings.outgoingMailPassword}
                  onChange={(e) => update("outgoingMailPassword", e.target.value)}
                />
              </FieldRow>
              <FieldRow label="From name">
                <input className={inputClass} value={settings.outgoingMailFromName} onChange={(e) => update("outgoingMailFromName", e.target.value)} />
              </FieldRow>
              <FieldRow label="From email">
                <input className={inputClass} value={settings.outgoingMailFromEmail} onChange={(e) => update("outgoingMailFromEmail", e.target.value)} />
              </FieldRow>
              <FieldRow label="Reply-to email">
                <input className={inputClass} value={settings.outgoingMailReplyTo} onChange={(e) => update("outgoingMailReplyTo", e.target.value)} />
              </FieldRow>
            </div>

            <div className="space-y-4 rounded-lg border border-slate-200 p-4">
              <h4 className="text-base font-semibold text-slate-900">Incoming mail server</h4>
              <FieldRow label="Protocol">
                <select
                  className={inputClass}
                  value={settings.incomingMailProtocol}
                  onChange={(e) => update("incomingMailProtocol", e.target.value as SiteSettings["incomingMailProtocol"])}
                >
                  <option value="imap">IMAP</option>
                  <option value="pop3">POP3</option>
                </select>
              </FieldRow>
              <FieldRow label="Incoming host">
                <input
                  className={inputClass}
                  value={settings.incomingMailHost}
                  onChange={(e) => update("incomingMailHost", e.target.value)}
                  placeholder="imap.yourdomain.com"
                />
              </FieldRow>
              <FieldRow label="Incoming port">
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  max={65535}
                  value={settings.incomingMailPort}
                  onChange={(e) => update("incomingMailPort", Math.max(1, Math.min(65535, Number(e.target.value || 993))))}
                />
              </FieldRow>
              <FieldRow label="Secure connection (SSL)">
                <label className="inline-flex items-center gap-3 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300"
                    checked={settings.incomingMailSecure}
                    onChange={(e) => update("incomingMailSecure", e.target.checked)}
                  />
                  Enable secure incoming mail
                </label>
              </FieldRow>
              <FieldRow label="Incoming username">
                <input className={inputClass} value={settings.incomingMailUser} onChange={(e) => update("incomingMailUser", e.target.value)} />
              </FieldRow>
              <FieldRow label="Incoming password">
                <input
                  className={inputClass}
                  type="password"
                  value={settings.incomingMailPassword}
                  onChange={(e) => update("incomingMailPassword", e.target.value)}
                />
              </FieldRow>
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-slate-200 p-4">
            <h4 className="text-base font-semibold text-slate-900">Order email automation</h4>
            <FieldRow label="Admin recipients">
              <input
                className={inputClass}
                value={settings.orderEmailAdminRecipients}
                onChange={(e) => update("orderEmailAdminRecipients", e.target.value)}
                placeholder="admin@example.com, sales@example.com"
              />
            </FieldRow>
            <div className="grid gap-3">
              <label className="inline-flex items-center gap-3 text-sm text-slate-800">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={settings.sendOrderEmailOnCreate}
                  onChange={(e) => update("sendOrderEmailOnCreate", e.target.checked)}
                />
                Send email when a new order is placed
              </label>
              <label className="inline-flex items-center gap-3 text-sm text-slate-800">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={settings.sendOrderEmailOnCancelled}
                  onChange={(e) => update("sendOrderEmailOnCancelled", e.target.checked)}
                />
                Send email when an order is cancelled
              </label>
              <label className="inline-flex items-center gap-3 text-sm text-slate-800">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={settings.sendOrderEmailOnStatusChange}
                  onChange={(e) => update("sendOrderEmailOnStatusChange", e.target.checked)}
                />
                Send email when order status changes
              </label>
              <label className="inline-flex items-center gap-3 text-sm text-slate-800">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={settings.sendOrderEmailOnFulfillment}
                  onChange={(e) => update("sendOrderEmailOnFulfillment", e.target.checked)}
                />
                Send email when tracking/fulfillment is added
              </label>
            </div>
          </div>
          <FieldRow label="Support email">
            <input className={inputClass} value={settings.supportEmail} onChange={(e) => update("supportEmail", e.target.value)} />
          </FieldRow>
          <FieldRow label="Support phone">
            <input className={inputClass} value={settings.supportPhone} onChange={(e) => update("supportPhone", e.target.value)} />
          </FieldRow>
          <button
            type="button"
            onClick={() =>
              save({
                supportEmail: settings.supportEmail,
                supportPhone: settings.supportPhone,
                outgoingMailHost: settings.outgoingMailHost,
                outgoingMailPort: settings.outgoingMailPort,
                outgoingMailSecure: settings.outgoingMailSecure,
                outgoingMailUser: settings.outgoingMailUser,
                outgoingMailPassword: settings.outgoingMailPassword,
                outgoingMailFromName: settings.outgoingMailFromName,
                outgoingMailFromEmail: settings.outgoingMailFromEmail,
                outgoingMailReplyTo: settings.outgoingMailReplyTo,
                incomingMailHost: settings.incomingMailHost,
                incomingMailPort: settings.incomingMailPort,
                incomingMailSecure: settings.incomingMailSecure,
                incomingMailUser: settings.incomingMailUser,
                incomingMailPassword: settings.incomingMailPassword,
                incomingMailProtocol: settings.incomingMailProtocol,
                orderEmailAdminRecipients: settings.orderEmailAdminRecipients,
                sendOrderEmailOnCreate: settings.sendOrderEmailOnCreate,
                sendOrderEmailOnCancelled: settings.sendOrderEmailOnCancelled,
                sendOrderEmailOnStatusChange: settings.sendOrderEmailOnStatusChange,
                sendOrderEmailOnFulfillment: settings.sendOrderEmailOnFulfillment,
              })
            }
            disabled={saving}
            className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </section>
      )
    }

    if (section === "advanced") {
      return (
        <section className="space-y-5">
          <h3 className="text-2xl font-semibold text-slate-900">Advanced defaults</h3>
          <FieldRow label="Default language">
            <input className={inputClass} value={settings.defaultLanguage} onChange={(e) => update("defaultLanguage", e.target.value)} />
          </FieldRow>
          <label className="inline-flex items-center gap-3 text-sm text-slate-800">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={settings.maintenanceMode}
              onChange={(e) => update("maintenanceMode", e.target.checked)}
            />
            Enable maintenance mode banner
          </label>
          <button
            type="button"
            onClick={() =>
              save({
                defaultLanguage: settings.defaultLanguage,
                maintenanceMode: settings.maintenanceMode,
              })
            }
            disabled={saving}
            className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </section>
      )
    }

    return (
      <section className="space-y-4">
        <h3 className="text-2xl font-semibold text-slate-900">{label}</h3>
        <p className="text-slate-600">
          This section is now connected to the global settings store. Tell me the exact fields you want here and I will add them.
        </p>
      </section>
    )
  }

  return (
    <div className="rounded-xl border border-[#dce3ed] bg-white p-6">
      {!settings ? <p className="text-sm text-slate-500">Loading settings...</p> : renderContent()}
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 md:grid-cols-[240px_minmax(0,1fr)] md:items-center">
      <label className="text-sm font-semibold text-slate-800">{label}</label>
      {children}
    </div>
  )
}
