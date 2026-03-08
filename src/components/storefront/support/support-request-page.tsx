"use client"
"use no memo"

import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  SUPPORT_CATEGORIES,
  SUPPORT_CONTACT_OPTIONS,
  getSupportCategoryLabel,
  type SupportCategory,
} from "@/lib/support"

type SessionUser = {
  id: string
  email: string
  name: string | null
}

type SessionResponse = {
  authenticated: boolean
  user?: SessionUser
}

type OrderOption = {
  id: string
  orderNumber: string
}

type FaqItem = {
  id: string
  category: string
  question: string
  answerShort: string
  answerLong: string
  tags: string[]
  isFeatured: boolean
}

type FormState = {
  name: string
  category: SupportCategory | ""
  orderShippingOrderNumber: string
  orderShippingEmail: string
  shippingCountry: string
  orderIssueType: string
  newAddress: string
  phone: string
  afterOrderNumber: string
  afterProductRef: string
  afterTopic: string
  customRequestType: string
  sizeWidth: string
  sizeLength: string
  sizeUnit: string
  budgetRange: string
  deadlineDate: string
  invoiceOrderNumber: string
  invoiceRequestType: string
  paymentMethod: string
  errorDescription: string
  wholesaleCompanyName: string
  wholesaleCountry: string
  wholesaleApproxQuantity: string
  wholesaleTargetStyles: string[]
  wholesaleMessage: string
  productInfoRef: string
  productInfoNeed: string
  accountEmail: string
  accountIssueType: string
  otherSubject: string
  otherMessage: string
}

const INITIAL_FORM: FormState = {
  name: "",
  category: "",
  orderShippingOrderNumber: "",
  orderShippingEmail: "",
  shippingCountry: "",
  orderIssueType: "",
  newAddress: "",
  phone: "",
  afterOrderNumber: "",
  afterProductRef: "",
  afterTopic: "",
  customRequestType: "",
  sizeWidth: "",
  sizeLength: "",
  sizeUnit: "cm",
  budgetRange: "",
  deadlineDate: "",
  invoiceOrderNumber: "",
  invoiceRequestType: "",
  paymentMethod: "",
  errorDescription: "",
  wholesaleCompanyName: "",
  wholesaleCountry: "",
  wholesaleApproxQuantity: "",
  wholesaleTargetStyles: [],
  wholesaleMessage: "",
  productInfoRef: "",
  productInfoNeed: "",
  accountEmail: "",
  accountIssueType: "",
  otherSubject: "",
  otherMessage: "",
}

const TARGET_STYLE_OPTIONS = ["Vintage", "Modern", "Oushak", "Kilim", "Hand-Knotted", "Custom Blend"]

async function uploadFiles(files: File[]) {
  if (files.length === 0) return [] as string[]
  const responses = await Promise.all(
    files.map(async (file) => {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("folder", "support")
      const res = await fetch("/api/upload", { method: "POST", body: formData })
      const json = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
      if (!res.ok || !json?.url) throw new Error(json?.error || "Failed to upload file.")
      return json.url
    })
  )
  return responses
}

export function SupportRequestPage({
  supportEmail,
  supportPhone,
}: {
  supportEmail: string
  supportPhone: string
}) {
  const formRef = useRef<HTMLDivElement | null>(null)
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null)
  const [orders, setOrders] = useState<OrderOption[]>([])
  const [faqs, setFaqs] = useState<FaqItem[]>([])
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null)
  const [viewedFaqIds, setViewedFaqIds] = useState<Set<string>>(new Set())
  const [damageFiles, setDamageFiles] = useState<File[]>([])
  const [inspirationFiles, setInspirationFiles] = useState<File[]>([])
  const [screenshotFiles, setScreenshotFiles] = useState<File[]>([])
  const [isLoadingFaqs, setIsLoadingFaqs] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [lastTicketId, setLastTicketId] = useState<string | null>(null)
  const [isMobileClient, setIsMobileClient] = useState(false)

  const isLoggedIn = Boolean(sessionUser)

  useEffect(() => {
    setIsMobileClient(/Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent))
  }, [])

  useEffect(() => {
    const loadSession = async () => {
      const res = await fetch("/api/auth/session", { cache: "no-store" })
      const json = (await res.json().catch(() => null)) as SessionResponse | null
      if (!res.ok || !json?.authenticated || !json.user) return
      setSessionUser(json.user)
      setForm((prev) => ({
        ...prev,
        name: prev.name || json.user?.name || "",
        orderShippingEmail: prev.orderShippingEmail || json.user?.email || "",
        accountEmail: prev.accountEmail || json.user?.email || "",
      }))

      const orderRes = await fetch("/api/account/orders", { cache: "no-store" })
      if (!orderRes.ok) return
      const orderJson = (await orderRes.json().catch(() => null)) as { orders?: OrderOption[] } | null
      if (!orderJson?.orders) return
      setOrders(orderJson.orders.map((order) => ({ id: order.id, orderNumber: order.orderNumber })))
    }
    void loadSession()
  }, [])

  useEffect(() => {
    const loadFaqs = async () => {
      setIsLoadingFaqs(true)
      const query = form.category ? `?category=${encodeURIComponent(form.category)}` : ""
      const res = await fetch(`/api/support/faqs${query}`, { cache: "no-store" })
      const json = (await res.json().catch(() => null)) as { faqs?: FaqItem[]; error?: string } | null
      if (!res.ok) {
        toast.error(json?.error || "Failed to load suggested answers.")
        setFaqs([])
        setIsLoadingFaqs(false)
        return
      }
      setFaqs(json?.faqs || [])
      setIsLoadingFaqs(false)
    }
    void loadFaqs()
  }, [form.category])

  const onField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const selectedSubType =
    form.category === "ORDER_SHIPPING"
      ? form.orderIssueType
      : form.category === "AFTER_PURCHASE"
        ? form.afterTopic
        : form.category === "CUSTOM_SPECIAL_ORDERS"
          ? form.customRequestType
          : form.category === "INVOICE_PAYMENT"
            ? form.invoiceRequestType
            : form.category === "PRODUCT_INFORMATION"
              ? form.productInfoNeed
              : form.category === "ACCOUNT_WEBSITE_HELP"
                ? form.accountIssueType
                : ""

  const contactConfig = form.category ? SUPPORT_CONTACT_OPTIONS[form.category] : null
  const categoryLabel = form.category ? getSupportCategoryLabel(form.category) : "General support"
  const whatsappDigits = supportPhone.replace(/\D/g, "")
  const whatsappText = `Hi, I need help with: ${categoryLabel} - ${selectedSubType || "General"}. Ticket: ${
    lastTicketId || "not created yet"
  }.`
  const whatsappHref = isMobileClient
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(whatsappText)}`
    : `https://web.whatsapp.com/send?phone=${whatsappDigits}&text=${encodeURIComponent(whatsappText)}`
  const emailSubject = `Support request: ${categoryLabel}${selectedSubType ? ` - ${selectedSubType}` : ""}`
  const emailHref = `mailto:${supportEmail}?subject=${encodeURIComponent(emailSubject)}`

  const faqTitle = useMemo(() => "Suggested answers", [])

  const openFaq = (faqId: string) => {
    setExpandedFaqId((prev) => (prev === faqId ? null : faqId))
    setViewedFaqIds((prev) => {
      const next = new Set(prev)
      next.add(faqId)
      return next
    })
  }

  const renderFaqCards = () => (
    <div className="space-y-3">
      {isLoadingFaqs ? <p className="text-sm text-slate-500">Loading suggestions...</p> : null}
      {!isLoadingFaqs && faqs.length === 0 ? (
        <p className="text-sm text-slate-500">Choose a topic to see relevant answers before sending your request.</p>
      ) : null}
      {faqs.map((faq) => {
        const open = expandedFaqId === faq.id
        return (
          <article key={faq.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <button
              type="button"
              onClick={() => openFaq(faq.id)}
              className="w-full text-left text-sm font-semibold text-slate-900 hover:text-emerald-700"
            >
              {faq.question}
            </button>
            <p className="mt-2 text-sm text-slate-600">{faq.answerShort}</p>
            <button type="button" onClick={() => openFaq(faq.id)} className="mt-2 text-xs font-semibold text-emerald-700 hover:underline">
              Read more
            </button>
            {open ? (
              <div className="mt-3 space-y-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="text-sm leading-6 text-slate-700">{faq.answerLong}</p>
                <button
                  type="button"
                  onClick={() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className="rounded-md border border-emerald-600 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                >
                  Still need help?
                </button>
              </div>
            ) : null}
          </article>
        )
      })}
    </div>
  )

  const renderContactOptions = () => (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-slate-900">Contact options</h3>
      <p className="text-sm text-slate-600">
        {contactConfig?.text || "Pick your preferred support channel."}
      </p>
      <p className="text-xs text-slate-500">
        {contactConfig?.expectation || "Typically replies within 24 hours."}
      </p>
      <div className="grid gap-2">
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            contactConfig?.primary === "WHATSAPP"
              ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          WhatsApp
        </a>
        <a
          href={emailHref}
          className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            contactConfig?.primary === "EMAIL"
              ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          Email
        </a>
      </div>
      <p className="text-xs text-slate-500">
        Message template includes category, subtype, and ticket reference.
      </p>
    </div>
  )

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.category) {
      toast.error("Please select a topic.")
      return
    }

    setSubmitting(true)
    try {
      const attachments: string[] = []
      if (form.category === "AFTER_PURCHASE" && form.afterTopic === "Damage on arrival") {
        attachments.push(...(await uploadFiles(damageFiles)))
      }
      if (form.category === "CUSTOM_SPECIAL_ORDERS") {
        attachments.push(...(await uploadFiles(inspirationFiles)))
      }
      if (form.category === "ACCOUNT_WEBSITE_HELP") {
        attachments.push(...(await uploadFiles(screenshotFiles)))
      }

      let subType = ""
      let orderNumber = ""
      let payload: Record<string, unknown> = {}
      let email = ""

      if (form.category === "ORDER_SHIPPING") {
        subType = form.orderIssueType
        orderNumber = form.orderShippingOrderNumber
        email = isLoggedIn ? sessionUser?.email || "" : form.orderShippingEmail
        payload = {
          shippingCountry: form.shippingCountry,
          newAddress: form.orderIssueType === "Address change" ? form.newAddress : "",
          phone: form.orderIssueType === "Address change" ? form.phone : "",
        }
      } else if (form.category === "AFTER_PURCHASE") {
        subType = form.afterTopic
        orderNumber = form.afterOrderNumber
        email = sessionUser?.email || form.accountEmail
        payload = {
          productRef: form.afterProductRef,
        }
      } else if (form.category === "CUSTOM_SPECIAL_ORDERS") {
        subType = form.customRequestType
        email = sessionUser?.email || form.accountEmail
        payload = {
          sizeWidth: form.customRequestType === "Custom size" ? form.sizeWidth : "",
          sizeLength: form.customRequestType === "Custom size" ? form.sizeLength : "",
          sizeUnit: form.customRequestType === "Custom size" ? form.sizeUnit : "",
          budgetRange: form.budgetRange,
          deadlineDate: form.deadlineDate,
        }
      } else if (form.category === "INVOICE_PAYMENT") {
        subType = form.invoiceRequestType
        orderNumber = form.invoiceOrderNumber
        email = sessionUser?.email || form.accountEmail
        payload = {
          paymentMethod: form.invoiceRequestType === "Payment issue" ? form.paymentMethod : "",
          errorDescription: form.invoiceRequestType === "Payment issue" ? form.errorDescription : "",
        }
      } else if (form.category === "WHOLESALE_TRADE") {
        email = sessionUser?.email || form.accountEmail
        payload = {
          companyName: form.wholesaleCompanyName,
          country: form.wholesaleCountry,
          approxQuantity: form.wholesaleApproxQuantity,
          targetStyles: form.wholesaleTargetStyles,
          message: form.wholesaleMessage,
        }
      } else if (form.category === "PRODUCT_INFORMATION") {
        subType = form.productInfoNeed
        email = sessionUser?.email || form.accountEmail
        payload = {
          productRef: form.productInfoRef,
        }
      } else if (form.category === "ACCOUNT_WEBSITE_HELP") {
        subType = form.accountIssueType
        email = form.accountEmail || sessionUser?.email || ""
        payload = {}
      } else if (form.category === "OTHER") {
        email = sessionUser?.email || form.accountEmail
        payload = {
          subject: form.otherSubject,
          message: form.otherMessage,
        }
      }

      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: form.category,
          subType: subType || null,
          orderNumber: orderNumber || null,
          email,
          name: form.name || sessionUser?.name || null,
          payload,
          attachments,
          faqViewed: Array.from(viewedFaqIds),
        }),
      })
      const json = (await res.json().catch(() => null)) as
        | { error?: string; details?: string[]; ticket?: { id: string } }
        | null
      if (!res.ok) {
        const detail = Array.isArray(json?.details) ? json.details[0] : null
        throw new Error(detail || json?.error || "Failed to send support request.")
      }
      toast.success(`Support request sent. Ticket ID: ${json?.ticket?.id || "created"}`)
      setLastTicketId(json?.ticket?.id || null)
      setForm({
        ...INITIAL_FORM,
        name: sessionUser?.name || "",
        orderShippingEmail: sessionUser?.email || "",
        accountEmail: sessionUser?.email || "",
      })
      setDamageFiles([])
      setInspirationFiles([])
      setScreenshotFiles([])
      setViewedFaqIds(new Set())
      setExpandedFaqId(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send support request.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="border-t border-slate-200 bg-[#f5f7fb]">
      <div className="mx-auto w-full max-w-[1240px] px-5 py-8 md:px-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
          <div ref={formRef} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <h1 className="text-2xl font-semibold text-slate-900">Support Request</h1>
            <p className="mt-2 text-sm text-slate-600">Tell us what you need and we will route your request to the right team.</p>
            {lastTicketId ? (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Request received. Ticket ID: <span className="font-semibold">{lastTicketId}</span>
              </div>
            ) : null}

            <form className="mt-6 space-y-4" onSubmit={submit}>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-800">How can we help?</label>
                <select
                  value={form.category}
                  onChange={(event) => onField("category", event.target.value as SupportCategory | "")}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-600"
                >
                  <option value="">Select a topic</option>
                  {SUPPORT_CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-800">Full name (optional)</label>
                <input
                  value={form.name}
                  onChange={(event) => onField("name", event.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600"
                  placeholder="Your name"
                />
              </div>

              {form.category === "ORDER_SHIPPING" ? (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-800">Order Number</label>
                    {isLoggedIn ? (
                      <select
                        value={form.orderShippingOrderNumber}
                        onChange={(event) => onField("orderShippingOrderNumber", event.target.value)}
                        className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-600"
                      >
                        <option value="">Select an order</option>
                        {orders.map((order) => (
                          <option key={order.id} value={order.orderNumber}>
                            {order.orderNumber}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={form.orderShippingOrderNumber}
                        onChange={(event) => onField("orderShippingOrderNumber", event.target.value)}
                        className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600"
                        placeholder="Example: ORD-2026-001"
                      />
                    )}
                  </div>
                  {!isLoggedIn ? (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-800">Email</label>
                      <input
                        value={form.orderShippingEmail}
                        onChange={(event) => onField("orderShippingEmail", event.target.value)}
                        type="email"
                        className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600"
                        placeholder="you@example.com"
                      />
                    </div>
                  ) : null}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-800">Shipping Country</label>
                    <input
                      value={form.shippingCountry}
                      onChange={(event) => onField("shippingCountry", event.target.value)}
                      className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600"
                      placeholder="United States"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-800">Issue Type</label>
                    <select
                      value={form.orderIssueType}
                      onChange={(event) => onField("orderIssueType", event.target.value)}
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-600"
                    >
                      <option value="">Select issue type</option>
                      <option value="Tracking">Tracking</option>
                      <option value="Delivery estimate">Delivery estimate</option>
                      <option value="Address change">Address change</option>
                      <option value="Customs & duties">Customs & duties</option>
                    </select>
                  </div>
                  {form.orderIssueType === "Address change" ? (
                    <>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-800">New Address</label>
                        <textarea
                          value={form.newAddress}
                          onChange={(event) => onField("newAddress", event.target.value)}
                          className="min-h-[90px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                          placeholder="New full delivery address"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-800">Phone</label>
                        <input
                          value={form.phone}
                          onChange={(event) => onField("phone", event.target.value)}
                          className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600"
                          placeholder="+1..."
                        />
                      </div>
                    </>
                  ) : null}
                </>
              ) : null}

              {form.category === "AFTER_PURCHASE" ? (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-800">Order Number (optional)</label>
                    <input
                      value={form.afterOrderNumber}
                      onChange={(event) => onField("afterOrderNumber", event.target.value)}
                      className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600"
                      placeholder="Order number"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-800">Product link or SKU (optional)</label>
                    <input
                      value={form.afterProductRef}
                      onChange={(event) => onField("afterProductRef", event.target.value)}
                      className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600"
                      placeholder="Link or SKU"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-800">Topic</label>
                    <select
                      value={form.afterTopic}
                      onChange={(event) => onField("afterTopic", event.target.value)}
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-600"
                    >
                      <option value="">Select topic</option>
                      <option value="Care & cleaning">Care & cleaning</option>
                      <option value="Shedding">Shedding</option>
                      <option value="Color variation">Color variation</option>
                      <option value="Damage on arrival">Damage on arrival</option>
                      <option value="Return">Return</option>
                      <option value="Exchange">Exchange</option>
                    </select>
                  </div>
                  {form.afterTopic === "Damage on arrival" ? (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-800">Photo upload</label>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(event) => setDamageFiles(Array.from(event.target.files || []))}
                        className="block w-full text-sm text-slate-700"
                      />
                    </div>
                  ) : null}
                </>
              ) : null}

              {form.category === "CUSTOM_SPECIAL_ORDERS" ? (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-800">Request Type</label>
                    <select
                      value={form.customRequestType}
                      onChange={(event) => onField("customRequestType", event.target.value)}
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-600"
                    >
                      <option value="">Select request type</option>
                      <option value="Custom size">Custom size</option>
                      <option value="Custom color">Custom color</option>
                      <option value="Made-to-order timeline">Made-to-order timeline</option>
                      <option value="Bespoke design">Bespoke design</option>
                    </select>
                  </div>
                  {form.customRequestType === "Custom size" ? (
                    <div className="grid gap-3 md:grid-cols-3">
                      <input
                        value={form.sizeWidth}
                        onChange={(event) => onField("sizeWidth", event.target.value)}
                        className="h-11 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600"
                        placeholder="Width"
                      />
                      <input
                        value={form.sizeLength}
                        onChange={(event) => onField("sizeLength", event.target.value)}
                        className="h-11 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600"
                        placeholder="Length"
                      />
                      <select
                        value={form.sizeUnit}
                        onChange={(event) => onField("sizeUnit", event.target.value)}
                        className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-600"
                      >
                        <option value="cm">cm</option>
                        <option value="in">in</option>
                      </select>
                    </div>
                  ) : null}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-800">Budget range (optional)</label>
                    <input
                      value={form.budgetRange}
                      onChange={(event) => onField("budgetRange", event.target.value)}
                      className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600"
                      placeholder="$1,000 - $2,000"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-800">Upload inspiration images (optional)</label>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) => setInspirationFiles(Array.from(event.target.files || []))}
                      className="block w-full text-sm text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-800">Deadline date (optional)</label>
                    <input
                      type="date"
                      value={form.deadlineDate}
                      onChange={(event) => onField("deadlineDate", event.target.value)}
                      className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600"
                    />
                  </div>
                </>
              ) : null}

              {form.category === "INVOICE_PAYMENT" ? (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-800">Order Number</label>
                    <input
                      value={form.invoiceOrderNumber}
                      onChange={(event) => onField("invoiceOrderNumber", event.target.value)}
                      className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-800">Request Type</label>
                    <select
                      value={form.invoiceRequestType}
                      onChange={(event) => onField("invoiceRequestType", event.target.value)}
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-600"
                    >
                      <option value="">Select request type</option>
                      <option value="Invoice copy">Invoice copy</option>
                      <option value="Tax-VAT">Tax-VAT</option>
                      <option value="Payment issue">Payment issue</option>
                      <option value="Refund status">Refund status</option>
                    </select>
                  </div>
                  {form.invoiceRequestType === "Payment issue" ? (
                    <>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-800">Payment method</label>
                        <input
                          value={form.paymentMethod}
                          onChange={(event) => onField("paymentMethod", event.target.value)}
                          className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600"
                          placeholder="Card / Bank Transfer / Other"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-800">Error description</label>
                        <textarea
                          value={form.errorDescription}
                          onChange={(event) => onField("errorDescription", event.target.value)}
                          className="min-h-[90px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                        />
                      </div>
                    </>
                  ) : null}
                </>
              ) : null}

              {form.category === "WHOLESALE_TRADE" ? (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-800">Company name</label>
                    <input
                      value={form.wholesaleCompanyName}
                      onChange={(event) => onField("wholesaleCompanyName", event.target.value)}
                      className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-800">Country</label>
                    <input
                      value={form.wholesaleCountry}
                      onChange={(event) => onField("wholesaleCountry", event.target.value)}
                      className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-800">Approx quantity</label>
                    <input
                      value={form.wholesaleApproxQuantity}
                      onChange={(event) => onField("wholesaleApproxQuantity", event.target.value)}
                      className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600"
                    />
                  </div>
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium text-slate-800">Target styles</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {TARGET_STYLE_OPTIONS.map((style) => (
                        <label key={style} className="inline-flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={form.wholesaleTargetStyles.includes(style)}
                            onChange={(event) => {
                              if (event.target.checked) {
                                onField("wholesaleTargetStyles", [...form.wholesaleTargetStyles, style])
                              } else {
                                onField(
                                  "wholesaleTargetStyles",
                                  form.wholesaleTargetStyles.filter((item) => item !== style)
                                )
                              }
                            }}
                          />
                          {style}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-800">Message</label>
                    <textarea
                      value={form.wholesaleMessage}
                      onChange={(event) => onField("wholesaleMessage", event.target.value)}
                      className="min-h-[100px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                    />
                  </div>
                </>
              ) : null}

              {form.category === "PRODUCT_INFORMATION" ? (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-800">Product link or SKU</label>
                    <input
                      value={form.productInfoRef}
                      onChange={(event) => onField("productInfoRef", event.target.value)}
                      className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-800">Need</label>
                    <select
                      value={form.productInfoNeed}
                      onChange={(event) => onField("productInfoNeed", event.target.value)}
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-600"
                    >
                      <option value="">Select need</option>
                      <option value="Material">Material</option>
                      <option value="Origin">Origin</option>
                      <option value="Technique">Technique</option>
                      <option value="More photos">More photos</option>
                      <option value="Availability">Availability</option>
                    </select>
                  </div>
                </>
              ) : null}

              {form.category === "ACCOUNT_WEBSITE_HELP" ? (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-800">Email</label>
                    <input
                      type="email"
                      value={form.accountEmail}
                      onChange={(event) => onField("accountEmail", event.target.value)}
                      className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600"
                      placeholder="you@example.com"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-800">Issue type</label>
                    <select
                      value={form.accountIssueType}
                      onChange={(event) => onField("accountIssueType", event.target.value)}
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-600"
                    >
                      <option value="">Select issue type</option>
                      <option value="Login">Login</option>
                      <option value="Order history">Order history</option>
                      <option value="Wishlist">Wishlist</option>
                      <option value="Bug">Bug</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-800">Screenshot upload (optional)</label>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) => setScreenshotFiles(Array.from(event.target.files || []))}
                      className="block w-full text-sm text-slate-700"
                    />
                  </div>
                </>
              ) : null}

              {form.category === "OTHER" ? (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-800">Subject</label>
                    <input
                      value={form.otherSubject}
                      onChange={(event) => onField("otherSubject", event.target.value)}
                      className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-800">Message</label>
                    <textarea
                      value={form.otherMessage}
                      onChange={(event) => onField("otherMessage", event.target.value)}
                      className="min-h-[110px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                    />
                  </div>
                </>
              ) : null}

              {!isLoggedIn && form.category && form.category !== "ORDER_SHIPPING" && form.category !== "ACCOUNT_WEBSITE_HELP" ? (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-800">Email</label>
                  <input
                    type="email"
                    value={form.accountEmail}
                    onChange={(event) => onField("accountEmail", event.target.value)}
                    className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600"
                    placeholder="you@example.com"
                  />
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting || !form.category}
                className="h-11 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Sending..." : "Send support request"}
              </button>
            </form>
          </div>

          <aside className="order-2 space-y-4 lg:order-none">
            <div className="hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:block">
              <h2 className="text-lg font-semibold text-slate-900">{faqTitle}</h2>
              <p className="mt-1 text-sm text-slate-600">You might find these helpful before sending a request.</p>
              <div className="mt-4">{renderFaqCards()}</div>
              <div className="mt-5 border-t border-slate-200 pt-4">{renderContactOptions()}</div>
              <Link href="/faq" className="mt-4 inline-block text-xs font-semibold text-emerald-700 hover:underline">
                Browse full Help Center
              </Link>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:hidden">
              <details open>
                <summary className="cursor-pointer text-sm font-semibold text-slate-900">Suggested answers</summary>
                <p className="mt-2 text-sm text-slate-600">You might find these helpful before sending a request.</p>
                <div className="mt-4">{renderFaqCards()}</div>
              </details>
              <details className="mt-4" open>
                <summary className="cursor-pointer text-sm font-semibold text-slate-900">Contact options</summary>
                <div className="mt-3">{renderContactOptions()}</div>
                <Link href="/faq" className="mt-3 inline-block text-xs font-semibold text-emerald-700 hover:underline">
                  Browse full Help Center
                </Link>
              </details>
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}
