"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronUp, House, X } from "lucide-react"
import { toast } from "sonner"

import { getCartSummary, getCartUpdateEventName, readCart, type CartItem } from "@/lib/storefront/cart"
import { formatCurrency, type CurrencySettings } from "@/lib/storefront/currency"
import { pickPrimaryImage } from "@/lib/product-images"

type Provider = "stripe" | "paypal" | "gpay" | "applepay" | "paytr"
type PaymentTab = "gpay" | "applepay" | "paypal" | "stripe"
type ShippingMethod = "dhl" | "ups" | "fedex"

type PublicSettings = {
  checkoutEnabled?: boolean
  enableGuestCheckout?: boolean
  defaultCurrency?: string
  currencyPosition?: "left" | "right"
  thousandSeparator?: string
  decimalSeparator?: string
  numberOfDecimals?: number
  stripeEnabled?: boolean
  googlePayEnabled?: boolean
  applePayEnabled?: boolean
  paypalEnabled?: boolean
  paytrEnabled?: boolean
  paymentDefaultProvider?: Provider
  flatShippingRate?: number
  localPickupRate?: number
  enableTaxes?: boolean
}

type LocationCountry = {
  code: string
  name: string
}

const REQUEST_TIMEOUT_MS = 15000

export default function CheckoutPage() {
  const countriesInitializedRef = useRef(false)
  const statesFetchKeyRef = useRef("")
  const citiesFetchKeyRef = useRef("")

  const [items, setItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState<PublicSettings>({})
  const [paymentTab, setPaymentTab] = useState<PaymentTab>("stripe")
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("dhl")
  const [openStep, setOpenStep] = useState<number | null>(1)
  const [deliverySameAsBilling, setDeliverySameAsBilling] = useState(true)
  const [orderComment, setOrderComment] = useState("")
  const [agreeTerms, setAgreeTerms] = useState(false)

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [company, setCompany] = useState("")
  const [addressLine1, setAddressLine1] = useState("")
  const [addressLine2, setAddressLine2] = useState("")
  const [city, setCity] = useState("")
  const [postcode, setPostcode] = useState("")
  const [country, setCountry] = useState("United Kingdom")
  const [regionState, setRegionState] = useState("Anglesey")
  const [countryCode, setCountryCode] = useState("GB")
  const [countryOptions, setCountryOptions] = useState<LocationCountry[]>([])
  const [stateOptions, setStateOptions] = useState<string[]>([])
  const [cityOptions, setCityOptions] = useState<string[]>([])
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [checkoutOption, setCheckoutOption] = useState<"register" | "guest">("guest")
  const [fallbackBannerImage, setFallbackBannerImage] = useState("")
  const [authModalMode, setAuthModalMode] = useState<null | "register" | "forgot">(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [forgotEmail, setForgotEmail] = useState("")
  const [registerFirstName, setRegisterFirstName] = useState("")
  const [registerLastName, setRegisterLastName] = useState("")
  const [registerEmail, setRegisterEmail] = useState("")
  const [registerPhone, setRegisterPhone] = useState("")
  const [registerPassword, setRegisterPassword] = useState("")
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState("")
  const [registerOptIn, setRegisterOptIn] = useState(true)
  const [registerPolicyAgree, setRegisterPolicyAgree] = useState(false)
  const [showRegisterSuccess, setShowRegisterSuccess] = useState(false)

  const currencySettings: CurrencySettings = {
    defaultCurrency: settings.defaultCurrency || "USD",
    currencyPosition: settings.currencyPosition || "left",
    thousandSeparator: settings.thousandSeparator || ".",
    decimalSeparator: settings.decimalSeparator || ",",
    numberOfDecimals: typeof settings.numberOfDecimals === "number" ? settings.numberOfDecimals : 2,
  }

  useEffect(() => {
    const refresh = () => setItems(readCart())
    const eventName = getCartUpdateEventName()

    window.addEventListener(eventName, refresh)
    window.addEventListener("storage", refresh)
    const timer = window.setTimeout(refresh, 0)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener(eventName, refresh)
      window.removeEventListener("storage", refresh)
    }
  }, [])

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch("/api/public/settings", { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json()) as PublicSettings
        setSettings(data)

        const enabledTabs: PaymentTab[] = []
        if (data.googlePayEnabled) enabledTabs.push("gpay")
        if (data.applePayEnabled) enabledTabs.push("applepay")
        if (data.stripeEnabled) enabledTabs.push("stripe")
        if (data.paypalEnabled) enabledTabs.push("paypal")

        if (data.paymentDefaultProvider === "gpay" && enabledTabs.includes("gpay")) {
          setPaymentTab("gpay")
        } else if (data.paymentDefaultProvider === "applepay" && enabledTabs.includes("applepay")) {
          setPaymentTab("applepay")
        } else if (data.paymentDefaultProvider === "paypal" && enabledTabs.includes("paypal")) {
          setPaymentTab("paypal")
        } else if (enabledTabs.length > 0) {
          setPaymentTab(enabledTabs[0])
        }
      } catch {
        // keep defaults
      }
    }

    void loadSettings()
  }, [])

  useEffect(() => {
    const loadFallbackBanner = async () => {
      try {
        const res = await fetch("/api/v1/public/products?limit=1&sort=latest", { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json().catch(() => ({}))) as {
          products?: Array<{ image?: string; featuredImage?: string; images?: unknown }>
        }
        const product = Array.isArray(data.products) ? data.products[0] : null
        if (!product) return
        const image =
          (typeof product.image === "string" ? product.image : "") ||
          pickPrimaryImage(product.featuredImage ?? "", product.images)
        if (image) setFallbackBannerImage(image)
      } catch {
        // keep placeholder fallback
      }
    }

    void loadFallbackBanner()
  }, [])

  useEffect(() => {
    if (countriesInitializedRef.current) return
    countriesInitializedRef.current = true
    const loadCountries = async () => {
      try {
        const res = await fetch("/api/public/location/countries", { cache: "no-store" })
        if (!res.ok) return
        const json = (await res.json().catch(() => ({}))) as { countries?: LocationCountry[] }
        const rawCountries = Array.isArray(json.countries) ? json.countries : []
        if (rawCountries.length === 0) return

        const grouped = new Map<string, LocationCountry[]>()
        for (const item of rawCountries) {
          const nameKey = (item.name || "").trim().toLowerCase()
          if (!nameKey) continue
          if (!grouped.has(nameKey)) grouped.set(nameKey, [])
          grouped.get(nameKey)!.push(item)
        }

        const countries = Array.from(grouped.values()).map((sameNameItems) => {
          const preferGB = sameNameItems.find((item) => item.code === "GB")
          if (preferGB) return preferGB
          return sameNameItems[0]
        })

        countries.sort((a, b) => a.name.localeCompare(b.name))
        setCountryOptions(countries)

        const byName = countries.find((item) => item.name.toLowerCase() === country.toLowerCase())
        const current = byName || countries.find((item) => item.code === countryCode) || countries[0]
        if (!current) return
        setCountryCode(current.code)
        setCountry(current.name)
      } catch {
        // keep defaults
      }
    }
    void loadCountries()
  }, [country, countryCode])

  useEffect(() => {
    if (!countryCode) return
    const fetchKey = `${countryCode}|${country}`
    if (statesFetchKeyRef.current === fetchKey) return
    statesFetchKeyRef.current = fetchKey
    const loadStates = async () => {
      try {
        const res = await fetch(`/api/public/location/states?countryCode=${encodeURIComponent(countryCode)}&countryName=${encodeURIComponent(country)}`, {
          cache: "no-store",
        })
        if (!res.ok) {
          setStateOptions([])
          return
        }
        const json = (await res.json().catch(() => ({}))) as { states?: string[] }
        const states = Array.isArray(json.states) ? json.states : []
        setStateOptions(states)
        if (states.length > 0 && !states.includes(regionState)) {
          setRegionState(states[0])
        }
      } catch {
        setStateOptions([])
      }
    }
    void loadStates()
  }, [countryCode, country, regionState])

  useEffect(() => {
    if (!countryCode) return
    const fetchKey = `${countryCode}|${country}|${regionState}`
    if (citiesFetchKeyRef.current === fetchKey) return
    citiesFetchKeyRef.current = fetchKey
    const loadCities = async () => {
      const params = new URLSearchParams({
        countryCode,
        countryName: country,
      })
      if (regionState.trim()) {
        params.set("state", regionState.trim())
      }
      try {
        const res = await fetch(`/api/public/location/cities?${params.toString()}`, { cache: "no-store" })
        if (!res.ok) {
          setCityOptions([])
          return
        }
        const json = (await res.json().catch(() => ({}))) as { cities?: string[] }
        const cities = Array.isArray(json.cities) ? json.cities : []
        setCityOptions(cities)
        if (cities.length > 0 && !cities.includes(city)) {
          setCity(cities[0])
        }
      } catch {
        setCityOptions([])
      }
    }
    void loadCities()
  }, [countryCode, country, regionState, city])

  const summary = useMemo(() => getCartSummary(items), [items])
  const bannerImage = items[0]?.image || fallbackBannerImage || "/placeholder.jpg"
  const flatRate = Math.max(0, Number(settings.flatShippingRate || 0))
  const shippingOptions: Array<{ value: ShippingMethod; label: string; price: number }> = [
    { value: "dhl", label: "DHL", price: flatRate },
    { value: "ups", label: "UPS", price: flatRate + 4 },
    { value: "fedex", label: "FedEx", price: flatRate + 8 },
  ]
  const selectedShipping = shippingOptions.find((option) => option.value === shippingMethod) || shippingOptions[0]
  const shippingCost = selectedShipping.price
  const shippingLabel = selectedShipping.label
  const ecoTaxAmount = 0
  const vatAmount = settings.enableTaxes ? (summary.total + shippingCost) * 0.1 : 0
  const taxAmount = vatAmount
  const total = summary.total + shippingCost + ecoTaxAmount + vatAmount

  const enabledPaymentTabs = useMemo(() => {
    const tabs: Array<{ value: PaymentTab; label: string; enabled: boolean }> = [
      { value: "gpay", label: "GPay", enabled: Boolean(settings.googlePayEnabled) },
      { value: "applepay", label: "Apple Pay", enabled: Boolean(settings.applePayEnabled) },
      { value: "paypal", label: "PayPal", enabled: Boolean(settings.paypalEnabled) },
      { value: "stripe", label: "Stripe", enabled: Boolean(settings.stripeEnabled) },
    ]
    return tabs
  }, [settings.googlePayEnabled, settings.applePayEnabled, settings.stripeEnabled, settings.paypalEnabled])

  const provider: Provider = paymentTab
  const paymentPanel = useMemo(() => {
    if (paymentTab === "gpay") {
      return {
        title: "Google Pay",
        description: "Use Google Pay for a fast and secure checkout with your saved cards.",
      }
    }
    if (paymentTab === "applepay") {
      return {
        title: "Apple Pay",
        description: "Pay quickly with Apple Pay using Face ID or Touch ID on supported devices.",
      }
    }
    if (paymentTab === "paypal") {
      return {
        title: "PayPal",
        description: "You will be redirected to PayPal to complete payment securely.",
      }
    }
    return {
      title: "Stripe Card Payment",
      description: "Pay with Visa, MasterCard, AMEX or other cards powered by Stripe.",
    }
  }, [paymentTab])

  const startPayment = async () => {
    if (items.length === 0) {
      toast.error("Your basket is empty")
      return
    }

    if (!firstName.trim() || !lastName.trim() || !customerEmail.trim()) {
      toast.error("Please enter first name, last name and email")
      return
    }

    if (!enabledPaymentTabs.some((tab) => tab.enabled)) {
      toast.error("No payment provider is enabled")
      return
    }

    if (!agreeTerms) {
      toast.error("Please accept terms & conditions")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/public/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          customerName: [firstName.trim(), lastName.trim()].filter(Boolean).join(" "),
          customerEmail: customerEmail.trim(),
          customerPhone: customerPhone.trim(),
          company: company.trim(),
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim(),
          city: city.trim(),
          postcode: postcode.trim(),
          country: country.trim(),
          regionState: regionState.trim(),
          shippingMethod,
          shippingCost,
          subtotal: summary.total,
          taxAmount,
          total,
          items: items.map((item) => ({
            productId: item.productId,
            title: item.title,
            quantity: item.quantity,
            price: item.price,
          })),
        }),
      })

      const json = (await res.json().catch(() => ({}))) as { error?: string; redirectUrl?: string }
      if (!res.ok || !json.redirectUrl) {
        throw new Error(json.error || "Checkout could not be started")
      }

      window.location.assign(json.redirectUrl)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Checkout failed")
    } finally {
      setLoading(false)
    }
  }

  const submitReturningCustomer = async () => {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      toast.error("Please enter email and password")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/auth/login?portal=customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(json.error || "Login failed")
      setCustomerEmail(loginEmail.trim())
      setOpenStep(2)
      toast.success("Login successful")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  const submitForgotPasswordRequest = async () => {
    const email = forgotEmail.trim()
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email")
      return
    }
    setAuthLoading(true)
    let timeoutId: number | undefined
    try {
      const controller = new AbortController()
      timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      const response = await fetch("/api/messages/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          name: "Checkout Customer",
          email,
          subject: "Password reset request",
          message: `Customer requested password reset from checkout page. Email: ${email}`,
        }),
      })
      window.clearTimeout(timeoutId)
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) throw new Error(data.error || "Could not send reset request")
      toast.success("Reset request sent. We will contact you shortly.")
      setForgotEmail("")
      setAuthModalMode(null)
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        toast.error("Request timed out. Please try again.")
      } else {
        toast.error(error instanceof Error ? error.message : "Could not send reset request")
      }
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId)
      setAuthLoading(false)
    }
  }

  const submitRegisterFromCheckout = async () => {
    if (!registerPolicyAgree) {
      toast.error("Please accept privacy policy")
      return
    }
    if (registerPassword !== registerPasswordConfirm) {
      toast.error("Passwords do not match")
      return
    }
    setAuthLoading(true)
    let timeoutId: number | undefined
    try {
      const controller = new AbortController()
      timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      const fullName = `${registerFirstName} ${registerLastName}`.trim()
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          name: fullName,
          email: registerEmail.trim(),
          phone: registerPhone.trim(),
          password: registerPassword,
          marketingOptIn: registerOptIn,
          source: "account",
        }),
      })
      window.clearTimeout(timeoutId)
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        throw new Error(data.error || "Registration failed")
      }
      setAuthModalMode(null)
      setShowRegisterSuccess(true)
      setRegisterFirstName("")
      setRegisterLastName("")
      setRegisterEmail("")
      setRegisterPhone("")
      setRegisterPassword("")
      setRegisterPasswordConfirm("")
      setRegisterPolicyAgree(false)
      setCheckoutOption("guest")
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        toast.error("Request timed out. Please try again.")
      } else {
        toast.error(error instanceof Error ? error.message : "Registration failed")
      }
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId)
      setAuthLoading(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[#f5f5f5]">
        <section className="relative overflow-hidden border-b border-slate-200">
          <img src={bannerImage} alt="Checkout banner" className="absolute inset-0 h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-black/35" />
          <div className="relative mx-auto w-full max-w-[1200px] px-6 py-12 text-center">
            <h1 className="text-4xl font-semibold text-white">Checkout</h1>
            <div className="mt-2 flex items-center justify-center gap-3 text-sm text-slate-100 md:text-base">
              <Link href="/" className="inline-flex items-center gap-2 hover:text-white">
                <House className="h-4 w-4" />
                Home
              </Link>
              <span>/</span>
              <Link href="/basket" className="hover:text-white">Shopping Cart</Link>
              <span>/</span>
              <span>Checkout</span>
            </div>
          </div>
        </section>
        <div className="mx-auto w-full max-w-[1200px] px-6 py-10">
          <div className="rounded-md border border-slate-200 bg-white p-10 text-center">
            <p className="text-slate-600">Your cart is empty.</p>
            <Link href="/shop" className="mt-4 inline-flex h-10 items-center rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800">
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <section className="relative overflow-hidden border-b border-slate-200">
        <img src={bannerImage} alt="Checkout banner" className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-black/35" />
        <div className="relative mx-auto w-full max-w-[1200px] px-4 py-10 text-center sm:px-6 sm:py-12">
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">Checkout</h1>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm text-slate-100 md:text-base">
            <Link href="/" className="inline-flex items-center gap-2 hover:text-white">
              <House className="h-4 w-4" />
              Home
            </Link>
            <span>/</span>
            <Link href="/basket" className="hover:text-white">Shopping Cart</Link>
            <span>/</span>
            <span>Checkout</span>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1600px] px-3 py-8 sm:px-4 sm:py-10 lg:px-10">
        <div className="border-t border-slate-200">
          <div className="border-b border-slate-200">
            <button type="button" onClick={() => setOpenStep(openStep === 1 ? null : 1)} className="flex h-16 w-full items-center justify-between text-left">
              <span className="text-base font-semibold leading-none text-teal-800">Step 1: <span className="text-base font-semibold text-slate-900">Checkout Options</span></span>
              {openStep === 1 ? <ChevronUp className="h-6 w-6 text-slate-700" /> : <ChevronDown className="h-6 w-6 text-slate-700" />}
            </button>
            {openStep === 1 ? (
              <div className="pb-7">
                <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
                  <div>
                    <h3 className="text-2xl font-semibold leading-none text-slate-900">Returning Customer</h3>
                    <div className="mt-10 space-y-4">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_1fr] sm:items-center sm:gap-4">
                        <label className="text-base text-slate-600">E-Mail</label>
                        <input
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          className="h-11 rounded border border-slate-300 px-4 text-base"
                          placeholder="E-Mail"
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_1fr] sm:items-center sm:gap-4">
                        <label className="text-base text-slate-600">Password</label>
                        <input
                          type="password"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className="h-11 rounded border border-slate-300 px-4 text-base"
                          placeholder="Password"
                        />
                      </div>
                      <button type="button" onClick={() => setAuthModalMode("forgot")} className="inline-block text-base text-teal-800 underline">
                        Forgotten Password
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={submitReturningCustomer}
                      disabled={loading}
                      className="mt-10 inline-flex h-12 w-full items-center justify-center rounded-full bg-teal-700 text-base font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
                    >
                      Login
                    </button>
                  </div>

                  <div>
                    <h3 className="text-2xl font-semibold leading-none text-slate-900">New Customer</h3>
                    <div className="mt-10 space-y-3 text-lg text-slate-700">
                      <label className="flex items-center gap-3">
                        <input
                          type="radio"
                          checked={checkoutOption === "register"}
                          onChange={() => {
                            setCheckoutOption("register")
                            setAuthModalMode("register")
                          }}
                        />
                        Register Account
                      </label>
                      <label className="flex items-center gap-3">
                        <input
                          type="radio"
                          checked={checkoutOption === "guest"}
                          onChange={() => setCheckoutOption("guest")}
                        />
                        Guest Checkout
                      </label>
                    </div>
                    <p className="mt-6 text-base leading-relaxed text-slate-600">
                      By creating an account you will be able to shop faster, be up to date on an order’s status, and keep track of the orders you have previously made.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (checkoutOption === "register") {
                          setAuthModalMode("register")
                          return
                        }
                        setOpenStep(2)
                      }}
                      className="mt-10 inline-flex h-12 w-full items-center justify-center rounded-full bg-teal-700 text-base font-semibold text-white hover:bg-teal-800"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-b border-slate-200">
            <button type="button" onClick={() => setOpenStep(openStep === 2 ? null : 2)} className="flex h-16 w-full items-center justify-between text-left">
              <span className="text-base font-semibold leading-none text-teal-800">Step 2: <span className="text-base font-semibold text-slate-900">Billing Details</span></span>
              {openStep === 2 ? <ChevronUp className="h-6 w-6 text-slate-700" /> : <ChevronDown className="h-6 w-6 text-slate-700" />}
            </button>
            {openStep === 2 ? (
              <div className="pb-8">
                <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
                  <div>
                    <h3 className="text-2xl font-semibold leading-none text-slate-900">Your Personal Details</h3>
                    <div className="mt-10 space-y-4">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_1fr] sm:items-center sm:gap-4">
                        <label className="text-base text-slate-600">First Name *</label>
                        <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-11 rounded border border-slate-300 px-4 text-base" placeholder="First Name" />
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_1fr] sm:items-center sm:gap-4">
                        <label className="text-base text-slate-600">Last Name *</label>
                        <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-11 rounded border border-slate-300 px-4 text-base" placeholder="Last Name" />
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_1fr] sm:items-center sm:gap-4">
                        <label className="text-base text-slate-600">E-Mail *</label>
                        <input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} type="email" className="h-11 rounded border border-slate-300 px-4 text-base" placeholder="E-Mail" />
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_1fr] sm:items-center sm:gap-4">
                        <label className="text-base text-slate-600">Telephone *</label>
                        <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="h-11 rounded border border-slate-300 px-4 text-base" placeholder="Telephone" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-2xl font-semibold leading-none text-slate-900">Your Address</h3>
                    <div className="mt-10 space-y-4">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_1fr] sm:items-center sm:gap-4">
                        <label className="text-base text-slate-600">Company</label>
                        <input value={company} onChange={(e) => setCompany(e.target.value)} className="h-11 rounded border border-slate-300 px-4 text-base" placeholder="Company" />
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_1fr] sm:items-center sm:gap-4">
                        <label className="text-base text-slate-600">Address 1 *</label>
                        <input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} className="h-11 rounded border border-slate-300 px-4 text-base" placeholder="Address 1" />
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_1fr] sm:items-center sm:gap-4">
                        <label className="text-base text-slate-600">Address 2</label>
                        <input value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} className="h-11 rounded border border-slate-300 px-4 text-base" placeholder="Address 2" />
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_1fr] sm:items-center sm:gap-4">
                        <label className="text-base text-slate-600">City *</label>
                        {cityOptions.length > 0 ? (
                          <select value={city} onChange={(e) => setCity(e.target.value)} className="h-11 rounded border border-slate-300 bg-white px-4 text-base">
                            {cityOptions.map((cityName) => (
                              <option key={cityName} value={cityName}>{cityName}</option>
                            ))}
                          </select>
                        ) : (
                          <input value={city} onChange={(e) => setCity(e.target.value)} className="h-11 rounded border border-slate-300 px-4 text-base" placeholder="City" />
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_1fr] sm:items-center sm:gap-4">
                        <label className="text-base text-slate-600">Post Code *</label>
                        <input value={postcode} onChange={(e) => setPostcode(e.target.value)} className="h-11 rounded border border-slate-300 px-4 text-base" placeholder="Post Code" />
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_1fr] sm:items-center sm:gap-4">
                        <label className="text-base text-slate-600">Country *</label>
                        <select
                          value={countryCode}
                          onChange={(e) => {
                            const code = e.target.value
                            setCountryCode(code)
                            const selected = countryOptions.find((item) => item.code === code)
                            if (selected) setCountry(selected.name)
                            setRegionState("")
                            setCity("")
                          }}
                          className="h-11 rounded border border-slate-300 bg-white px-4 text-base"
                        >
                          {countryOptions.length > 0 ? countryOptions.map((item) => (
                            <option key={item.code} value={item.code}>{item.name}</option>
                          )) : <option value={countryCode}>{country}</option>}
                        </select>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_1fr] sm:items-center sm:gap-4">
                        <label className="text-base text-slate-600">Region / State *</label>
                        {stateOptions.length > 0 ? (
                          <select value={regionState} onChange={(e) => setRegionState(e.target.value)} className="h-11 rounded border border-slate-300 bg-white px-4 text-base">
                            {stateOptions.map((stateName) => (
                              <option key={stateName} value={stateName}>{stateName}</option>
                            ))}
                          </select>
                        ) : (
                          <input value={regionState} onChange={(e) => setRegionState(e.target.value)} className="h-11 rounded border border-slate-300 px-4 text-base" placeholder="Region / State" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <label className="mt-8 inline-flex items-center gap-2 text-base text-slate-700">
                  <input type="checkbox" checked={deliverySameAsBilling} onChange={(e) => setDeliverySameAsBilling(e.target.checked)} />
                  My delivery and billing addresses are the same.
                </label>
                <button type="button" onClick={() => setOpenStep(3)} className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-teal-700 text-base font-semibold text-white hover:bg-teal-800">
                  Continue
                </button>
              </div>
            ) : null}
          </div>

          <div className="border-b border-slate-200">
            <button type="button" onClick={() => setOpenStep(openStep === 3 ? null : 3)} className="flex h-16 w-full items-center justify-between text-left">
              <span className="text-base font-semibold leading-none text-teal-800">Step 3: <span className="text-base font-semibold text-slate-900">Delivery Details</span></span>
              {openStep === 3 ? <ChevronUp className="h-6 w-6 text-slate-700" /> : <ChevronDown className="h-6 w-6 text-slate-700" />}
            </button>
            {openStep === 3 ? (
              <div className="pb-8">
                <p className="text-base text-slate-600">
                  {deliverySameAsBilling
                    ? "Delivery address will be the same as billing details."
                    : "Delivery address will be requested after billing details."}
                </p>
                <button type="button" onClick={() => setOpenStep(4)} className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-teal-700 text-lg font-semibold text-white hover:bg-teal-800">
                  Continue
                </button>
              </div>
            ) : null}
          </div>

          <div className="border-b border-slate-200">
            <button type="button" onClick={() => setOpenStep(openStep === 4 ? null : 4)} className="flex h-16 w-full items-center justify-between text-left">
              <span className="text-base font-semibold leading-none text-teal-800">Step 4: <span className="text-base font-semibold text-slate-900">Delivery Method</span></span>
              {openStep === 4 ? <ChevronUp className="h-6 w-6 text-slate-700" /> : <ChevronDown className="h-6 w-6 text-slate-700" />}
            </button>
            {openStep === 4 ? (
              <div className="pb-8">
                <p className="text-base text-slate-600">Please select the preferred shipping method to use on this order.</p>
                <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                  {shippingOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setShippingMethod(option.value)}
                      className={`rounded-lg border px-4 py-4 text-left transition-colors ${
                        shippingMethod === option.value
                          ? "border-teal-700 bg-teal-50"
                          : "border-slate-300 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          {option.value === "dhl" ? (
                            <span className="inline-flex rounded bg-[#ffcc00] px-3 py-1 text-2xl font-black tracking-tight text-[#d40511]">DHL</span>
                          ) : null}
                          {option.value === "ups" ? (
                            <span className="inline-flex rounded border-2 border-[#5b3a29] bg-[#f4c542] px-3 py-1 text-2xl font-black tracking-tight text-[#5b3a29]">UPS</span>
                          ) : null}
                          {option.value === "fedex" ? (
                            <span className="inline-flex rounded px-1 py-1 text-2xl font-black tracking-tight">
                              <span className="text-[#4d148c]">Fed</span>
                              <span className="text-[#ff6600]">Ex</span>
                            </span>
                          ) : null}
                        </div>
                        <span className="text-sm font-semibold text-slate-500">
                          {shippingMethod === option.value ? "Selected" : "Select"}
                        </span>
                      </div>
                      <p className="mt-3 text-base text-slate-700">
                        {option.label} - {formatCurrency(option.price, currencySettings)}
                      </p>
                    </button>
                  ))}
                </div>
                <h4 className="mt-6 text-xl font-semibold text-slate-700">Add Comments About Your Order</h4>
                <textarea
                  value={orderComment}
                  onChange={(e) => setOrderComment(e.target.value)}
                  className="mt-3 min-h-[170px] w-full rounded border border-slate-300 px-3 py-3 text-base"
                />
                <button type="button" onClick={() => setOpenStep(5)} className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-teal-700 text-lg font-semibold text-white hover:bg-teal-800">
                  Continue
                </button>
              </div>
            ) : null}
          </div>

          <div className="border-b border-slate-200">
            <button type="button" onClick={() => setOpenStep(openStep === 5 ? null : 5)} className="flex h-16 w-full items-center justify-between text-left">
              <span className="text-base font-semibold leading-none text-teal-800">Step 5: <span className="text-base font-semibold text-slate-900">Payment Method</span></span>
              {openStep === 5 ? <ChevronUp className="h-6 w-6 text-slate-700" /> : <ChevronDown className="h-6 w-6 text-slate-700" />}
            </button>
            {openStep === 5 ? (
              <div className="pb-8">
                <p className="text-base text-slate-600">Please select the preferred payment method to use on this order.</p>
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  {enabledPaymentTabs.map((tab) => (
                    <button
                      key={tab.value}
                      type="button"
                      disabled={!tab.enabled}
                      onClick={() => setPaymentTab(tab.value)}
                      className={`h-12 rounded border text-base font-semibold transition-colors ${
                        paymentTab === tab.value
                          ? "border-teal-700 bg-teal-700 text-white"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      } disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="mt-4 rounded-lg border border-slate-300 bg-white p-4">
                  <h5 className="text-base font-semibold text-slate-900">{paymentPanel.title}</h5>
                  <p className="mt-2 text-base text-slate-600">{paymentPanel.description}</p>
                  {paymentTab === "stripe" ? (
                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                      <input className="h-11 rounded border border-slate-300 px-3 text-sm" placeholder="Card Number" />
                      <input className="h-11 rounded border border-slate-300 px-3 text-sm" placeholder="MM / YY" />
                      <input className="h-11 rounded border border-slate-300 px-3 text-sm" placeholder="CVC" />
                    </div>
                  ) : null}
                  {paymentTab === "paypal" ? (
                    <p className="mt-4 rounded bg-slate-50 p-3 text-sm text-slate-700">
                      After you click Confirm Order, you will continue on PayPal.
                    </p>
                  ) : null}
                  {paymentTab === "gpay" || paymentTab === "applepay" ? (
                    <button type="button" className="mt-4 inline-flex h-11 items-center rounded-md border border-slate-900 px-4 text-sm font-semibold text-slate-900">
                      {paymentTab === "gpay" ? "Pay with GPay" : "Pay with Apple Pay"}
                    </button>
                  ) : null}
                </div>
                <h4 className="mt-6 text-xl font-semibold text-slate-700">Add Comments About Your Order</h4>
                <textarea
                  value={orderComment}
                  onChange={(e) => setOrderComment(e.target.value)}
                  className="mt-3 min-h-[170px] w-full rounded border border-slate-300 px-3 py-3 text-base"
                />
                <label className="mt-5 inline-flex items-center gap-2 text-base text-slate-700">
                  <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} />
                  I have read and agree to the <Link href="/info/terms" className="text-teal-800 underline">Terms & Conditions</Link>
                </label>
                <button type="button" onClick={() => setOpenStep(6)} className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-teal-700 text-lg font-semibold text-white hover:bg-teal-800">
                  Continue
                </button>
              </div>
            ) : null}
          </div>

          <div className="border-b border-slate-200">
            <button type="button" onClick={() => setOpenStep(openStep === 6 ? null : 6)} className="flex h-16 w-full items-center justify-between text-left">
              <span className="text-base font-semibold leading-none text-teal-800">Step 6: <span className="text-base font-semibold text-slate-900">Confirm Order</span></span>
              {openStep === 6 ? <ChevronUp className="h-6 w-6 text-slate-700" /> : <ChevronDown className="h-6 w-6 text-slate-700" />}
            </button>
            {openStep === 6 ? (
              <div className="pb-8">
                <div className="overflow-hidden border border-slate-300">
                  <div className="overflow-x-auto">
                  <div className="min-w-[760px]">
                  <div className="grid grid-cols-[2.2fr_1fr_0.9fr_0.9fr_0.9fr] bg-slate-50 text-[15px] font-semibold text-slate-700">
                    <div className="border-r border-slate-300 p-3">Product Name</div>
                    <div className="border-r border-slate-300 p-3">Model</div>
                    <div className="border-r border-slate-300 p-3 text-right">Quantity</div>
                    <div className="border-r border-slate-300 p-3 text-right">Unit Price</div>
                    <div className="p-3 text-right">Total</div>
                  </div>
                  {items.map((item) => (
                    <div key={item.productId} className="grid grid-cols-[2.2fr_1fr_0.9fr_0.9fr_0.9fr] border-t border-slate-300 text-[15px] text-slate-700">
                      <div className="border-r border-slate-300 p-3">
                        <Link href={`/product/${item.slug}`} className="underline decoration-dotted underline-offset-4">
                          {item.title}
                        </Link>
                      </div>
                      <div className="border-r border-slate-300 p-3">model-{item.productId.slice(-4)}</div>
                      <div className="border-r border-slate-300 p-3 text-right">{item.quantity}</div>
                      <div className="border-r border-slate-300 p-3 text-right">{formatCurrency(item.price, currencySettings)}</div>
                      <div className="p-3 text-right">{formatCurrency(item.price * item.quantity, currencySettings)}</div>
                    </div>
                  ))}
                  <div className="grid grid-cols-[4.1fr_0.9fr] border-t border-slate-300 text-[15px]">
                    <div className="border-r border-slate-300 p-3 text-right font-semibold text-slate-700">Sub-Total:</div>
                    <div className="p-3 text-right">{formatCurrency(summary.total, currencySettings)}</div>
                  </div>
                  <div className="grid grid-cols-[4.1fr_0.9fr] border-t border-slate-300 text-[15px]">
                    <div className="border-r border-slate-300 p-3 text-right font-semibold text-slate-700">{shippingLabel} Shipping:</div>
                    <div className="p-3 text-right">{formatCurrency(shippingCost, currencySettings)}</div>
                  </div>
                  <div className="grid grid-cols-[4.1fr_0.9fr] border-t border-slate-300 text-[15px]">
                    <div className="border-r border-slate-300 p-3 text-right font-semibold text-slate-700">Eco Tax (-2.00):</div>
                    <div className="p-3 text-right">{formatCurrency(ecoTaxAmount, currencySettings)}</div>
                  </div>
                  <div className="grid grid-cols-[4.1fr_0.9fr] border-t border-slate-300 text-[15px]">
                    <div className="border-r border-slate-300 p-3 text-right font-semibold text-slate-700">VAT (20%):</div>
                    <div className="p-3 text-right">{formatCurrency(vatAmount, currencySettings)}</div>
                  </div>
                  <div className="grid grid-cols-[4.1fr_0.9fr] border-t border-slate-300 text-[18px] font-semibold">
                    <div className="border-r border-slate-300 p-3 text-right text-slate-700">Total:</div>
                    <div className="p-3 text-right">{formatCurrency(total, currencySettings)}</div>
                  </div>
                  </div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={startPayment}
                  className="mt-7 inline-flex h-14 w-full items-center justify-center rounded-full bg-teal-700 text-2xl font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
                >
                  {loading ? "Please wait..." : "Confirm Order"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {authModalMode === "forgot" ? (
        <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/55 p-4">
          <div className="relative w-full max-w-[480px] rounded-md bg-white px-6 py-6 shadow-2xl">
            <button
              type="button"
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
              onClick={() => setAuthModalMode(null)}
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-2xl font-semibold text-slate-900">Forgotten Password</h3>
            <p className="mt-2 text-sm text-slate-600">Enter your account e-mail, we will help you reset your password.</p>
            <div className="mt-5 space-y-1.5">
              <label className="text-sm font-medium text-slate-700">E-Mail Address</label>
              <input
                type="email"
                value={forgotEmail}
                onChange={(event) => setForgotEmail(event.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                placeholder="E-Mail Address"
              />
            </div>
            <button
              type="button"
              onClick={submitForgotPasswordRequest}
              disabled={authLoading}
              className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-md bg-teal-700 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-70"
            >
              {authLoading ? "Please wait..." : "Send Request"}
            </button>
          </div>
        </div>
      ) : null}

      {authModalMode === "register" ? (
        <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/55 p-4">
          <div className="relative w-full max-w-[640px] max-h-[88vh] overflow-y-auto rounded-md bg-white px-6 py-6 shadow-2xl">
            <button
              type="button"
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
              onClick={() => setAuthModalMode(null)}
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-2xl font-semibold text-slate-900">Your Personal Details</h3>
            <div className="mt-5 space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">First Name</label>
                <input value={registerFirstName} onChange={(event) => setRegisterFirstName(event.target.value)} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500" placeholder="First Name" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Last Name</label>
                <input value={registerLastName} onChange={(event) => setRegisterLastName(event.target.value)} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500" placeholder="Last Name" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">E-Mail *</label>
                <input type="email" value={registerEmail} onChange={(event) => setRegisterEmail(event.target.value)} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500" placeholder="E-Mail" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Telephone</label>
                <input value={registerPhone} onChange={(event) => setRegisterPhone(event.target.value)} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500" placeholder="Telephone" />
              </div>
              <h4 className="pt-1 text-xl font-semibold text-slate-900">Your Password</h4>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Password *</label>
                <input type="password" value={registerPassword} onChange={(event) => setRegisterPassword(event.target.value)} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500" placeholder="Password" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Password Confirm *</label>
                <input type="password" value={registerPasswordConfirm} onChange={(event) => setRegisterPasswordConfirm(event.target.value)} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500" placeholder="Password Confirm" />
              </div>
              <h4 className="pt-1 text-xl font-semibold text-slate-900">Newsletter</h4>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Subscribe</label>
                <div className="flex items-center gap-6 text-sm text-slate-700">
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" name="checkout-register-subscribe" checked={registerOptIn} onChange={() => setRegisterOptIn(true)} />
                    <span>Yes</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" name="checkout-register-subscribe" checked={!registerOptIn} onChange={() => setRegisterOptIn(false)} />
                    <span>No</span>
                  </label>
                </div>
              </div>
              <label className="inline-flex items-center gap-2 pt-1 text-sm text-slate-700">
                <input type="checkbox" checked={registerPolicyAgree} onChange={(event) => setRegisterPolicyAgree(event.target.checked)} />
                <span>
                  I have read and agree to the{" "}
                  <Link href="/info/privacy-policy" className="text-teal-700 underline underline-offset-4">
                    Privacy Policy
                  </Link>
                </span>
              </label>
              <button
                type="button"
                onClick={submitRegisterFromCheckout}
                disabled={authLoading}
                className="inline-flex h-10 w-full items-center justify-center rounded-md bg-teal-700 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-70"
              >
                {authLoading ? "Please wait..." : "Register"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showRegisterSuccess ? (
        <div className="fixed inset-0 z-[261] flex items-center justify-center bg-black/45 p-4">
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
    </div>
  )
}
