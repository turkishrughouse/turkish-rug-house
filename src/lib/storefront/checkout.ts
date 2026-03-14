import { prisma } from "@/lib/db"
import type { SiteSettings } from "@/lib/site-settings"

export type CheckoutProvider = "stripe" | "paypal" | "paytr" | "gpay" | "applepay"
export type CheckoutShippingMethod = "dhl" | "ups" | "fedex"

export type CheckoutLineInput = {
  productId: string
  quantity: number
}

export type ResolvedCheckoutLine = {
  productId: string
  title: string
  slug: string
  quantity: number
  price: number
  stockCount: number
}

export type ResolvedCheckoutDraft = {
  items: ResolvedCheckoutLine[]
  subtotal: number
  shippingCost: number
  taxAmount: number
  total: number
  shippingLabel: string
  currency: "USD"
}

const CHECKOUT_TAX_RATE = 0.1

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}

export function computeShippingCost(
  settings: Pick<SiteSettings, "flatShippingRate">,
  method: CheckoutShippingMethod
) {
  const baseRate = Math.max(0, Number(settings.flatShippingRate || 0))
  if (method === "ups") {
    return { label: "UPS", cost: roundCurrency(baseRate + 4) }
  }
  if (method === "fedex") {
    return { label: "FedEx", cost: roundCurrency(baseRate + 8) }
  }
  return { label: "DHL", cost: roundCurrency(baseRate) }
}

export function computeTaxAmount(
  settings: Pick<SiteSettings, "enableTaxes">,
  subtotal: number,
  shippingCost: number
) {
  if (!settings.enableTaxes) return 0
  return roundCurrency((subtotal + shippingCost) * CHECKOUT_TAX_RATE)
}

export async function resolveCheckoutDraft(input: {
  lines: CheckoutLineInput[]
  shippingMethod: CheckoutShippingMethod
  settings: Pick<SiteSettings, "flatShippingRate" | "enableTaxes" | "defaultCurrency">
}) {
  const lines = input.lines
    .map((item) => ({
      productId: String(item.productId || "").trim(),
      quantity: Math.max(1, Math.trunc(Number(item.quantity || 0))),
    }))
    .filter((item) => item.productId)

  if (lines.length === 0) {
    throw new Error("Your basket is empty")
  }

  const products = await prisma.product.findMany({
    where: {
      id: { in: lines.map((item) => item.productId) },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      price: true,
      isPublished: true,
      isStock: true,
      stockCount: true,
    },
  })

  const productMap = new Map(products.map((product) => [product.id, product]))
  const resolvedItems: ResolvedCheckoutLine[] = []

  for (const line of lines) {
    const product = productMap.get(line.productId)
    if (!product || !product.isPublished) {
      throw new Error("One of the selected products is no longer available")
    }
    if (!product.isStock || product.stockCount < line.quantity) {
      throw new Error(`${product.title} does not have enough stock available`)
    }
    resolvedItems.push({
      productId: product.id,
      title: product.title,
      slug: product.slug,
      quantity: line.quantity,
      price: Number(product.price),
      stockCount: product.stockCount,
    })
  }

  const subtotal = roundCurrency(
    resolvedItems.reduce((sum, item) => sum + item.quantity * item.price, 0)
  )
  const shipping = computeShippingCost(input.settings, input.shippingMethod)
  const taxAmount = computeTaxAmount(input.settings, subtotal, shipping.cost)
  const total = roundCurrency(subtotal + shipping.cost + taxAmount)

  return {
    items: resolvedItems,
    subtotal,
    shippingCost: shipping.cost,
    taxAmount,
    total,
    shippingLabel: shipping.label,
    currency: "USD",
  } satisfies ResolvedCheckoutDraft
}
