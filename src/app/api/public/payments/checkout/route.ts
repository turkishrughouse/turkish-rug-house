import crypto from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { getSessionUser } from "@/lib/auth"
import { getSiteSettings } from "@/lib/site-settings"
import { ensureOrderDetailsColumn, saveOrderDetails } from "@/lib/order-details"

const payloadSchema = z.object({
  provider: z.enum(["stripe", "paypal", "paytr", "gpay", "applepay"]),
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  customerPhone: z.string().optional(),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  postcode: z.string().optional(),
  country: z.string().optional(),
  shippingMethod: z.string().optional(),
  shippingCost: z.number().nonnegative().optional(),
  subtotal: z.number().nonnegative().optional(),
  taxAmount: z.number().nonnegative().optional(),
  items: z.array(
    z.object({
      productId: z.string().optional().nullable(),
      title: z.string().min(1),
      quantity: z.number().int().min(1),
      price: z.number().nonnegative(),
    })
  ).min(1),
  total: z.number().nonnegative(),
})

async function nextOrderNumber() {
  const latest = await prisma.order.findFirst({
    orderBy: { createdAt: "desc" },
    select: { orderNumber: true },
  })
  const lastNumber = latest?.orderNumber ? Number(String(latest.orderNumber).replace(/\D/g, "")) : 0
  const next = Number.isFinite(lastNumber) ? lastNumber + 1 : 1
  return `TRH-${String(next).padStart(3, "0")}`
}

function asMinor(value: number) {
  return Math.round(value * 100)
}

function getClientIp(req: NextRequest) {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    ""
  )
}

async function createStripeCheckout(input: {
  secretKey: string
  origin: string
  orderId: string
  orderNumber: string
  currency: string
  items: Array<{ title: string; quantity: number; price: number }>
  shippingCost: number
  customerEmail: string
}) {
  const body = new URLSearchParams()
  body.set("mode", "payment")
  body.set("success_url", `${input.origin}/api/public/payments/stripe/success?orderId=${encodeURIComponent(input.orderId)}&session_id={CHECKOUT_SESSION_ID}`)
  body.set("cancel_url", `${input.origin}/basket?payment=cancelled&order=${encodeURIComponent(input.orderId)}`)
  body.set("metadata[orderId]", input.orderId)
  body.set("metadata[orderNumber]", input.orderNumber)
  body.set("customer_email", input.customerEmail)

  input.items.forEach((item, idx) => {
    body.set(`line_items[${idx}][price_data][currency]`, input.currency.toLowerCase())
    body.set(`line_items[${idx}][price_data][product_data][name]`, item.title)
    body.set(`line_items[${idx}][price_data][unit_amount]`, String(asMinor(item.price)))
    body.set(`line_items[${idx}][quantity]`, String(item.quantity))
  })

  if (input.shippingCost > 0) {
    const idx = input.items.length
    body.set(`line_items[${idx}][price_data][currency]`, input.currency.toLowerCase())
    body.set(`line_items[${idx}][price_data][product_data][name]`, "Shipping")
    body.set(`line_items[${idx}][price_data][unit_amount]`, String(asMinor(input.shippingCost)))
    body.set(`line_items[${idx}][quantity]`, "1")
  }

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  })
  const json = await res.json().catch(() => null as null | { id?: string; url?: string; error?: { message?: string } })
  if (!res.ok || !json?.url) {
    throw new Error(json?.error?.message || "Stripe checkout session could not be created")
  }
  return { redirectUrl: json.url, externalPaymentId: json.id || "" }
}

async function getPayPalToken(clientId: string, clientSecret: string, sandbox: boolean) {
  const base = sandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com"
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  })
  const json = await res.json().catch(() => null as null | { access_token?: string })
  if (!res.ok || !json?.access_token) throw new Error("PayPal token request failed")
  return { base, token: json.access_token }
}

async function createPayPalOrder(input: {
  clientId: string
  clientSecret: string
  sandbox: boolean
  origin: string
  orderId: string
  orderNumber: string
  amount: number
  currency: string
}) {
  const { base, token } = await getPayPalToken(input.clientId, input.clientSecret, input.sandbox)
  const res = await fetch(`${base}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": `${input.orderId}-${Date.now()}`,
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: input.orderId,
          custom_id: input.orderNumber,
          amount: {
            currency_code: input.currency.toUpperCase(),
            value: input.amount.toFixed(2),
          },
        },
      ],
      application_context: {
        return_url: `${input.origin}/api/public/payments/paypal/success?orderId=${encodeURIComponent(input.orderId)}`,
        cancel_url: `${input.origin}/basket?payment=cancelled&order=${encodeURIComponent(input.orderId)}`,
      },
    }),
  })
  const json = await res.json().catch(() => null as null | { id?: string; links?: Array<{ rel?: string; href?: string }> })
  if (!res.ok || !json?.id) throw new Error("PayPal order could not be created")
  const approve = json.links?.find((link: { rel?: string; href?: string }) => link.rel === "approve")?.href
  if (!approve) throw new Error("PayPal approve URL not found")
  return { redirectUrl: approve, externalPaymentId: json.id, base }
}

async function createPayTRToken(input: {
  settings: Awaited<ReturnType<typeof getSiteSettings>>
  origin: string
  orderId: string
  amount: number
  customerEmail: string
  customerName: string
  customerPhone: string
  address: string
  items: Array<{ title: string; quantity: number; price: number }>
  userIp: string
}) {
  const merchantId = input.settings.paytrMerchantId
  const merchantKey = input.settings.paytrMerchantKey
  const merchantSalt = input.settings.paytrMerchantSalt
  if (!merchantId || !merchantKey || !merchantSalt) {
    throw new Error("PayTR settings are incomplete")
  }

  const merchantOid = `TRH-${input.orderId}`
  const paymentAmount = String(asMinor(input.amount))
  const basket = Buffer.from(
    JSON.stringify(
      input.items.map((item) => [item.title, String(asMinor(item.price)), item.quantity])
    )
  ).toString("base64")
  const noInstallment = "0"
  const maxInstallment = "0"
  const currency = input.settings.defaultCurrency.toUpperCase()
  const testMode = input.settings.paytrEnabled ? "0" : "1"
  const userIp = input.userIp || "127.0.0.1"
  const okUrl = input.settings.paytrMerchantOkUrl || `${input.origin}/account?payment=success&order=${encodeURIComponent(input.orderId)}`
  const failUrl = input.settings.paytrMerchantFailUrl || `${input.origin}/basket?payment=cancelled&order=${encodeURIComponent(input.orderId)}`

  const hashStr =
    merchantId + userIp + merchantOid + input.customerEmail + paymentAmount + basket + noInstallment + maxInstallment + currency + testMode
  const paytrToken = crypto
    .createHmac("sha256", merchantKey)
    .update(hashStr + merchantSalt)
    .digest("base64")

  const body = new URLSearchParams({
    merchant_id: merchantId,
    user_ip: userIp,
    merchant_oid: merchantOid,
    email: input.customerEmail,
    payment_amount: paymentAmount,
    paytr_token: paytrToken,
    user_basket: basket,
    no_installment: noInstallment,
    max_installment: maxInstallment,
    currency,
    test_mode: testMode,
    lang: "en",
    merchant_ok_url: okUrl,
    merchant_fail_url: failUrl,
    user_name: input.customerName,
    user_address: input.address || "-",
    user_phone: input.customerPhone || "-",
  })

  const res = await fetch("https://www.paytr.com/odeme/api/get-token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  const json = await res.json().catch(() => null as null | { status?: string; token?: string; reason?: string })
  if (!res.ok || json?.status !== "success" || !json?.token) {
    throw new Error(json?.reason || "PayTR token could not be created")
  }
  return {
    redirectUrl: `https://www.paytr.com/odeme/guvenli/${json.token}`,
    externalPaymentId: merchantOid,
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureOrderDetailsColumn()
    const body = await req.json()
    const parsed = payloadSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Invalid payment payload" }, { status: 400 })

    const settings = await getSiteSettings()
    if (!settings.checkoutEnabled) return NextResponse.json({ error: "Checkout is disabled" }, { status: 400 })

    const sessionUser = await getSessionUser("customer")
    const isCustomerSession = sessionUser?.role === "CUSTOMER"
    if (!settings.enableGuestCheckout && !isCustomerSession) {
      return NextResponse.json({ error: "Please sign in to checkout" }, { status: 401 })
    }
    const input = parsed.data
    const origin = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
    const clientIp = getClientIp(req) || "unknown"

    const order = await prisma.order.create({
      data: {
        orderNumber: await nextOrderNumber(),
        userId: isCustomerSession ? sessionUser.id : null,
        customerName: input.customerName,
        customerEmail: input.customerEmail.toLowerCase(),
        total: input.total,
        status: "PENDING",
        shipmentStatus: "PENDING",
        items: {
          create: input.items.map((item) => ({
            productId: item.productId || null,
            title: item.title,
            quantity: item.quantity,
            price: item.price,
          })),
        },
        events: {
          create: [
            {
              type: "CREATED",
              title: "Payment initiated",
              description: `Checkout started with ${input.provider.toUpperCase()} from IP ${clientIp}`,
              actorType: "CUSTOMER",
              isAdmin: false,
            },
          ],
        },
      },
    })
    await saveOrderDetails(order.id, {
      customerPhone: input.customerPhone?.trim() || null,
      addressLine1: input.addressLine1?.trim() || null,
      city: input.city?.trim() || null,
      postcode: input.postcode?.trim() || null,
      country: input.country?.trim() || null,
      paymentMethod: input.provider.toUpperCase(),
      paymentStatus: "PENDING",
      shippingMethod: input.shippingMethod?.trim() || null,
      shippingCost: Number(input.shippingCost || 0),
      subtotalAmount: Number(input.subtotal || 0),
      taxAmount: Number(input.taxAmount || 0),
      discountAmount: 0,
      currency: settings.defaultCurrency || "USD",
      invoiceNumber: `INV-${order.orderNumber}`,
    })

    if (input.provider === "stripe" || input.provider === "gpay" || input.provider === "applepay") {
      const isGPay = input.provider === "gpay"
      const isApplePay = input.provider === "applepay"
      if (isGPay && !settings.googlePayEnabled) {
        return NextResponse.json({ error: "Google Pay is not configured" }, { status: 400 })
      }
      if (isApplePay && !settings.applePayEnabled) {
        return NextResponse.json({ error: "Apple Pay is not configured" }, { status: 400 })
      }
      if (input.provider === "stripe" && !settings.stripeEnabled) {
        return NextResponse.json({ error: "Stripe is not configured" }, { status: 400 })
      }
      const secretKey = isGPay
        ? (settings.googlePayApiSecret || settings.stripeSecretKey)
        : isApplePay
          ? (settings.applePayApiSecret || settings.stripeSecretKey)
          : settings.stripeSecretKey
      if (!secretKey) {
        return NextResponse.json({ error: "Stripe API secret is missing for this provider" }, { status: 400 })
      }
      const stripe = await createStripeCheckout({
        secretKey,
        origin,
        orderId: order.id,
        orderNumber: order.orderNumber,
        currency: settings.defaultCurrency || "USD",
        items: input.items,
        shippingCost: input.shippingCost || 0,
        customerEmail: input.customerEmail,
      })
      return NextResponse.json({ redirectUrl: stripe.redirectUrl, orderId: order.id, provider: input.provider })
    }

    if (input.provider === "paypal") {
      if (!settings.paypalEnabled || !settings.paypalClientId || !settings.paypalClientSecret) {
        return NextResponse.json({ error: "PayPal is not configured" }, { status: 400 })
      }
      const paypal = await createPayPalOrder({
        clientId: settings.paypalClientId,
        clientSecret: settings.paypalClientSecret,
        sandbox: settings.paypalMode !== "live",
        origin,
        orderId: order.id,
        orderNumber: order.orderNumber,
        amount: input.total,
        currency: settings.defaultCurrency || "USD",
      })
      return NextResponse.json({ redirectUrl: paypal.redirectUrl, orderId: order.id, provider: "paypal" })
    }

    if (!settings.paytrEnabled) {
      return NextResponse.json({ error: "PayTR is not configured" }, { status: 400 })
    }
    const paytr = await createPayTRToken({
      settings,
      origin,
      orderId: order.id,
      amount: input.total,
      customerEmail: input.customerEmail.toLowerCase(),
      customerName: input.customerName,
      customerPhone: input.customerPhone || "",
      address: [input.addressLine1, input.city, input.postcode, input.country].filter(Boolean).join(" "),
      items: input.items,
      userIp: clientIp,
    })
    return NextResponse.json({ redirectUrl: paytr.redirectUrl, orderId: order.id, provider: "paytr" })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Payment initialization failed" }, { status: 500 })
  }
}
