import { z } from "zod"

export const SUPPORT_CATEGORIES = [
  { value: "ORDER_SHIPPING", slug: "order_shipping", label: "Order & Shipping" },
  { value: "AFTER_PURCHASE", slug: "after_purchase", label: "After Purchase Support" },
  { value: "CUSTOM_SPECIAL_ORDERS", slug: "custom_special_orders", label: "Custom & Special Orders" },
  { value: "INVOICE_PAYMENT", slug: "invoice_payment", label: "Invoice & Payment" },
  { value: "WHOLESALE_TRADE", slug: "wholesale_trade", label: "Wholesale & Trade" },
  { value: "PRODUCT_INFORMATION", slug: "product_information", label: "Product Information" },
  { value: "ACCOUNT_WEBSITE_HELP", slug: "account_website_help", label: "Account & Website Help" },
  { value: "OTHER", slug: "other", label: "Other" },
] as const

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]["value"]

const categoryValues = SUPPORT_CATEGORIES.map((item) => item.value) as [SupportCategory, ...SupportCategory[]]

export const supportCategorySchema = z.enum(categoryValues)

export type SupportFaqSeed = {
  category: SupportCategory
  question: string
  answerShort: string
  answerLong: string
  tags: string[]
  isFeatured?: boolean
}

export const SUPPORT_FAQ_SEED: SupportFaqSeed[] = [
  {
    category: "ORDER_SHIPPING",
    question: "How long does shipping take?",
    answerShort: "Most in-stock rugs ship in 1-2 business days and arrive in 3-8 business days.",
    answerLong:
      "For in-stock items, we usually dispatch within 1-2 business days. Delivery times vary by destination country and shipping method, but most deliveries complete in 3-8 business days.",
    tags: ["shipping", "delivery", "timing"],
    isFeatured: true,
  },
  {
    category: "ORDER_SHIPPING",
    question: "How can I track my order?",
    answerShort: "Your tracking details appear in account orders after shipment.",
    answerLong:
      "Once your shipment is created, your account order page shows carrier, tracking number, and tracking link. You may also receive a tracking update message in your customer panel.",
    tags: ["tracking", "order"],
    isFeatured: true,
  },
  {
    category: "ORDER_SHIPPING",
    question: "Will I pay customs duties?",
    answerShort: "Import duties may apply depending on your destination country.",
    answerLong:
      "Customs duties and taxes are defined by your local authorities. If charges apply, your shipping carrier usually requests payment before or during final delivery.",
    tags: ["customs", "duties", "tax"],
    isFeatured: true,
  },
  {
    category: "CUSTOM_SPECIAL_ORDERS",
    question: "Can I request a custom size?",
    answerShort: "Yes, custom dimensions are available for selected products.",
    answerLong:
      "You can request a custom width and length for eligible collections. Share your target size, style direction, and destination country so we can confirm options.",
    tags: ["custom", "size"],
    isFeatured: true,
  },
  {
    category: "CUSTOM_SPECIAL_ORDERS",
    question: "How long do custom orders take?",
    answerShort: "Typical lead time is 4-10 weeks depending on complexity.",
    answerLong:
      "Custom timeline depends on weaving technique, color matching, and workshop capacity. After specification review, we provide a realistic production and shipping estimate.",
    tags: ["custom", "timeline"],
    isFeatured: true,
  },
  {
    category: "INVOICE_PAYMENT",
    question: "How do I get an invoice copy?",
    answerShort: "Submit your order number and request an invoice copy.",
    answerLong:
      "Open a support request in Invoice & Payment with your order number. After verification, we send the invoice copy to your registered email.",
    tags: ["invoice", "billing"],
    isFeatured: true,
  },
  {
    category: "INVOICE_PAYMENT",
    question: "When will my refund be processed?",
    answerShort: "Most refunds are completed in 3-10 business days after approval.",
    answerLong:
      "After refund approval, processing time depends on payment provider and bank network. Card refunds generally complete in 3-10 business days.",
    tags: ["refund", "payment"],
    isFeatured: true,
  },
  {
    category: "WHOLESALE_TRADE",
    question: "Do you offer trade pricing?",
    answerShort: "Yes, verified trade customers can access wholesale pricing.",
    answerLong:
      "Trade pricing is based on order size, selected styles, and delivery region. Share your company profile and expected volume for a tailored quote.",
    tags: ["wholesale", "trade", "pricing"],
    isFeatured: true,
  },
  {
    category: "WHOLESALE_TRADE",
    question: "What is your minimum order quantity?",
    answerShort: "Minimum quantity varies by product type and request scope.",
    answerLong:
      "MOQ depends on whether items are stock, made-to-order, or custom designed. Send your target styles and expected quantity for exact MOQ guidance.",
    tags: ["wholesale", "moq"],
    isFeatured: true,
  },
]

export const supportTicketPostSchema = z.object({
  category: supportCategorySchema,
  subType: z.string().trim().max(120).nullable().optional(),
  orderNumber: z.string().trim().max(120).nullable().optional(),
  email: z.string().trim().email().optional(),
  name: z.string().trim().max(120).nullable().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
  attachments: z.array(z.string().trim().min(1)).default([]),
  faqViewed: z.array(z.string().trim().min(1)).default([]),
})

function required(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0
  if (typeof value === "number") return Number.isFinite(value)
  if (Array.isArray(value)) return value.length > 0
  if (value && typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0
  return Boolean(value)
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>
  return {}
}

export function validateSupportTicketByCategory(input: z.infer<typeof supportTicketPostSchema>) {
  const errors: string[] = []
  const payload = asRecord(input.payload)
  const subtype = (input.subType || "").trim()
  const orderNumber = (input.orderNumber || "").trim()

  if (input.category === "ORDER_SHIPPING") {
    if (!orderNumber) errors.push("Order number is required for Order & Shipping.")
    if (!required(payload.shippingCountry)) errors.push("Shipping country is required.")
    if (!subtype) errors.push("Issue type is required.")
    if (subtype === "Address change") {
      if (!required(payload.newAddress)) errors.push("New address is required for address change requests.")
      if (!required(payload.phone)) errors.push("Phone is required for address change requests.")
    }
  }

  if (input.category === "AFTER_PURCHASE") {
    if (!subtype) errors.push("Topic is required.")
    if (subtype === "Damage on arrival" && input.attachments.length === 0) {
      errors.push("At least one photo is required for damage on arrival.")
    }
  }

  if (input.category === "CUSTOM_SPECIAL_ORDERS") {
    if (!subtype) errors.push("Request type is required.")
    if (subtype === "Custom size") {
      if (!required(payload.sizeWidth) || !required(payload.sizeLength) || !required(payload.sizeUnit)) {
        errors.push("Desired width, length, and unit are required for custom size requests.")
      }
    }
  }

  if (input.category === "INVOICE_PAYMENT") {
    if (!orderNumber) errors.push("Order number is required for Invoice & Payment.")
    if (!subtype) errors.push("Request type is required.")
    if (subtype === "Payment issue") {
      if (!required(payload.paymentMethod)) errors.push("Payment method is required.")
      if (!required(payload.errorDescription)) errors.push("Error description is required.")
    }
  }

  if (input.category === "WHOLESALE_TRADE") {
    if (!required(payload.companyName)) errors.push("Company name is required.")
    if (!required(payload.country)) errors.push("Country is required.")
    if (!required(payload.approxQuantity)) errors.push("Approx quantity is required.")
    if (!required(payload.message)) errors.push("Message is required.")
  }

  if (input.category === "PRODUCT_INFORMATION") {
    if (!required(payload.productRef)) errors.push("Product link or SKU is required.")
    if (!subtype) errors.push("Need type is required.")
  }

  if (input.category === "ACCOUNT_WEBSITE_HELP") {
    if (!required(input.email)) errors.push("Email is required.")
    if (!subtype) errors.push("Issue type is required.")
  }

  if (input.category === "OTHER") {
    if (!required(payload.subject)) errors.push("Subject is required.")
    if (!required(payload.message)) errors.push("Message is required.")
  }

  return errors
}

export function getSupportCategoryLabel(category: string) {
  return SUPPORT_CATEGORIES.find((item) => item.value === category)?.label || category
}

export function getSupportCategorySlug(category: string) {
  return SUPPORT_CATEGORIES.find((item) => item.value === category)?.slug || category.toLowerCase()
}

export function parseSupportCategory(value: string | null | undefined): SupportCategory | null {
  if (!value) return null
  const normalized = value.trim()
  const byValue = SUPPORT_CATEGORIES.find((item) => item.value === normalized)
  if (byValue) return byValue.value
  const bySlug = SUPPORT_CATEGORIES.find((item) => item.slug === normalized.toLowerCase())
  return bySlug?.value || null
}

export type ContactChannel = "WHATSAPP" | "EMAIL"

export type SupportContactConfig = {
  primary: ContactChannel
  text: string
  expectation: string
}

export const SUPPORT_CONTACT_OPTIONS: Record<SupportCategory, SupportContactConfig> = {
  ORDER_SHIPPING: {
    primary: "WHATSAPP",
    text: "Fast updates on tracking, delivery, and address changes.",
    expectation: "Typically replies within 30 minutes during business hours.",
  },
  AFTER_PURCHASE: {
    primary: "EMAIL",
    text: "Best for sharing photos and detailed information.",
    expectation: "Typically replies within 24 hours.",
  },
  CUSTOM_SPECIAL_ORDERS: {
    primary: "WHATSAPP",
    text: "Quick consultation for size, color, and timelines.",
    expectation: "Typically replies within 1-3 hours.",
  },
  INVOICE_PAYMENT: {
    primary: "EMAIL",
    text: "Secure documentation and invoice requests.",
    expectation: "Typically replies within 24 hours.",
  },
  WHOLESALE_TRADE: {
    primary: "EMAIL",
    text: "Best for pricing, terms, and formal requests.",
    expectation: "Typically replies within 1 business day.",
  },
  PRODUCT_INFORMATION: {
    primary: "WHATSAPP",
    text: "Quick answers on stock, details, and photos.",
    expectation: "Typically replies within 1 hour.",
  },
  ACCOUNT_WEBSITE_HELP: {
    primary: "EMAIL",
    text: "Best for screenshots and account verification.",
    expectation: "Typically replies within 24 hours.",
  },
  OTHER: {
    primary: "EMAIL",
    text: "Share your request and we will direct it to the right team.",
    expectation: "Typically replies within 24 hours.",
  },
}
