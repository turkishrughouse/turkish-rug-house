"use client"
"use no memo"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { SupportRequestPage } from "@/components/storefront/support/support-request-page"
import { AccountMessageThread } from "@/components/storefront/account/account-message-thread"
import { parseProductImages } from "@/lib/product-images"
import { useStorefrontCurrency } from "@/components/storefront/currency-provider"

type SessionUser = {
  id: string
  email: string
  name: string | null
  role: string
}

type CustomerMessage = {
  id: string
  kind: string
  title: string
  content: string
  ctaLabel: string | null
  ctaUrl: string | null
  isRead: boolean
  createdAt: string
}

type OrderItem = { id: string; title: string; quantity: number; price: number }
type OrderEvent = { id: string; title: string; createdAt: string }
type Order = {
  id: string
  orderNumber: string
  status: string
  shipmentStatus: string
  total: number
  trackingCarrier: string | null
  trackingNumber: string | null
  trackingUrl: string | null
  createdAt: string
  details?: {
    paymentStatus?: string | null
    paymentMethod?: string | null
    displayCurrency?: string | null
    displayTotalAmount?: number | null
    exchangeRateUsed?: number | null
  } | null
  items: OrderItem[]
  events: OrderEvent[]
}

type ProfileForm = {
  name: string
  displayName: string
  locale: string
  email: string
  phone: string
  avatarUrl: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  postalCode: string
  country: string
  accentColor: string
}

const allTabs = [
  { key: "overview", label: "Overview" },
  { key: "orders", label: "My Orders" },
  { key: "reviews", label: "Reviews" },
  { key: "support", label: "Support" },
  { key: "notifications", label: "Messages" },
  { key: "settings", label: "Settings" },
] as const

type AccountTabKey = (typeof allTabs)[number]["key"]

type ReviewProduct = {
  id: string
  title: string
  slug: string
  images: string
  orderNumber: string
  purchasedAt: string | null
  review: null | {
    id: string
    rating: number
    comment: string
    createdAt: string
  }
}

function parsePrimaryImage(images: string) {
  return parseProductImages(images)[0] || "/placeholder.jpg"
}

function getReadableTextColor(hex: string) {
  const raw = (hex || "").replace("#", "")
  const normalized = raw.length === 3 ? raw.split("").map((c) => `${c}${c}`).join("") : raw
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return "#ffffff"
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? "#0f172a" : "#ffffff"
}

function isTrackingMessage(message: CustomerMessage) {
  return (
    message.kind === "ORDER" &&
    /tracking|shipment|shipped|carrier/i.test(`${message.title} ${message.content}`)
  )
}

export function AccountDashboard({ user }: { user: SessionUser }) {
  const { formatUsd, formatAmount } = useStorefrontCurrency()
  const profileCacheKey = `account-profile:${user.id}`
  const searchParams = useSearchParams()
  const requestedTab = searchParams.get("tab")
  const normalizedRequestedTab = requestedTab === "preferences" ? "settings" : requestedTab
  const [activeTab, setActiveTab] = useState<AccountTabKey>(
    normalizedRequestedTab === "orders" || normalizedRequestedTab === "notifications" || normalizedRequestedTab === "settings" || normalizedRequestedTab === "reviews" || normalizedRequestedTab === "support" ? normalizedRequestedTab : "overview"
  )
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<Order[]>([])
  const [messages, setMessages] = useState<CustomerMessage[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [profile, setProfile] = useState<ProfileForm>({
    name: user.name || "",
    displayName: user.name || user.email,
    locale: "en_US",
    email: user.email,
    phone: "",
    avatarUrl: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    accentColor: "#0f766e",
  })
  const [profileSaving, setProfileSaving] = useState(false)
  const [isProfileDirty, setIsProfileDirty] = useState(false)
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set())
  const [newMessageOpen, setNewMessageOpen] = useState(false)
  const [newMessageTitle, setNewMessageTitle] = useState("")
  const [newMessageContent, setNewMessageContent] = useState("")
  const [messageActionLoading, setMessageActionLoading] = useState(false)
  const [activeConversationMessageId, setActiveConversationMessageId] = useState<string | null>(null)
  const [reviewProducts, setReviewProducts] = useState<ReviewProduct[]>([])
  const [reviewCanWrite, setReviewCanWrite] = useState(false)
  const [reviewRemaining, setReviewRemaining] = useState(0)
  const [reviewNotice, setReviewNotice] = useState("")
  const [reviewCustomerName, setReviewCustomerName] = useState(user.name || "")
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewTargetProductId, setReviewTargetProductId] = useState("")
  const [reviewRating, setReviewRating] = useState("5")
  const [reviewComment, setReviewComment] = useState("")
  const [reviewPhotoUrl, setReviewPhotoUrl] = useState("")
  const [reviewPhotoUploading, setReviewPhotoUploading] = useState(false)
  const [supportEmail, setSupportEmail] = useState("info@turkishrughouse.com")
  const [supportPhone, setSupportPhone] = useState("+1 (555) 000-0000")
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)

  const accentOptions = ["#0f766e", "#0b3a55", "#2563eb", "#7c3aed", "#be123c", "#ea580c"]
  const storefrontDisplayName = profile.displayName?.trim() || profile.name?.trim() || user.name || user.email

  useEffect(() => {
    document.documentElement.lang = (profile.locale || "en_US").replace("_", "-")
  }, [profile.locale])

  const totalSpent = useMemo(() => orders.reduce((sum, o) => sum + o.total, 0), [orders])
  const getDisplayedOrderTotal = useCallback(
    (order: Order) =>
      typeof order.details?.displayTotalAmount === "number" && order.details.displayCurrency
        ? formatAmount(order.details.displayTotalAmount, order.details.displayCurrency as "USD" | "EUR")
        : formatUsd(order.total),
    [formatAmount, formatUsd]
  )
  const getDisplayedItemPrice = useCallback(
    (order: Order, item: OrderItem) => {
      const displayCurrency = order.details?.displayCurrency as "USD" | "EUR" | undefined
      const exchangeRateUsed = Number(order.details?.exchangeRateUsed || 1)
      if (displayCurrency && displayCurrency !== "USD") {
        return formatAmount(Math.round(item.price * exchangeRateUsed * 100) / 100, displayCurrency)
      }
      return formatUsd(item.price)
    },
    [formatAmount, formatUsd]
  )
  const hasPurchasedOrder = orders.length > 0
  const visibleTabs = useMemo(
    () =>
      allTabs.filter((tab) =>
        hasPurchasedOrder ? true : tab.key !== "orders" && tab.key !== "reviews" && tab.key !== "support"
      ),
    [hasPurchasedOrder]
  )
  const accentColor = profile.accentColor || "#0f766e"
  const accentTextColor = getReadableTextColor(accentColor)
  const latestTrackingMessage = useMemo(
    () => messages.find((message) => !message.isRead && isTrackingMessage(message)) || null,
    [messages]
  )
  const unreadTrackingMessageIds = useMemo(
    () => messages.filter((message) => !message.isRead && isTrackingMessage(message)).map((message) => message.id),
    [messages]
  )
  const allMessagesSelected = messages.length > 0 && messages.every((message) => selectedMessageIds.has(message.id))
  const updateProfileField = useCallback(
    <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
      setIsProfileDirty(true)
      setProfile((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  useEffect(() => {
    setSelectedMessageIds((prev) => {
      const allowed = new Set(messages.map((message) => message.id))
      const next = new Set<string>()
      prev.forEach((id) => {
        if (allowed.has(id)) next.add(id)
      })
      return next
    })
  }, [messages])

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true
    if (!silent) setLoading(true)
    try {
      const [ordersRes, messagesRes, profileRes, settingsRes] = await Promise.all([
        fetch("/api/account/orders", { cache: "no-store" }),
        fetch("/api/account/messages", { cache: "no-store" }),
        fetch("/api/account/profile", { cache: "no-store" }),
        fetch("/api/public/settings", { cache: "no-store" }),
      ])
      const reviewsRes = await fetch("/api/account/reviews", { cache: "no-store" })

      if (ordersRes.ok) {
        const json = await ordersRes.json()
        setOrders(json.orders || [])
      }
      if (messagesRes.ok) {
        const json = await messagesRes.json()
        setMessages(json.messages || [])
        setUnreadCount(Number(json.unreadCount || 0))
      }
      if (profileRes.ok) {
        const json = (await profileRes.json()) as Partial<ProfileForm>
        try {
          window.localStorage.setItem(profileCacheKey, JSON.stringify(json))
        } catch {
          // ignore local storage write errors
        }
        setProfile((prev) => {
          if (isProfileDirty) return prev
          return {
            ...prev,
            ...json,
            name: json.name || prev.name,
            email: json.email || prev.email,
          }
        })
      }
      if (reviewsRes.ok) {
        const json = await reviewsRes.json() as {
          canReview?: boolean
          remainingReviews?: number
          message?: string
          customerName?: string
          products?: ReviewProduct[]
        }
        setReviewCanWrite(Boolean(json.canReview))
        setReviewRemaining(Number(json.remainingReviews || 0))
        setReviewNotice(json.message || "")
        setReviewCustomerName(json.customerName || user.name || "")
        setReviewProducts(Array.isArray(json.products) ? json.products : [])
      }
      if (settingsRes.ok) {
        const json = await settingsRes.json() as { supportEmail?: string; supportPhone?: string }
        setSupportEmail((json.supportEmail || "info@turkishrughouse.com").trim() || "info@turkishrughouse.com")
        setSupportPhone((json.supportPhone || "+1 (555) 000-0000").trim() || "+1 (555) 000-0000")
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [isProfileDirty, profileCacheKey, user.name])

  useEffect(() => {
    try {
      const cached = window.localStorage.getItem(profileCacheKey)
      if (cached) {
        const parsed = JSON.parse(cached) as Partial<ProfileForm>
        setProfile((prev) => ({
          ...prev,
          ...parsed,
          name: parsed.name || prev.name,
          email: parsed.email || prev.email,
        }))
      }
    } catch {
      // ignore local storage read errors
    }
    void refresh()
  }, [profileCacheKey, refresh])

  useEffect(() => {
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh({ silent: true })
      }
    }, 7000)
    const onFocus = () => {
      void refresh({ silent: true })
    }
    window.addEventListener("focus", onFocus)
    return () => {
      window.clearInterval(poll)
      window.removeEventListener("focus", onFocus)
    }
  }, [refresh])

  useEffect(() => {
    const isAllowedRequestedTab =
      normalizedRequestedTab === "notifications" ||
      normalizedRequestedTab === "settings" ||
      normalizedRequestedTab === "overview" ||
      (hasPurchasedOrder &&
        (normalizedRequestedTab === "orders" ||
          normalizedRequestedTab === "reviews" ||
          normalizedRequestedTab === "support"))

    if (isAllowedRequestedTab) {
      setActiveTab(normalizedRequestedTab as AccountTabKey)
    } else {
      setActiveTab("overview")
    }
  }, [hasPurchasedOrder, normalizedRequestedTab])

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab("overview")
    }
  }, [activeTab, visibleTabs])

  const markRead = async (ids: string[], all = false) => {
    const res = await fetch("/api/account/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, all }),
    })
    if (res.ok) await refresh()
  }

  const openTrackingInOrders = async () => {
    if (unreadTrackingMessageIds.length === 0) {
      setActiveTab("orders")
      return
    }
    try {
      await fetch("/api/account/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: unreadTrackingMessageIds }),
      })
      await refresh({ silent: true })
    } catch {
      // no-op: tab switch should still happen
    } finally {
      setActiveTab("orders")
    }
  }

  const uploadAvatar = async (file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("folder", "profiles")
    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    })
    const json = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
    if (!res.ok || !json?.url) {
      throw new Error(json?.error || "Upload failed")
    }
    return json.url
  }

  const uploadReviewPhoto = async (file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("folder", "profile/reviews")
    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    })
    const json = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
    if (!res.ok || !json?.url) {
      throw new Error(json?.error || "Upload failed")
    }
    return json.url
  }

  const saveProfile = async () => {
    if (!profile.email.trim() || !profile.phone.trim()) {
      toast.error("Email and phone are required.")
      return
    }
    setProfileSaving(true)
    try {
      const saveRequest = async () =>
        fetch("/api/account/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profile),
        })

      let res = await saveRequest()
      if (!res.ok) {
        res = await saveRequest()
      }
      const json = (await res.json().catch(() => null)) as { error?: string; profile?: Partial<ProfileForm> } | null
      if (!res.ok) {
        throw new Error(json?.error || "Failed to save profile")
      }
      if (json?.profile) {
        setProfile((prev) => ({ ...prev, ...json.profile }))
        try {
          window.localStorage.setItem(profileCacheKey, JSON.stringify(json.profile))
        } catch {
          // ignore local storage write errors
        }
      }
      const latest = await fetch("/api/account/profile", { cache: "no-store" })
      if (latest.ok) {
        const latestJson = (await latest.json()) as Partial<ProfileForm>
        try {
          window.localStorage.setItem(profileCacheKey, JSON.stringify(latestJson))
        } catch {
          // ignore local storage write errors
        }
        setProfile((prev) => ({ ...prev, ...latestJson }))
      }
      setIsProfileDirty(false)
      await refresh()
      toast.success("Profile saved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save profile")
    } finally {
      setProfileSaving(false)
    }
  }

  const saveAvatarImmediately = async (avatarUrl: string) => {
    const res = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarUrl }),
    })
    const json = (await res.json().catch(() => null)) as { error?: string } | null
    if (!res.ok) throw new Error(json?.error || "Failed to save avatar")
  }

  return (
    <section className="border-t border-slate-200 bg-[#f5f7fb]">
      <div className="mx-auto w-full max-w-[1240px] px-6 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">My Account</h1>
              <p className="text-sm text-slate-600">Welcome back, {storefrontDisplayName}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={async () => {
                  await fetch("/api/auth/logout?portal=customer", { method: "POST" })
                  try {
                    window.localStorage.removeItem("rughouse_customer_authed")
                  } catch {
                    // ignore local storage issues
                  }
                  window.dispatchEvent(new Event("rughouse:auth-updated"))
                  window.location.assign("/")
                }}
              >
                Logout
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {visibleTabs.map((tab) => (
              <div key={tab.key}>
                <button
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className="rounded-md border px-3 py-2 text-sm font-medium transition-colors"
                  style={
                    activeTab === tab.key
                      ? { backgroundColor: accentColor, borderColor: accentColor, color: accentTextColor }
                      : { backgroundColor: "#ffffff", borderColor: accentColor, color: accentColor }
                  }
                >
                  {tab.label}
                  {tab.key === "notifications" ? ` (${unreadCount})` : ""}
                </button>
              </div>
            ))}
          </div>

          {loading ? <p className="mt-6 text-sm text-slate-500">Loading...</p> : null}

          {!loading && activeTab === "overview" ? (
            <div className="mt-6 grid gap-4 md:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Total orders</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{orders.length}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Total spent</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-700">{formatUsd(totalSpent)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Messages</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{unreadCount}</p>
                {unreadCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setActiveTab("notifications")}
                    className="mt-2 text-xs font-medium text-teal-700 hover:underline"
                  >
                    {unreadCount} {unreadCount === 1 ? "message" : "messages"} - view now
                  </button>
                ) : null}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Tracking message</p>
                <div className="mt-2 space-y-1">
                  {latestTrackingMessage ? (
                    <>
                      <p className="text-sm font-semibold text-slate-900">{latestTrackingMessage.title}</p>
                      <p className="line-clamp-2 text-xs text-slate-600">{latestTrackingMessage.content}</p>
                      <button
                        type="button"
                        className="mt-2 text-xs font-semibold text-teal-700 hover:underline"
                        onClick={openTrackingInOrders}
                      >
                        See detail
                      </button>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">No tracking message.</p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {!loading && activeTab === "orders" ? (
            <div className="mt-6 space-y-3">
              {orders.length === 0 ? <p className="text-sm text-slate-500">No orders yet.</p> : null}
              {orders.map((order) => (
                <div key={order.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{order.orderNumber}</p>
                    <p className="text-sm text-slate-600">
                      {order.status} / Shipment: <span className="font-medium">{order.shipmentStatus}</span>
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {new Date(order.createdAt).toLocaleString()} • {getDisplayedOrderTotal(order)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Payment: {order.details?.paymentStatus || "PENDING"} {order.details?.paymentMethod ? `• ${order.details.paymentMethod}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Tracking: {order.trackingCarrier || "-"} {order.trackingNumber ? `(${order.trackingNumber})` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setExpandedOrderId((prev) => (prev === order.id ? null : order.id))}
                      className="text-sm font-medium text-slate-700 hover:text-slate-900 hover:underline"
                    >
                      View details
                    </button>
                    {order.trackingUrl ? (
                      <Link href={order.trackingUrl} target="_blank" className="text-sm font-medium text-teal-700 hover:underline">
                        Track shipment
                      </Link>
                    ) : null}
                  </div>
                  {expandedOrderId === order.id ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="grid gap-3 md:grid-cols-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-500">Order status</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{order.status}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-500">Shipment status</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{order.shipmentStatus}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-500">Payment status</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{order.details?.paymentStatus || "PENDING"}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
                          <p className="mt-1 text-sm font-semibold text-emerald-700">{getDisplayedOrderTotal(order)}</p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Items</p>
                        <div className="mt-2 space-y-2">
                          {order.items.length === 0 ? (
                            <p className="text-sm text-slate-500">No items found.</p>
                          ) : (
                            order.items.map((item) => (
                              <div key={item.id} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                                <span className="font-medium text-slate-900">{item.title}</span>{" "}
                                <span className="text-slate-500">x {item.quantity}</span>{" "}
                                <span className="font-medium">{getDisplayedItemPrice(order, item)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="mt-4">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Timeline</p>
                        <div className="mt-2 space-y-2">
                          {order.events.length === 0 ? (
                            <p className="text-sm text-slate-500">No timeline activity yet.</p>
                          ) : (
                            order.events.map((event) => (
                              <div key={event.id} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                                <p className="text-sm font-medium text-slate-900">{event.title}</p>
                                <p className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {!loading && activeTab === "reviews" ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Review access</p>
                <p className="mt-1 text-sm text-slate-600">{reviewNotice || "You should buy a product to write a review"}</p>
                <p className="mt-2 text-sm font-medium text-slate-800">Remaining review rights: {reviewRemaining}</p>
              </div>

              {reviewProducts.length === 0 ? (
                <p className="text-sm text-slate-500">You should buy a product to write a review</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {reviewProducts.map((item) => (
                    <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                          <img src={parsePrimaryImage(item.images)} alt={item.title} className="h-full w-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
                          <p className="mt-1 text-xs text-slate-500">Order: {item.orderNumber}</p>
                          {item.review ? (
                            <p className="mt-2 text-xs text-emerald-700">Reviewed ({item.review.rating}/5)</p>
                          ) : (
                            <p className="mt-2 text-xs text-slate-500">Not reviewed yet</p>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!reviewCanWrite || Boolean(item.review)}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          onClick={() => {
                            setReviewTargetProductId(item.id)
                            setReviewRating("5")
                            setReviewComment("")
                            setReviewPhotoUrl("")
                            setReviewModalOpen(true)
                          }}
                        >
                          {item.review ? "Already reviewed" : "Write review"}
                        </button>
                        <Link href={`/product/${item.slug}`} className="text-xs font-medium text-teal-700 hover:underline">
                          View product
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {!loading && activeTab === "notifications" ? (
            <div className="mt-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={allMessagesSelected}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedMessageIds(new Set(messages.map((message) => message.id)))
                      } else {
                        setSelectedMessageIds(new Set())
                      }
                    }}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Select all messages
                </label>
                <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                  onClick={() => setNewMessageOpen((prev) => !prev)}
                >
                  New message
                </button>
                <button
                  type="button"
                  disabled={selectedMessageIds.size === 0 || messageActionLoading}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  onClick={async () => {
                    setMessageActionLoading(true)
                    try {
                      const res = await fetch("/api/account/messages", {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ids: Array.from(selectedMessageIds) }),
                      })
                      if (!res.ok) throw new Error("Failed to delete messages")
                      setSelectedMessageIds(new Set())
                      await refresh()
                      toast.success("Selected messages deleted")
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Failed to delete messages")
                    } finally {
                      setMessageActionLoading(false)
                    }
                  }}
                >
                  Delete selected
                </button>
                <button
                  type="button"
                  disabled={messageActionLoading}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                  onClick={() => markRead([], true)}
                >
                  Mark all as read
                </button>
                </div>
              </div>
              {activeConversationMessageId ? (
                <div className="pt-2">
                  <AccountMessageThread
                    user={{ id: user.id, email: user.email, name: user.name }}
                    messageId={activeConversationMessageId}
                    embedded
                    onBack={() => setActiveConversationMessageId(null)}
                  />
                </div>
              ) : null}
              {newMessageOpen ? (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">Write a message to support</p>
                  <div className="mt-3 space-y-2">
                    <input
                      value={newMessageTitle}
                      onChange={(e) => setNewMessageTitle(e.target.value)}
                      className="h-10 w-full rounded border border-slate-300 px-3 text-sm"
                      placeholder="Subject"
                    />
                    <textarea
                      value={newMessageContent}
                      onChange={(e) => setNewMessageContent(e.target.value)}
                      className="min-h-[100px] w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Write your message about shipment, order issue or complaint..."
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                        onClick={() => {
                          setNewMessageOpen(false)
                          setNewMessageTitle("")
                          setNewMessageContent("")
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={messageActionLoading}
                        className="rounded-md border border-teal-600 bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
                        onClick={async () => {
                          if (newMessageTitle.trim().length < 2 || newMessageContent.trim().length < 5) {
                            toast.error("Please write subject and message")
                            return
                          }
                          setMessageActionLoading(true)
                          try {
                            const res = await fetch("/api/account/messages", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                title: newMessageTitle.trim(),
                                content: newMessageContent.trim(),
                              }),
                            })
                            const json = await res.json().catch(() => null as null | { error?: string })
                            if (!res.ok) throw new Error(json?.error || "Failed to send message")
                            setNewMessageTitle("")
                            setNewMessageContent("")
                            setNewMessageOpen(false)
                            await refresh()
                            toast.success("Message sent")
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : "Failed to send message")
                          } finally {
                            setMessageActionLoading(false)
                          }
                        }}
                      >
                        Send message
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
              {messages.length === 0 ? <p className="text-sm text-slate-500">No messages yet.</p> : null}
              {messages.map((message) => (
                <div key={message.id} className={`rounded-xl border p-4 ${message.isRead ? "border-slate-200 bg-white" : "border-blue-200 bg-blue-50/40"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedMessageIds.has(message.id)}
                        onChange={(e) =>
                          setSelectedMessageIds((prev) => {
                            const next = new Set(prev)
                            if (e.target.checked) next.add(message.id)
                            else next.delete(message.id)
                            return next
                          })
                        }
                        className="mt-1 h-4 w-4 rounded border-slate-300"
                      />
                      <div>
                      <button
                        type="button"
                        onClick={() => setActiveConversationMessageId(message.id)}
                        className="block w-full rounded text-left hover:bg-slate-100/70"
                      >
                        <p className="text-sm font-semibold text-slate-900">{message.title}</p>
                        <p className="mt-1 text-sm text-slate-700">{message.content}</p>
                        <p className="mt-1 text-xs text-slate-500">{new Date(message.createdAt).toLocaleString()}</p>
                        <p className="mt-1 text-xs font-semibold text-teal-700">Start conversation</p>
                      </button>
                      </div>
                    </div>
                    {!message.isRead ? (
                      <button
                        type="button"
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-white"
                        onClick={() => markRead([message.id])}
                      >
                        Mark read
                      </button>
                    ) : null}
                  </div>
                  {message.ctaUrl && message.ctaLabel ? (
                    <Link
                      href={message.ctaUrl}
                      className="mt-2 inline-block text-sm font-medium text-teal-700 hover:underline"
                      onClick={() => {
                        if (!message.isRead) {
                          void markRead([message.id])
                        }
                      }}
                    >
                      {message.ctaLabel}
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {!loading && activeTab === "support" ? (
            <div className="mt-6">
              <SupportRequestPage supportEmail={supportEmail} supportPhone={supportPhone} />
            </div>
          ) : null}

          {!loading && activeTab === "settings" ? (
            <div className="mt-6 space-y-3">
              <div className="rounded-xl border bg-white p-4" style={{ borderColor: accentColor }}>
                <p className="text-sm font-semibold text-slate-900">Profile settings</p>
                <p className="mt-1 text-xs text-slate-500">Keep your contact and address details updated for order tracking and delivery messages.</p>

                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <div className="h-16 w-16 overflow-hidden rounded-full border bg-slate-50" style={{ borderColor: accentColor }}>
                    {profile.avatarUrl ? (
                      <img src={profile.avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-slate-500">
                        {(profile.name || profile.email).slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <label className="rounded-md border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer" style={{ borderColor: accentColor }}>
                    Upload photo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        try {
                          const url = await uploadAvatar(file)
                          setProfile((prev) => ({ ...prev, avatarUrl: url }))
                          await saveAvatarImmediately(url)
                          await refresh()
                          toast.success("Photo saved")
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Upload failed")
                        }
                      }}
                    />
                  </label>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <input
                    value={profile.name}
                    onChange={(e) => updateProfileField("name", e.target.value)}
                    className="h-11 rounded border bg-white px-3 text-sm"
                    style={{ borderColor: accentColor }}
                    placeholder="Full name"
                  />
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => updateProfileField("email", e.target.value)}
                    className="h-11 rounded border bg-white px-3 text-sm"
                    style={{ borderColor: accentColor }}
                    placeholder="Email"
                  />
                  <input
                    value={profile.phone}
                    onChange={(e) => updateProfileField("phone", e.target.value)}
                    className="h-11 rounded border bg-white px-3 text-sm"
                    style={{ borderColor: accentColor }}
                    placeholder="Phone"
                  />
                  <input
                    value={profile.addressLine1}
                    onChange={(e) => updateProfileField("addressLine1", e.target.value)}
                    className="h-11 rounded border bg-white px-3 text-sm"
                    style={{ borderColor: accentColor }}
                    placeholder="Address line 1"
                  />
                  <input
                    value={profile.addressLine2}
                    onChange={(e) => updateProfileField("addressLine2", e.target.value)}
                    className="h-11 rounded border bg-white px-3 text-sm"
                    style={{ borderColor: accentColor }}
                    placeholder="Address line 2"
                  />
                  <input
                    value={profile.city}
                    onChange={(e) => updateProfileField("city", e.target.value)}
                    className="h-11 rounded border bg-white px-3 text-sm"
                    style={{ borderColor: accentColor }}
                    placeholder="City"
                  />
                  <input
                    value={profile.state}
                    onChange={(e) => updateProfileField("state", e.target.value)}
                    className="h-11 rounded border bg-white px-3 text-sm"
                    style={{ borderColor: accentColor }}
                    placeholder="State"
                  />
                  <input
                    value={profile.postalCode}
                    onChange={(e) => updateProfileField("postalCode", e.target.value)}
                    className="h-11 rounded border bg-white px-3 text-sm"
                    style={{ borderColor: accentColor }}
                    placeholder="Postal code"
                  />
                  <input
                    value={profile.country}
                    onChange={(e) => updateProfileField("country", e.target.value)}
                    className="h-11 rounded border bg-white px-3 text-sm md:col-span-2"
                    style={{ borderColor: accentColor }}
                    placeholder="Country"
                  />
                </div>

                <div className="mt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Theme color</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {accentOptions.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => updateProfileField("accentColor", color)}
                        className={`h-8 w-8 rounded-full border-2 ${profile.accentColor === color ? "border-slate-900" : "border-transparent"}`}
                        style={{ backgroundColor: color }}
                        aria-label={`Select theme ${color}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={saveProfile}
                    disabled={profileSaving}
                    className="rounded-md border bg-white px-4 py-2 text-sm font-semibold disabled:opacity-70"
                    style={{ borderColor: accentColor, color: accentColor }}
                  >
                    {profileSaving ? "Updating..." : "Update profile"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

        </div>
      </div>

      {reviewModalOpen ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Write your review</h3>
              <button
                type="button"
                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                onClick={() => setReviewModalOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <input
                value={reviewCustomerName}
                onChange={(e) => setReviewCustomerName(e.target.value)}
                className="h-10 w-full rounded border border-slate-300 px-3 text-sm"
                placeholder="Your name"
              />
              <select
                value={reviewRating}
                onChange={(e) => setReviewRating(e.target.value)}
                className="h-10 w-full rounded border border-slate-300 px-3 text-sm"
              >
                <option value="5">5 stars</option>
                <option value="4">4 stars</option>
                <option value="3">3 stars</option>
                <option value="2">2 stars</option>
                <option value="1">1 star</option>
              </select>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                className="min-h-[120px] w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Write your review..."
              />
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-600">Upload home photo with the rug (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setReviewPhotoUploading(true)
                    try {
                      const uploaded = await uploadReviewPhoto(file)
                      setReviewPhotoUrl(uploaded)
                      toast.success("Photo uploaded")
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Upload failed")
                    } finally {
                      setReviewPhotoUploading(false)
                      e.target.value = ""
                    }
                  }}
                  className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-2 file:text-sm"
                />
                {reviewPhotoUrl ? (
                  <div className="h-28 w-full overflow-hidden rounded-md border border-slate-200">
                    <img src={reviewPhotoUrl} alt="Review upload preview" className="h-full w-full object-cover" />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReviewModalOpen(false)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reviewSubmitting || reviewPhotoUploading}
                className="rounded-md border border-teal-600 bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
                onClick={async () => {
                  if (!reviewTargetProductId) return
                  if (reviewComment.trim().length < 3) {
                    toast.error("Please write a longer review")
                    return
                  }
                  setReviewSubmitting(true)
                  try {
                    const res = await fetch("/api/account/reviews", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        productId: reviewTargetProductId,
                        name: reviewCustomerName.trim(),
                        rating: Number(reviewRating || "5"),
                        comment: reviewComment.trim(),
                        photoUrl: reviewPhotoUrl || null,
                      }),
                    })
                    const json = await res.json().catch(() => null as null | { error?: string })
                    if (!res.ok) throw new Error(json?.error || "Failed to submit review")
                    toast.success("Review submitted")
                    setReviewModalOpen(false)
                    await refresh()
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Failed to submit review")
                  } finally {
                    setReviewSubmitting(false)
                  }
                }}
              >
                {reviewSubmitting ? "Submitting..." : "Submit review"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
