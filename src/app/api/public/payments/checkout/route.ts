import crypto from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { getSessionUser } from "@/lib/auth"
import { checkFixedWindowRateLimit } from "@/lib/rate-limit"
import { getFreshSiteSettings } from "@/lib/site-settings"
import { ensureOrderDetailsColumn, saveOrderDetails } from "@/lib/order-details"
import { nextOrderNumber } from "@/lib/payment-orders"
import { getAddressCountryConfig } from "@/lib/location/catalog"
import {
  buildDisplayAmountsFromUsd,
  readCurrencyFromNextRequest,
  resolveStorefrontCurrencyFromRequest,
} from "@/lib/storefront/currency-server"
import { normalizeCurrency } from "@/lib/storefront/currency"
import {
  resolveCheckoutDraft,
  type CheckoutProvider,
  type CheckoutShippingMethod,
} from "@/lib/storefront/checkout"
import { getSiteUrl } from "@/lib/site-url"

const payloadSchema = z.object({
  provider: z.enum(["stripe", "paypal", "paytr", "gpay", "applepay"]),
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  customerPhone: z.string().optional(),
  company: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  postcode: z.string().optional(),
  country: z.string().optional(),
  countryCode: z.string().optional(),
  regionState: z.string().optional(),
  orderComment: z.string().optional(),
  shippingMethod: z.enum(["dhl", "ups", "fedex"]).optional(),
  displayCurrency: z.enum(["USD", "EUR"]).optional(),
  items: z.array(
    z.object({
      productId: z.string().min(1),
      quantity: z.number().int().min(1),
    })
  ).min(1),
})

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
  body.set("client_reference_id", input.orderId)
  body.set("success_url", `${input.origin}/api/public/payments/stripe/success?orderId=${encodeURIComponent(input.orderId)}&session_id={CHECKOUT_SESSION_ID}`)
  body.set("cancel_url", `${input.origin}/basket?payment=cancelled&order=${encodeURIComponent(input.orderId)}`)
  body.set("metadata[orderId]", input.orderId)
  body.set("metadata[orderNumber]", input.orderNumber)
  body.set("metadata[paymentProvider]", "STRIPE")
  body.set("payment_intent_data[metadata][orderId]", input.orderId)
  body.set("payment_intent_data[metadata][orderNumber]", input.orderNumber)
  body.set("payment_intent_data[metadata][paymentProvider]", "STRIPE")
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

  console.info("[checkout] stripe session shipping payload", {
    orderId: input.orderId,
    currency: input.currency,
    shippingCost: input.shippingCost,
    shippingMinorAmount: asMinor(input.shippingCost),
  })

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
  currency: string
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
  const currency = input.currency.toUpperCase()
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

    const settings = await getFreshSiteSettings()
    if (!settings.checkoutEnabled) return NextResponse.json({ error: "Checkout is disabled" }, { status: 400 })

    const sessionUser = await getSessionUser("customer")
    const isCustomerSession = sessionUser?.role === "CUSTOMER"
    if (!settings.enableGuestCheckout && !isCustomerSession) {
      return NextResponse.json({ error: "Please sign in to checkout" }, { status: 401 })
    }
    const input = parsed.data
    if (settings.requirePhoneAtCheckout && !input.customerPhone?.trim()) {
      return NextResponse.json({ error: "Phone is required for checkout" }, { status: 400 })
    }
    if (
      settings.requireAddressAtCheckout &&
      (!input.country?.trim() || !input.addressLine1?.trim() || !input.city?.trim() || !input.postcode?.trim())
    ) {
      return NextResponse.json({ error: "Country, address, city and postal code are required for checkout" }, { status: 400 })
    }
    const countryConfig = getAddressCountryConfig((input.countryCode || "").trim().toUpperCase())
    if (countryConfig.regionRequired && !input.regionState?.trim()) {
      return NextResponse.json({ error: `${countryConfig.regionLabel} is required for checkout` }, { status: 400 })
    }
    const origin = getSiteUrl()
    const clientIp = getClientIp(req) || "unknown"
    const rateLimit = checkFixedWindowRateLimit({
      scope: "checkout-init",
      key: clientIp,
      limit: 12,
      windowMs: 15 * 60 * 1000,
    })
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many checkout attempts. Please try again shortly." }, { status: 429 })
    }
    const headerCountryCode =
      req.headers.get("x-vercel-ip-country") ||
      req.headers.get("cf-ipcountry") ||
      req.headers.get("x-country-code") ||
      ""

    const provider = input.provider as CheckoutProvider
    const shippingMethod = (input.shippingMethod || "dhl") as CheckoutShippingMethod

    if ((provider === "stripe" || provider === "gpay" || provider === "applepay")) {
      const isGPay = provider === "gpay"
      const isApplePay = provider === "applepay"
      if (isGPay && !settings.googlePayEnabled) {
        return NextResponse.json({ error: "Google Pay is not configured" }, { status: 400 })
      }
      if (isApplePay && !settings.applePayEnabled) {
        return NextResponse.json({ error: "Apple Pay is not configured" }, { status: 400 })
      }
      if (provider === "stripe" && !settings.stripeEnabled) {
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
    } else if (provider === "paypal") {
      if (!settings.paypalEnabled || !settings.paypalClientId || !settings.paypalClientSecret) {
        return NextResponse.json({ error: "PayPal is not configured" }, { status: 400 })
      }
    } else if (!settings.paytrEnabled) {
      return NextResponse.json({ error: "PayTR is not configured" }, { status: 400 })
    }

    const draft = await resolveCheckoutDraft({
      lines: input.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      shippingMethod,
      settings,
    })

    console.info("[checkout] shipping settings loaded", {
      autoCarrierRates: settings.autoCarrierRates,
      flatShippingRate: settings.flatShippingRate,
      localPickupRate: settings.localPickupRate,
      dhlEnabled: settings.dhlEnabled,
      upsEnabled: settings.upsEnabled,
      fedexEnabled: settings.fedexEnabled,
      selectedShippingMethod: shippingMethod,
      resolvedShippingLabel: draft.shippingLabel,
      resolvedShippingCostUsd: draft.shippingCost,
    })

    const requestedDisplayCurrency = normalizeCurrency(input.displayCurrency || readCurrencyFromNextRequest(req) || null)
    const currencySnapshot = await resolveStorefrontCurrencyFromRequest({
      cookieCurrency: requestedDisplayCurrency,
      countryCode: headerCountryCode,
      acceptLanguage: req.headers.get("accept-language") || "",
    })
    const displayAmounts = buildDisplayAmountsFromUsd({
      subtotalUsd: draft.subtotal,
      shippingUsd: draft.shippingCost,
      taxUsd: draft.taxAmount,
      discountUsd: 0,
      selectedCurrency: currencySnapshot.selectedCurrency,
      usdToEurRate: currencySnapshot.usdToEurRate,
    })
    const displayItems = draft.items.map((item) => ({
      ...item,
      displayPrice: currencySnapshot.selectedCurrency === "USD"
        ? item.price
        : Math.round(item.price * currencySnapshot.usdToEurRate * 100) / 100,
    }))

    const order = await prisma.order.create({
      data: {
        orderNumber: await nextOrderNumber(),
        userId: isCustomerSession ? sessionUser.id : null,
        customerName: input.customerName,
        customerEmail: input.customerEmail.toLowerCase(),
        total: draft.total,
        status: "PENDING",
        shipmentStatus: "PENDING",
        items: {
          create: draft.items.map((item) => ({
            productId: item.productId,
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
      addressLine2: input.addressLine2?.trim() || null,
      addressLine1: input.addressLine1?.trim() || null,
      city: input.city?.trim() || null,
      state: input.regionState?.trim() || null,
      postcode: input.postcode?.trim() || null,
      country: input.country?.trim() || null,
      paymentMethod: provider.toUpperCase(),
      paymentProvider: provider.toUpperCase(),
      paymentStatus: "PENDING",
      shippingMethod: shippingMethod.toUpperCase(),
      shippingCost: draft.shippingCost,
      subtotalAmount: draft.subtotal,
      taxAmount: draft.taxAmount,
      discountAmount: 0,
      currency: currencySnapshot.selectedCurrency,
      baseCurrency: "USD",
      baseSubtotalAmount: draft.subtotal,
      baseShippingAmount: draft.shippingCost,
      baseTaxAmount: draft.taxAmount,
      baseDiscountAmount: 0,
      baseTotalAmount: draft.total,
      displayCurrency: currencySnapshot.selectedCurrency,
      exchangeRateUsed: currencySnapshot.selectedCurrency === "EUR" ? currencySnapshot.usdToEurRate : 1,
      displaySubtotalAmount: displayAmounts.subtotal,
      displayShippingAmount: displayAmounts.shipping,
      displayTaxAmount: displayAmounts.tax,
      displayDiscountAmount: displayAmounts.discount,
      displayTotalAmount: displayAmounts.total,
      invoiceNumber: `INV-${order.orderNumber}`,
    })

    if (provider === "stripe" || provider === "gpay" || provider === "applepay") {
      const isGPay = provider === "gpay"
      const isApplePay = provider === "applepay"
      const secretKey = isGPay
        ? (settings.googlePayApiSecret || settings.stripeSecretKey)
        : isApplePay
          ? (settings.applePayApiSecret || settings.stripeSecretKey)
          : settings.stripeSecretKey
      const stripe = await createStripeCheckout({
        secretKey,
        origin,
        orderId: order.id,
        orderNumber: order.orderNumber,
        currency: currencySnapshot.selectedCurrency,
        items: displayItems.map((item) => ({
          title: item.title,
          quantity: item.quantity,
          price: item.displayPrice,
        })),
        shippingCost: displayAmounts.shipping,
        customerEmail: input.customerEmail,
      })
      console.info("[checkout] final shipping amount sent to stripe", {
        orderId: order.id,
        selectedShippingMethod: shippingMethod,
        shippingUsd: draft.shippingCost,
        shippingDisplayAmount: displayAmounts.shipping,
        shippingMinorAmount: asMinor(displayAmounts.shipping),
      })
      await saveOrderDetails(order.id, {
        paymentReference: stripe.externalPaymentId || null,
        paymentSessionId: stripe.externalPaymentId || null,
      })
      return NextResponse.json({ redirectUrl: stripe.redirectUrl, orderId: order.id, provider })
    }

    if (provider === "paypal") {
      const paypal = await createPayPalOrder({
        clientId: settings.paypalClientId,
        clientSecret: settings.paypalClientSecret,
        sandbox: settings.paypalMode !== "live",
        origin,
        orderId: order.id,
        orderNumber: order.orderNumber,
        amount: displayAmounts.total,
        currency: currencySnapshot.selectedCurrency,
      })
      return NextResponse.json({ redirectUrl: paypal.redirectUrl, orderId: order.id, provider: "paypal" })
    }

    const paytr = await createPayTRToken({
      settings,
      origin,
      orderId: order.id,
      amount: displayAmounts.total,
      currency: currencySnapshot.selectedCurrency,
      customerEmail: input.customerEmail.toLowerCase(),
      customerName: input.customerName,
      customerPhone: input.customerPhone || "",
      address: [input.addressLine1, input.addressLine2, input.city, input.postcode, input.country].filter(Boolean).join(" "),
      items: displayItems.map((item) => ({
        title: item.title,
        quantity: item.quantity,
        price: item.displayPrice,
      })),
      userIp: clientIp,
    })
    return NextResponse.json({ redirectUrl: paytr.redirectUrl, orderId: order.id, provider: "paytr" })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Payment initialization failed" }, { status: 500 })
  }
}
