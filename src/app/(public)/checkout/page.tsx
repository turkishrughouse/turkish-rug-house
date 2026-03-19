"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronUp, House } from "lucide-react"
import { toast } from "sonner"
import { ResponsiveImage } from "@/components/ui/responsive-image"

import { getCartSummary, getCartUpdateEventName, readCart, type CartItem } from "@/lib/storefront/cart"
import { getAddressCountryConfig } from "@/lib/location/catalog"
import { pickPrimaryImage } from "@/lib/product-images"
import { useStorefrontCurrency } from "@/components/storefront/currency-provider"
import { ForgotPasswordModal } from "@/components/storefront/forgot-password-modal"

type Provider = "stripe" | "paypal" | "gpay" | "applepay" | "paytr"
type PaymentTab = Provider | ""
type ShippingMethod = "dhl" | "ups" | "fedex"

type PaymentMethodOption = {
  value: PaymentTab
  title: string
  shortLabel: string
  description: string
  detail: string
}

type PublicSettings = {
  checkoutEnabled?: boolean
  enableGuestCheckout?: boolean
  defaultCurrency?: string
  currencyPosition?: "left" | "right"
  thousandSeparator?: string
  decimalSeparator?: string
  numberOfDecimals?: number
  paymentDefaultProvider?: Provider
  flatShippingRate?: number
  localPickupRate?: number
  enableTaxes?: boolean
  requirePhoneAtCheckout?: boolean
  requireAddressAtCheckout?: boolean
  paymentProviders?: PaymentMethodOption[]
}

type LocationCountry = {
  code: string
  name: string
}

type SavedAddress = {
  id: string
  label: string
  fullName: string
  phoneNumber: string
  country: string
  countryCode: string
  state: string
  city: string
  addressLine1: string
  addressLine2: string
  postalCode: string
  isDefaultShipping: boolean
  isDefaultBilling: boolean
}

type RegisterFieldKey =
  | "firstName"
  | "lastName"
  | "email"
  | "telephone"
  | "password"
  | "confirmPassword"
  | "privacyPolicy"

type BillingFieldKey =
  | "firstName"
  | "lastName"
  | "email"
  | "telephone"
  | "addressLine1"
  | "city"
  | "postcode"
  | "country"
  | "regionState"

const REQUEST_TIMEOUT_MS = 15000

export default function CheckoutPage() {
  const countriesInitializedRef = useRef(false)
  const statesFetchKeyRef = useRef("")
  const billingSectionRef = useRef<HTMLDivElement | null>(null)
  const paymentSectionRef = useRef<HTMLDivElement | null>(null)
  const billingFieldRefs = useRef<Partial<Record<BillingFieldKey, HTMLInputElement | HTMLSelectElement | null>>>({})

  const [items, setItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState<PublicSettings>({})
  const [settingsLoaded, setSettingsLoaded] = useState(false)
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
  const [country, setCountry] = useState("")
  const [regionState, setRegionState] = useState("")
  const [countryCode, setCountryCode] = useState("")
  const [countryOptions, setCountryOptions] = useState<LocationCountry[]>([])
  const [stateOptions, setStateOptions] = useState<string[]>([])
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [checkoutOption, setCheckoutOption] = useState<"register" | "guest">("guest")
  const [customerSession, setCustomerSession] = useState<null | { id: string; email: string; name: string | null }>(null)
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([])
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState("")
  const [showNewAddressForm, setShowNewAddressForm] = useState(true)
  const [saveCheckoutAddressToProfile, setSaveCheckoutAddressToProfile] = useState(false)
  const [makeCheckoutAddressDefault, setMakeCheckoutAddressDefault] = useState(false)
  const [fallbackBannerImage, setFallbackBannerImage] = useState("")
  const [authModalMode, setAuthModalMode] = useState<null | "forgot">(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [registerFirstName, setRegisterFirstName] = useState("")
  const [registerLastName, setRegisterLastName] = useState("")
  const [registerEmail, setRegisterEmail] = useState("")
  const [registerPhone, setRegisterPhone] = useState("")
  const [registerPassword, setRegisterPassword] = useState("")
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState("")
  const [registerOptIn, setRegisterOptIn] = useState(true)
  const [registerPolicyAgree, setRegisterPolicyAgree] = useState(false)
  const [registerAddressEnabled, setRegisterAddressEnabled] = useState(false)
  const [registerAddressConsent, setRegisterAddressConsent] = useState(false)
  const [registerAddressLine1, setRegisterAddressLine1] = useState("")
  const [registerAddressLine2, setRegisterAddressLine2] = useState("")
  const [registerAddressCity, setRegisterAddressCity] = useState("")
  const [registerAddressState, setRegisterAddressState] = useState("")
  const [registerAddressPostalCode, setRegisterAddressPostalCode] = useState("")
  const [registerAddressCountry, setRegisterAddressCountry] = useState("")
  const [registerAddressCountryCode, setRegisterAddressCountryCode] = useState("")
  const [showRegisterSuccess, setShowRegisterSuccess] = useState(false)
  const [registerErrors, setRegisterErrors] = useState<Partial<Record<RegisterFieldKey, string>>>({})
  const [billingErrors, setBillingErrors] = useState<Partial<Record<BillingFieldKey, string>>>({})
  const [billingErrorSummary, setBillingErrorSummary] = useState("")
  const [paymentError, setPaymentError] = useState("")
  const { selectedCurrency, formatUsd } = useStorefrontCurrency()
  const countryConfig = useMemo(() => getAddressCountryConfig(countryCode), [countryCode])
  const showRegionField = countryConfig.regionMode !== "none"
  const regionAsSelect = countryConfig.regionMode === "select" && stateOptions.length > 0
  const selectedSavedAddress = useMemo(
    () => savedAddresses.find((address) => address.id === selectedSavedAddressId) || null,
    [savedAddresses, selectedSavedAddressId]
  )
  const usingSavedAddress = Boolean(customerSession && selectedSavedAddress && !showNewAddressForm)
  const resolvedShippingAddress = useMemo(() => {
    const source = usingSavedAddress && selectedSavedAddress
      ? selectedSavedAddress
      : {
          addressLine1,
          addressLine2,
          city,
          postalCode: postcode,
          country,
          countryCode,
          state: regionState,
        }

    const normalizedCountryCode =
      source.countryCode?.trim() ||
      countryOptions.find((item) => item.name.toLowerCase() === (source.country || "").trim().toLowerCase())?.code ||
      ""
    const normalizedCountryName =
      source.country?.trim() ||
      countryOptions.find((item) => item.code === normalizedCountryCode)?.name ||
      ""

    return {
      addressLine1: source.addressLine1?.trim() || "",
      addressLine2: source.addressLine2?.trim() || "",
      city: source.city?.trim() || "",
      postcode: source.postalCode?.trim() || "",
      country: normalizedCountryName,
      countryCode: normalizedCountryCode,
      regionState: source.state?.trim() || "",
    }
  }, [addressLine1, addressLine2, city, country, countryCode, countryOptions, postcode, regionState, selectedSavedAddress, usingSavedAddress])
  const billingMode = useMemo<"same_as_shipping" | "saved_address" | "new_address">(() => {
    if (usingSavedAddress) return "saved_address"
    if (deliverySameAsBilling) return "same_as_shipping"
    return "new_address"
  }, [deliverySameAsBilling, usingSavedAddress])

  const inputClassName = "h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition-colors focus:border-teal-700"
  const invalidInputClassName = "border-red-400 bg-red-50/40 focus:border-red-500"

  const setRegisterErrorValue = (field: RegisterFieldKey, _value?: string) => {
    void _value
    setRegisterErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const setBillingErrorValue = (field: BillingFieldKey, _value?: string) => {
    void _value
    setBillingErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
    setBillingErrorSummary("")
  }

  const clearBillingAddressErrors = () => {
    setBillingErrors((current) => {
      const next = { ...current }
      delete next.addressLine1
      delete next.city
      delete next.postcode
      delete next.country
      delete next.regionState
      return next
    })
    setBillingErrorSummary("")
  }

  const applySavedAddress = (address: SavedAddress) => {
    const parts = address.fullName.trim().split(/\s+/)
    setFirstName(parts.shift() || "")
    setLastName(parts.join(" "))
    setCustomerPhone(address.phoneNumber || "")
    setAddressLine1(address.addressLine1 || "")
    setAddressLine2(address.addressLine2 || "")
    setCity(address.city || "")
    setPostcode(address.postalCode || "")
    setCountry(address.country || "")
    setCountryCode(address.countryCode || "")
    setRegionState(address.state || "")
    setSelectedSavedAddressId(address.id)
    setShowNewAddressForm(false)
    setSaveCheckoutAddressToProfile(false)
    setMakeCheckoutAddressDefault(false)
    clearBillingAddressErrors()
  }

  const loadCustomerSession = async () => {
    try {
      const sessionRes = await fetch("/api/auth/session?portal=customer", { cache: "no-store" })
      const sessionJson = (await sessionRes.json().catch(() => ({}))) as {
        authenticated?: boolean
        user?: { id: string; email: string; name: string | null }
      }
      if (!sessionJson.authenticated || !sessionJson.user) {
        setCustomerSession(null)
        setSavedAddresses([])
        setSelectedSavedAddressId("")
        setShowNewAddressForm(true)
        setSaveCheckoutAddressToProfile(false)
        setMakeCheckoutAddressDefault(false)
        return
      }
      setCustomerSession(sessionJson.user)

      const addressesRes = await fetch("/api/account/addresses", { cache: "no-store" })
      if (!addressesRes.ok) {
        setSavedAddresses([])
        setShowNewAddressForm(true)
        return
      }
      const addressJson = (await addressesRes.json().catch(() => ({}))) as {
        addresses?: SavedAddress[]
        defaultShippingAddressId?: string | null
      }
      const nextAddresses = Array.isArray(addressJson.addresses) ? addressJson.addresses : []
      setSavedAddresses(nextAddresses)
      const defaultAddress =
        nextAddresses.find((address) => address.id === addressJson.defaultShippingAddressId) ||
        nextAddresses.find((address) => address.isDefaultShipping) ||
        nextAddresses[0]
      if (defaultAddress) {
        applySavedAddress(defaultAddress)
      } else {
        setShowNewAddressForm(true)
      }
    } catch {
      setCustomerSession(null)
      setSavedAddresses([])
      setSelectedSavedAddressId("")
      setShowNewAddressForm(true)
      setSaveCheckoutAddressToProfile(false)
      setMakeCheckoutAddressDefault(false)
    }
  }

  const validateRegisterFields = () => {
    const nextErrors: Partial<Record<RegisterFieldKey, string>> = {}
    if (!registerFirstName.trim()) nextErrors.firstName = "First name is required."
    if (!registerLastName.trim()) nextErrors.lastName = "Last name is required."
    if (!registerEmail.trim()) nextErrors.email = "Email is required."
    else if (!registerEmail.includes("@")) nextErrors.email = "Enter a valid email address."
    if (!registerPhone.trim()) nextErrors.telephone = "Telephone is required."
    if (!registerPassword) nextErrors.password = "Password is required."
    if (!registerPasswordConfirm) nextErrors.confirmPassword = "Please confirm your password."
    else if (registerPassword !== registerPasswordConfirm) nextErrors.confirmPassword = "Passwords do not match."
    if (!registerPolicyAgree) nextErrors.privacyPolicy = "You must accept the Privacy Policy."

    setRegisterErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const focusBillingField = (field: BillingFieldKey) => {
    setOpenStep(2)
    billingSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    window.setTimeout(() => {
      const target = billingFieldRefs.current[field]
      if (!target) return
      target.focus()
      if ("select" in target) {
        try {
          target.select()
        } catch {
          // no-op
        }
      }
      target.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 120)
  }

  const validateBillingFields = () => {
    const nextErrors: Partial<Record<BillingFieldKey, string>> = {}
    const digitsOnlyPhone = customerPhone.replace(/[^\d+]/g, "")
    const resolvedAddress = resolvedShippingAddress
    const resolvedCountryConfig = getAddressCountryConfig(resolvedAddress.countryCode || countryCode)

    if (!firstName.trim()) nextErrors.firstName = "First name is required."
    if (!lastName.trim()) nextErrors.lastName = "Last name is required."
    if (!customerEmail.trim()) nextErrors.email = "Email is required."
    else if (!customerEmail.includes("@")) nextErrors.email = "Enter a valid email address."
    if (!customerPhone.trim()) nextErrors.telephone = "Phone number is required."
    else if (digitsOnlyPhone.replace(/\D/g, "").length < 6) nextErrors.telephone = "Please enter a valid phone number."
    if (!resolvedAddress.addressLine1.trim()) nextErrors.addressLine1 = "Address line 1 is required."
    if (!resolvedAddress.city.trim()) nextErrors.city = "City is required."
    if (!resolvedAddress.postcode.trim()) nextErrors.postcode = "ZIP / Postal code is required."
    else if (resolvedAddress.postcode.trim().length < 2) nextErrors.postcode = "Please enter a valid ZIP / Postal code."
    if (!resolvedAddress.countryCode?.trim() && !resolvedAddress.country.trim()) nextErrors.country = "Country is required."
    if (resolvedCountryConfig.regionRequired && !resolvedAddress.regionState.trim()) nextErrors.regionState = "State / Region is required."

    setBillingErrors(nextErrors)
    const firstInvalidField = (Object.keys(nextErrors)[0] as BillingFieldKey | undefined) || null
    setBillingErrorSummary(firstInvalidField ? "Please complete the highlighted billing fields." : "")
    return {
      isValid: Object.keys(nextErrors).length === 0,
      firstInvalidField,
    }
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
        const res = await fetch("/api/public/checkout-config", { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json()) as PublicSettings
        if (process.env.NODE_ENV !== "production") {
          console.info("[checkout] received payment providers", data.paymentProviders?.map((provider) => provider.value) || [])
          console.info("[checkout] received checkout config", data)
        }
        setSettings(data)
      } catch {
        // keep defaults
      } finally {
        setSettingsLoaded(true)
      }
    }

    void loadSettings()
  }, [])

  useEffect(() => {
    void loadCustomerSession()
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
        const current = byName || countries.find((item) => item.code === countryCode)
        if (current) {
          setCountryCode(current.code)
          setCountry(current.name)
        }
      } catch {
        // keep defaults
      }
    }
    void loadCountries()
  }, [country, countryCode])

  useEffect(() => {
    if (!countryCode) return
    if (countryConfig.regionMode !== "select") {
      setStateOptions([])
      return
    }
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
        if (countryConfig.regionMode === "select" && regionState.trim() && !states.includes(regionState)) {
          setRegionState("")
        }
      } catch {
        setStateOptions([])
      }
    }
    void loadStates()
  }, [countryCode, country, regionState, countryConfig.regionMode])

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
  const total = summary.total + shippingCost + ecoTaxAmount + vatAmount

  const paymentMethods = useMemo(() => {
    return Array.isArray(settings.paymentProviders) ? settings.paymentProviders : []
  }, [settings.paymentProviders])

  useEffect(() => {
    if (!settingsLoaded || paymentMethods.length > 0) return
    console.warn("Checkout payment methods are not configured; no payment providers are available.")
  }, [
    paymentMethods.length,
    settingsLoaded,
  ])

  const paymentProviderConfigured = useMemo(
    () =>
      paymentMethods.reduce<Record<Provider, boolean>>(
        (acc, method) => {
if (method.value in acc) {
  acc[method.value as Provider] = true
}
          return acc
        },
        { stripe: false, paypal: false, paytr: false, gpay: false, applepay: false }
      ),
    [paymentMethods]
  )

  const isPaymentSelectionValid = useMemo(
    () => Boolean(paymentTab && paymentMethods.some((method) => method.value === paymentTab) && paymentProviderConfigured[paymentTab]),
    [paymentMethods, paymentProviderConfigured, paymentTab]
  )

  const canContinueFromPaymentStep = isPaymentSelectionValid && agreeTerms

  useEffect(() => {
    const defaultProvider = settings.paymentDefaultProvider
    const stripeMethod = paymentMethods.find((method) => method.value === "stripe")
    const preferredMethod =
      (defaultProvider && paymentMethods.find((method) => method.value === defaultProvider)) ||
      stripeMethod ||
      paymentMethods[0]

    if (!preferredMethod) {
      setPaymentTab("" as PaymentTab)
      return
    }

    setPaymentTab((current) => {
      if (current && paymentMethods.some((method) => method.value === current)) return current
      return preferredMethod.value
    })
  }, [paymentMethods, settings.paymentDefaultProvider])

  const provider = paymentTab as Provider
  const paymentPanel = useMemo(() => {
    return paymentMethods.find((method) => method.value === paymentTab) || null
  }, [paymentMethods, paymentTab])

  const startPayment = async () => {
    if (items.length === 0) {
      toast.error("Your basket is empty")
      return
    }

    if (!firstName.trim() || !lastName.trim() || !customerEmail.trim()) {
      toast.error("Please enter first name, last name and email")
      return
    }

    if (settings.requirePhoneAtCheckout && !customerPhone.trim()) {
      toast.error("Please enter your phone number")
      return
    }

    if (!resolvedShippingAddress.countryCode || !resolvedShippingAddress.country) {
      toast.error("Please select a shipping country.")
      return
    }

    if (!resolvedShippingAddress.addressLine1 || !resolvedShippingAddress.city || !resolvedShippingAddress.postcode) {
      toast.error("Please complete your address, city, and postal code")
      return
    }

    const resolvedCountryConfig = getAddressCountryConfig(resolvedShippingAddress.countryCode)
    if (resolvedCountryConfig.regionRequired && !resolvedShippingAddress.regionState) {
      toast.error(`Please enter your ${resolvedCountryConfig.regionLabel.toLowerCase()}`)
      return
    }

    if (!validatePaymentStep(true)) {
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
          addressLine1: resolvedShippingAddress.addressLine1,
          addressLine2: resolvedShippingAddress.addressLine2,
          city: resolvedShippingAddress.city,
          postcode: resolvedShippingAddress.postcode,
          country: resolvedShippingAddress.country,
          countryCode: resolvedShippingAddress.countryCode,
          regionState: resolvedShippingAddress.regionState,
          orderComment: orderComment.trim(),
          saveAddressToProfile: Boolean(customerSession && saveCheckoutAddressToProfile),
          makeDefaultShippingAddress: Boolean(customerSession && saveCheckoutAddressToProfile && makeCheckoutAddressDefault),
          shippingMethod,
          displayCurrency: selectedCurrency,
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
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
      await loadCustomerSession()
      setOpenStep(2)
      toast.success("Login successful")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  const submitRegisterFromCheckout = async () => {
    if (!validateRegisterFields()) {
      toast.error("Please complete the required registration fields")
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
          saveAddressToProfile: registerAddressEnabled && registerAddressConsent && Boolean(registerAddressLine1.trim()),
          address: registerAddressEnabled
            ? {
                label: "Primary",
                fullName,
                phoneNumber: registerPhone.trim(),
                country: registerAddressCountry.trim(),
                countryCode: registerAddressCountryCode.trim(),
                state: registerAddressState.trim(),
                city: registerAddressCity.trim(),
                addressLine1: registerAddressLine1.trim(),
                addressLine2: registerAddressLine2.trim(),
                postalCode: registerAddressPostalCode.trim(),
              }
            : undefined,
        }),
      })
      window.clearTimeout(timeoutId)
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        throw new Error(data.error || "Registration failed")
      }
      setCustomerEmail(registerEmail.trim())
      setCustomerPhone(registerPhone.trim())
      setFirstName(registerFirstName.trim())
      setLastName(registerLastName.trim())
      setLoginEmail(registerEmail.trim())
      setShowRegisterSuccess(true)
      setRegisterFirstName("")
      setRegisterLastName("")
      setRegisterEmail("")
      setRegisterPhone("")
      setRegisterPassword("")
      setRegisterPasswordConfirm("")
      setRegisterAddressEnabled(false)
      setRegisterAddressConsent(false)
      setRegisterAddressLine1("")
      setRegisterAddressLine2("")
      setRegisterAddressCity("")
      setRegisterAddressState("")
      setRegisterAddressPostalCode("")
      setRegisterAddressCountry("")
      setRegisterAddressCountryCode("")
      setRegisterPolicyAgree(false)
      setRegisterErrors({})
      setOpenStep(2)
      toast.success("Account created")
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

  const validatePaymentStep = (showFeedback = false) => {
    let nextError = ""

    if (!paymentTab || !paymentMethods.some((method) => method.value === paymentTab)) {
      nextError = paymentMethods.length === 0
        ? "No payment methods are currently available."
        : "Please select a payment method."
    } else if (!paymentProviderConfigured[paymentTab]) {
      nextError = "Payment method is not properly configured."
    } else if (!agreeTerms) {
      nextError = "Please accept terms & conditions before continuing."
    }

    setPaymentError(nextError)

    if (nextError && showFeedback) {
      paymentSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      toast.error(nextError)
    }

    return !nextError
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[#f5f5f5]">
        <section className="relative overflow-hidden border-b border-slate-200">
          <ResponsiveImage
            src={bannerImage}
            alt="Checkout banner"
            fill
            priority
            sizes="100vw"
            className="absolute inset-0 object-cover object-center"
          />
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
        <ResponsiveImage
          src={bannerImage}
          alt="Checkout banner"
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 object-cover object-center"
        />
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
          <div ref={billingSectionRef} className="border-b border-slate-200">
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
                            setShowRegisterSuccess(false)
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
                    <div
                      className={`grid transition-all duration-200 ease-out ${
                        checkoutOption === "register" ? "mt-6 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="rounded-2xl border border-[#dce3ed] bg-[#f8fafc] p-5 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium text-slate-700">First Name</label>
                              <input value={registerFirstName} onChange={(event) => { setRegisterFirstName(event.target.value); setRegisterErrorValue("firstName", event.target.value) }} className={`${inputClassName} ${registerErrors.firstName ? invalidInputClassName : ""}`} placeholder="First Name" />
                              {registerErrors.firstName ? <p className="text-xs text-red-600">{registerErrors.firstName}</p> : null}
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium text-slate-700">Last Name</label>
                              <input value={registerLastName} onChange={(event) => { setRegisterLastName(event.target.value); setRegisterErrorValue("lastName", event.target.value) }} className={`${inputClassName} ${registerErrors.lastName ? invalidInputClassName : ""}`} placeholder="Last Name" />
                              {registerErrors.lastName ? <p className="text-xs text-red-600">{registerErrors.lastName}</p> : null}
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium text-slate-700">Email</label>
                              <input type="email" value={registerEmail} onChange={(event) => { setRegisterEmail(event.target.value); setRegisterErrorValue("email", event.target.value) }} className={`${inputClassName} ${registerErrors.email ? invalidInputClassName : ""}`} placeholder="Email" />
                              {registerErrors.email ? <p className="text-xs text-red-600">{registerErrors.email}</p> : null}
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium text-slate-700">Telephone</label>
                              <input value={registerPhone} onChange={(event) => { setRegisterPhone(event.target.value); setRegisterErrorValue("telephone", event.target.value) }} className={`${inputClassName} ${registerErrors.telephone ? invalidInputClassName : ""}`} placeholder="Telephone" />
                              {registerErrors.telephone ? <p className="text-xs text-red-600">{registerErrors.telephone}</p> : null}
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium text-slate-700">Password</label>
                              <input type="password" value={registerPassword} onChange={(event) => { setRegisterPassword(event.target.value); setRegisterErrorValue("password", event.target.value) }} className={`${inputClassName} ${registerErrors.password ? invalidInputClassName : ""}`} placeholder="Password" />
                              {registerErrors.password ? <p className="text-xs text-red-600">{registerErrors.password}</p> : null}
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium text-slate-700">Confirm Password</label>
                              <input type="password" value={registerPasswordConfirm} onChange={(event) => { setRegisterPasswordConfirm(event.target.value); setRegisterErrorValue("confirmPassword", event.target.value) }} className={`${inputClassName} ${registerErrors.confirmPassword ? invalidInputClassName : ""}`} placeholder="Confirm Password" />
                              {registerErrors.confirmPassword ? <p className="text-xs text-red-600">{registerErrors.confirmPassword}</p> : null}
                            </div>
                          </div>
                          <div className="mt-4 flex flex-col gap-3">
                            <label className="flex w-full items-start gap-3 text-sm leading-6 text-slate-700">
                              <input className="mt-1 h-4 w-4 shrink-0" type="checkbox" checked={registerAddressEnabled} onChange={(event) => setRegisterAddressEnabled(event.target.checked)} />
                              <span>I want to add my address now</span>
                            </label>
                            {registerAddressEnabled ? (
                              <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2">
                                <input value={registerAddressCountry} onChange={(event) => setRegisterAddressCountry(event.target.value)} className={inputClassName} placeholder="Country" />
                                <input value={registerAddressCountryCode} onChange={(event) => setRegisterAddressCountryCode(event.target.value)} className={inputClassName} placeholder="Country code" />
                                <input value={registerAddressState} onChange={(event) => setRegisterAddressState(event.target.value)} className={inputClassName} placeholder="State / Region" />
                                <input value={registerAddressCity} onChange={(event) => setRegisterAddressCity(event.target.value)} className={inputClassName} placeholder="City" />
                                <input value={registerAddressLine1} onChange={(event) => setRegisterAddressLine1(event.target.value)} className={`${inputClassName} md:col-span-2`} placeholder="Address line 1" />
                                <input value={registerAddressLine2} onChange={(event) => setRegisterAddressLine2(event.target.value)} className={`${inputClassName} md:col-span-2`} placeholder="Address line 2" />
                                <input value={registerAddressPostalCode} onChange={(event) => setRegisterAddressPostalCode(event.target.value)} className={inputClassName} placeholder="ZIP / Postal code" />
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                                  Full name and phone number will be taken from your account details.
                                </div>
                              </div>
                            ) : null}
                            <label className="flex w-full items-start gap-3 text-sm leading-6 text-slate-700">
                              <input className="mt-1 h-4 w-4 shrink-0" type="checkbox" checked={registerPolicyAgree} onChange={(event) => { setRegisterPolicyAgree(event.target.checked); if (event.target.checked) setRegisterErrors((current) => { const next = { ...current }; delete next.privacyPolicy; return next }) }} />
                              <span>
                                I have read and agree to the{" "}
                                <Link href="/info/privacy-policy" className="text-teal-700 underline underline-offset-4">
                                  Privacy Policy
                                </Link>
                              </span>
                            </label>
                            <label className="flex w-full items-start gap-3 text-sm leading-6 text-slate-700">
                              <input className="mt-1 h-4 w-4 shrink-0" type="checkbox" checked={registerOptIn} onChange={(event) => setRegisterOptIn(event.target.checked)} />
                              <span>Subscribe to the newsletter</span>
                            </label>
                            {registerAddressEnabled ? (
                              <label className="flex w-full items-start gap-3 text-sm leading-6 text-slate-700">
                                <input className="mt-1 h-4 w-4 shrink-0" type="checkbox" checked={registerAddressConsent} onChange={(event) => setRegisterAddressConsent(event.target.checked)} />
                                <span>Save this address to my account for faster checkout next time.</span>
                              </label>
                            ) : null}
                            {registerErrors.privacyPolicy ? <p className="text-xs text-red-600">{registerErrors.privacyPolicy}</p> : null}
                          </div>
                          {showRegisterSuccess ? (
                            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                              Account created successfully. Continue with billing details below.
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (checkoutOption === "register") {
                          void submitRegisterFromCheckout()
                          return
                        }
                        setOpenStep(2)
                      }}
                      disabled={authLoading}
                      className="mt-10 inline-flex h-12 w-full items-center justify-center rounded-full bg-teal-700 text-base font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
                    >
                      {checkoutOption === "register" ? (authLoading ? "Please wait..." : "Create Account & Continue") : "Continue"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div ref={billingSectionRef} className="border-b border-slate-200">
            <button type="button" onClick={() => setOpenStep(openStep === 2 ? null : 2)} className="flex h-16 w-full items-center justify-between text-left">
              <span className="text-base font-semibold leading-none text-teal-800">Step 2: <span className="text-base font-semibold text-slate-900">Billing Details</span></span>
              {openStep === 2 ? <ChevronUp className="h-6 w-6 text-slate-700" /> : <ChevronDown className="h-6 w-6 text-slate-700" />}
            </button>
            {openStep === 2 ? (
              <div className="pb-8">
                {billingErrorSummary ? (
                  <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {billingErrorSummary}
                  </div>
                ) : null}
                <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
                  <div>
                    <h3 className="text-2xl font-semibold leading-none text-slate-900">Your Personal Details</h3>
                    <div className="mt-10 space-y-4">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_1fr] sm:items-center sm:gap-4">
                        <label className={`text-base ${billingErrors.firstName ? "text-red-700" : "text-slate-600"}`}>First Name *</label>
                        <div>
                          <input ref={(node) => { billingFieldRefs.current.firstName = node }} value={firstName} onChange={(e) => { setFirstName(e.target.value); setBillingErrorValue("firstName", e.target.value) }} className={`h-11 w-full rounded border px-4 text-base ${billingErrors.firstName ? "border-red-400 bg-red-50/40" : "border-slate-300"}`} placeholder="First Name" />
                          {billingErrors.firstName ? <p className="mt-1 text-xs text-red-600">{billingErrors.firstName}</p> : null}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_1fr] sm:items-center sm:gap-4">
                        <label className={`text-base ${billingErrors.lastName ? "text-red-700" : "text-slate-600"}`}>Last Name *</label>
                        <div>
                          <input ref={(node) => { billingFieldRefs.current.lastName = node }} value={lastName} onChange={(e) => { setLastName(e.target.value); setBillingErrorValue("lastName", e.target.value) }} className={`h-11 w-full rounded border px-4 text-base ${billingErrors.lastName ? "border-red-400 bg-red-50/40" : "border-slate-300"}`} placeholder="Last Name" />
                          {billingErrors.lastName ? <p className="mt-1 text-xs text-red-600">{billingErrors.lastName}</p> : null}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_1fr] sm:items-center sm:gap-4">
                        <label className={`text-base ${billingErrors.email ? "text-red-700" : "text-slate-600"}`}>E-Mail *</label>
                        <div>
                          <input ref={(node) => { billingFieldRefs.current.email = node }} value={customerEmail} onChange={(e) => { setCustomerEmail(e.target.value); setBillingErrorValue("email", e.target.value) }} type="email" className={`h-11 w-full rounded border px-4 text-base ${billingErrors.email ? "border-red-400 bg-red-50/40" : "border-slate-300"}`} placeholder="E-Mail" />
                          {billingErrors.email ? <p className="mt-1 text-xs text-red-600">{billingErrors.email}</p> : null}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_1fr] sm:items-center sm:gap-4">
                        <label className={`text-base ${billingErrors.telephone ? "text-red-700" : "text-slate-600"}`}>Phone Number *</label>
                        <div>
                          <input ref={(node) => { billingFieldRefs.current.telephone = node }} value={customerPhone} onChange={(e) => { setCustomerPhone(e.target.value); setBillingErrorValue("telephone", e.target.value) }} className={`h-11 w-full rounded border px-4 text-base ${billingErrors.telephone ? "border-red-400 bg-red-50/40" : "border-slate-300"}`} placeholder="Phone number" />
                          {billingErrors.telephone ? <p className="mt-1 text-xs text-red-600">{billingErrors.telephone}</p> : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-2xl font-semibold leading-none text-slate-900">Your Address</h3>
                    {customerSession && savedAddresses.length > 0 ? (
                      <div className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Saved addresses</p>
                            <p className="text-xs text-slate-500">Use your saved address or enter a new one for this order.</p>
                          </div>
                          <div className="flex gap-2">
                            <select
                              value={selectedSavedAddressId}
                              onChange={(event) => {
                                const next = savedAddresses.find((address) => address.id === event.target.value)
                                if (next) applySavedAddress(next)
                              }}
                              className="h-11 min-w-[240px] rounded-xl border border-slate-300 bg-white px-4 text-sm"
                            >
                              {savedAddresses.map((address) => (
                                <option key={address.id} value={address.id}>
                                  {address.label}: {address.addressLine1}, {address.city}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                setShowNewAddressForm(true)
                                setSelectedSavedAddressId("")
                                setSaveCheckoutAddressToProfile(false)
                                setMakeCheckoutAddressDefault(false)
                                setBillingErrorSummary("")
                              }}
                              className="rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Use new address
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {usingSavedAddress && selectedSavedAddress ? (
                      <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                        <p className="text-sm font-semibold text-slate-900">Using saved address</p>
                        <p className="mt-1 text-sm text-slate-700">{selectedSavedAddress.fullName}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          {[
                            selectedSavedAddress.addressLine1,
                            selectedSavedAddress.addressLine2,
                            selectedSavedAddress.city,
                            selectedSavedAddress.state,
                            selectedSavedAddress.postalCode,
                            selectedSavedAddress.country,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                        {selectedSavedAddress.phoneNumber ? (
                          <p className="mt-1 text-xs text-slate-500">{selectedSavedAddress.phoneNumber}</p>
                        ) : null}
                      </div>
                    ) : null}
                    <div className={`space-y-4 ${usingSavedAddress ? "mt-6" : "mt-10"}`}>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_1fr] sm:items-center sm:gap-4">
                        <label className="text-base text-slate-600">Company</label>
                        <input value={company} onChange={(e) => setCompany(e.target.value)} className="h-11 rounded border border-slate-300 px-4 text-base" placeholder="Company" />
                      </div>
                      {showNewAddressForm ? (
                        <>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_1fr] sm:items-center sm:gap-4">
                        <label className={`text-base ${billingErrors.addressLine1 ? "text-red-700" : "text-slate-600"}`}>Address 1 *</label>
                        <div>
                          <input ref={(node) => { billingFieldRefs.current.addressLine1 = node }} value={addressLine1} onChange={(e) => { setShowNewAddressForm(true); setSelectedSavedAddressId(""); setAddressLine1(e.target.value); setBillingErrorValue("addressLine1", e.target.value) }} className={`h-11 w-full rounded border px-4 text-base ${billingErrors.addressLine1 ? "border-red-400 bg-red-50/40" : "border-slate-300"}`} placeholder="Address 1" />
                              {billingErrors.addressLine1 ? <p className="mt-1 text-xs text-red-600">{billingErrors.addressLine1}</p> : null}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_1fr] sm:items-center sm:gap-4">
                            <label className="text-base text-slate-600">Address 2</label>
                            <input value={addressLine2} onChange={(e) => { setShowNewAddressForm(true); setSelectedSavedAddressId(""); setAddressLine2(e.target.value) }} className="h-11 rounded border border-slate-300 px-4 text-base" placeholder="Address 2" />
                          </div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_1fr] sm:items-center sm:gap-4">
                            <label className={`text-base ${billingErrors.city ? "text-red-700" : "text-slate-600"}`}>City *</label>
                            <div>
                              <input
                                ref={(node) => { billingFieldRefs.current.city = node }}
                                value={city}
                                onChange={(e) => { setShowNewAddressForm(true); setSelectedSavedAddressId(""); setCity(e.target.value); setBillingErrorValue("city", e.target.value) }}
                                className={`h-11 w-full rounded border px-4 text-base ${billingErrors.city ? "border-red-400 bg-red-50/40" : "border-slate-300"}`}
                                placeholder={countryConfig.cityLabel}
                                autoComplete="address-level2"
                              />
                              {billingErrors.city ? <p className="mt-1 text-xs text-red-600">{billingErrors.city}</p> : null}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_1fr] sm:items-center sm:gap-4">
                            <label className={`text-base ${billingErrors.postcode ? "text-red-700" : "text-slate-600"}`}>{countryConfig.postalCodeLabel} *</label>
                            <div>
                              <input
                                ref={(node) => { billingFieldRefs.current.postcode = node }}
                                value={postcode}
                                onChange={(e) => { setShowNewAddressForm(true); setSelectedSavedAddressId(""); setPostcode(e.target.value); setBillingErrorValue("postcode", e.target.value) }}
                                className={`h-11 w-full rounded border px-4 text-base ${billingErrors.postcode ? "border-red-400 bg-red-50/40" : "border-slate-300"}`}
                                placeholder={countryConfig.postalCodeLabel}
                                autoComplete="postal-code"
                              />
                              {billingErrors.postcode ? <p className="mt-1 text-xs text-red-600">{billingErrors.postcode}</p> : null}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_1fr] sm:items-center sm:gap-4">
                            <label className={`text-base ${billingErrors.country ? "text-red-700" : "text-slate-600"}`}>Country *</label>
                            <div>
                              <select
                                ref={(node) => { billingFieldRefs.current.country = node }}
                                value={countryCode}
                                onChange={(e) => {
                                  const code = e.target.value
                                  setShowNewAddressForm(true)
                                  setSelectedSavedAddressId("")
                                  setCountryCode(code)
                                  const selected = countryOptions.find((item) => item.code === code)
                                  setCountry(selected?.name || "")
                                  setRegionState("")
                                  setBillingErrorValue("country", code)
                                  setBillingErrors((current) => {
                                    if (!current.regionState) return current
                                    const next = { ...current }
                                    delete next.regionState
                                    return next
                                  })
                                }}
                                className={`h-11 w-full rounded border bg-white px-4 text-base ${billingErrors.country ? "border-red-400 bg-red-50/40" : "border-slate-300"}`}
                                autoComplete="country"
                              >
                                <option value="">Select country</option>
                                {countryOptions.length > 0 ? countryOptions.map((item) => (
                                  <option key={item.code} value={item.code}>{item.name}</option>
                                )) : countryCode ? <option value={countryCode}>{country}</option> : null}
                              </select>
                              {billingErrors.country ? <p className="mt-1 text-xs text-red-600">{billingErrors.country}</p> : null}
                            </div>
                          </div>
                          {showRegionField ? (
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_1fr] sm:items-center sm:gap-4">
                              <label className={`text-base ${billingErrors.regionState ? "text-red-700" : "text-slate-600"}`}>
                                {countryConfig.regionLabel}
                                {countryConfig.regionRequired ? " *" : ""}
                              </label>
                              {regionAsSelect ? (
                                <div>
                                  <select
                                    ref={(node) => { billingFieldRefs.current.regionState = node }}
                                    value={regionState}
                                    onChange={(e) => { setShowNewAddressForm(true); setSelectedSavedAddressId(""); setRegionState(e.target.value); setBillingErrorValue("regionState", e.target.value) }}
                                    className={`h-11 w-full rounded border bg-white px-4 text-base ${billingErrors.regionState ? "border-red-400 bg-red-50/40" : "border-slate-300"}`}
                                    autoComplete="address-level1"
                                  >
                                    <option value="">{`Select ${countryConfig.regionLabel}`}</option>
                                    {stateOptions.map((stateName) => (
                                      <option key={stateName} value={stateName}>{stateName}</option>
                                    ))}
                                  </select>
                                  {billingErrors.regionState ? <p className="mt-1 text-xs text-red-600">{billingErrors.regionState}</p> : null}
                                </div>
                              ) : (
                                <div>
                                  <input
                                    ref={(node) => { billingFieldRefs.current.regionState = node }}
                                    value={regionState}
                                    onChange={(e) => { setShowNewAddressForm(true); setSelectedSavedAddressId(""); setRegionState(e.target.value); setBillingErrorValue("regionState", e.target.value) }}
                                    className={`h-11 w-full rounded border px-4 text-base ${billingErrors.regionState ? "border-red-400 bg-red-50/40" : "border-slate-300"}`}
                                    placeholder={countryConfig.regionLabel}
                                    autoComplete="address-level1"
                                  />
                                  {billingErrors.regionState ? <p className="mt-1 text-xs text-red-600">{billingErrors.regionState}</p> : null}
                                </div>
                              )}
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                    {customerSession && showNewAddressForm ? (
                      <div className="mt-5 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <label className="flex items-start gap-3 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4"
                            checked={saveCheckoutAddressToProfile}
                            onChange={(event) => setSaveCheckoutAddressToProfile(event.target.checked)}
                          />
                          <span>Save this address to my account and use it for future orders</span>
                        </label>
                        {saveCheckoutAddressToProfile ? (
                          <label className="flex items-start gap-3 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4"
                              checked={makeCheckoutAddressDefault}
                              onChange={(event) => setMakeCheckoutAddressDefault(event.target.checked)}
                            />
                            <span>Set this as my new default shipping address</span>
                          </label>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
                <label className="mt-8 inline-flex items-center gap-2 text-base text-slate-700">
                  <input type="checkbox" checked={deliverySameAsBilling} onChange={(e) => setDeliverySameAsBilling(e.target.checked)} />
                  My delivery and billing addresses are the same.
                </label>
                <button type="button" onClick={() => {
                  const result = validateBillingFields()
                  if (!result.isValid && result.firstInvalidField) {
                    focusBillingField(result.firstInvalidField)
                    return
                  }
                  setOpenStep(3)
                }} className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-teal-700 text-base font-semibold text-white hover:bg-teal-800">
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
                        {option.label} - {formatUsd(option.price)}
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

          <div ref={paymentSectionRef} className="border-b border-slate-200">
            <button type="button" onClick={() => setOpenStep(openStep === 5 ? null : 5)} className="flex h-16 w-full items-center justify-between text-left">
              <span className="text-base font-semibold leading-none text-teal-800">Step 5: <span className="text-base font-semibold text-slate-900">Payment Method</span></span>
              {openStep === 5 ? <ChevronUp className="h-6 w-6 text-slate-700" /> : <ChevronDown className="h-6 w-6 text-slate-700" />}
            </button>
            {openStep === 5 ? (
              <div className="pb-8">
                <p className="text-base text-slate-600">Please select the preferred payment method to use on this order.</p>
                {paymentError ? (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {paymentError}
                  </div>
                ) : null}
                {paymentMethods.length === 0 ? (
                  <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-medium text-amber-900">
                    No payment methods are currently available.
                  </div>
                ) : (
                  <>
                    <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {paymentMethods.map((method) => {
                        const selected = paymentTab === method.value
                        return (
                          <button
                            key={method.value}
                            type="button"
                            onClick={() => {
                              setPaymentTab(method.value)
                              setPaymentError("")
                            }}
                            className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                              selected
                                ? "border-teal-700 bg-teal-50 shadow-[0_10px_24px_rgba(15,118,110,0.08)]"
                                : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-lg font-semibold text-slate-900">{method.title}</p>
                                <p className="mt-1 text-sm text-slate-600">{method.description}</p>
                              </div>
                              <div className={`inline-flex min-w-[88px] justify-center rounded-full border px-3 py-1 text-xs font-semibold ${
                                selected ? "border-teal-300 bg-white text-teal-800" : "border-slate-200 bg-slate-50 text-slate-600"
                              }`}>
                                {method.shortLabel}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                    {paymentPanel ? (
                      <div className="mt-4 rounded-2xl border border-slate-300 bg-white p-5">
                        <h5 className="text-lg font-semibold text-slate-900">{paymentPanel.title}</h5>
                        <p className="mt-2 text-base text-slate-600">{paymentPanel.description}</p>
                        {paymentTab === "stripe" ? (
                          <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-4 text-sm leading-6 text-slate-700">
                            {paymentPanel.detail} We do not store your card number, expiry date, or CVC in our database.
                          </div>
                        ) : null}
                        {paymentTab === "paypal" ? (
                          <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                            {paymentPanel.detail}
                          </p>
                        ) : null}
                        {paymentTab === "paytr" ? (
                          <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                            {paymentPanel.detail}
                          </p>
                        ) : null}
                        {paymentTab === "gpay" || paymentTab === "applepay" ? (
                          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
                            {paymentPanel.detail}
                          </div>
                        ) : null}
                        <p className="mt-4 text-sm text-slate-500">
                          Your payment is processed securely. We do not store card details.
                        </p>
                      </div>
                    ) : null}
                  </>
                )}
                <h4 className="mt-6 text-xl font-semibold text-slate-700">Add Comments About Your Order</h4>
                <textarea
                  value={orderComment}
                  onChange={(e) => setOrderComment(e.target.value)}
                  className="mt-3 min-h-[170px] w-full rounded border border-slate-300 px-3 py-3 text-base"
                />
                <label className="mt-5 inline-flex items-center gap-2 text-base text-slate-700">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => {
                      setAgreeTerms(e.target.checked)
                      if (e.target.checked) setPaymentError("")
                    }}
                  />
                  I have read and agree to the <Link href="/info/terms" className="text-teal-800 underline">Terms & Conditions</Link>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (!validatePaymentStep(true)) return
                    setOpenStep(6)
                  }}
                  disabled={!canContinueFromPaymentStep}
                  className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-teal-700 text-lg font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:hover:bg-slate-300 disabled:opacity-100"
                >
                  Continue
                </button>
              </div>
            ) : null}
          </div>

          <div className="border-b border-slate-200">
            <button
              type="button"
              onClick={() => {
                if (openStep === 6) {
                  setOpenStep(null)
                  return
                }
                if (!validatePaymentStep(true)) return
                setOpenStep(6)
              }}
              className="flex h-16 w-full items-center justify-between text-left"
            >
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
                      <div className="border-r border-slate-300 p-3 text-right">{formatUsd(item.price)}</div>
                      <div className="p-3 text-right">{formatUsd(item.price * item.quantity)}</div>
                    </div>
                  ))}
                  <div className="grid grid-cols-[4.1fr_0.9fr] border-t border-slate-300 text-[15px]">
                    <div className="border-r border-slate-300 p-3 text-right font-semibold text-slate-700">Sub-Total:</div>
                    <div className="p-3 text-right">{formatUsd(summary.total)}</div>
                  </div>
                  <div className="grid grid-cols-[4.1fr_0.9fr] border-t border-slate-300 text-[15px]">
                    <div className="border-r border-slate-300 p-3 text-right font-semibold text-slate-700">{shippingLabel} Shipping:</div>
                    <div className="p-3 text-right">{formatUsd(shippingCost)}</div>
                  </div>
                  <div className="grid grid-cols-[4.1fr_0.9fr] border-t border-slate-300 text-[15px]">
                    <div className="border-r border-slate-300 p-3 text-right font-semibold text-slate-700">Eco Tax (-2.00):</div>
                    <div className="p-3 text-right">{formatUsd(ecoTaxAmount)}</div>
                  </div>
                  <div className="grid grid-cols-[4.1fr_0.9fr] border-t border-slate-300 text-[15px]">
                    <div className="border-r border-slate-300 p-3 text-right font-semibold text-slate-700">VAT (20%):</div>
                    <div className="p-3 text-right">{formatUsd(vatAmount)}</div>
                  </div>
                  <div className="grid grid-cols-[4.1fr_0.9fr] border-t border-slate-300 text-[18px] font-semibold">
                    <div className="border-r border-slate-300 p-3 text-right text-slate-700">Total:</div>
                    <div className="p-3 text-right">{formatUsd(total)}</div>
                  </div>
                  </div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={loading || !canContinueFromPaymentStep}
                  onClick={startPayment}
                  className="mt-7 inline-flex h-14 w-full items-center justify-center rounded-full bg-teal-700 text-2xl font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:hover:bg-slate-300 disabled:opacity-100"
                >
                  {loading ? "Please wait..." : "Confirm Order"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <ForgotPasswordModal
        open={authModalMode === "forgot"}
        onClose={() => setAuthModalMode(null)}
        initialEmail={loginEmail}
      />

    </div>
  )
}
