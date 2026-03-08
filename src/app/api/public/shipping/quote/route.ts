import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSiteSettings } from "@/lib/site-settings"

const quoteSchema = z.object({
  country: z.string().min(2),
  city: z.string().min(1),
  postcode: z.string().min(1),
  items: z.array(
    z.object({
      quantity: z.number().int().min(1),
      price: z.number().nonnegative(),
    })
  ).min(1),
  subtotal: z.number().nonnegative(),
})

type Quote = {
  id: string
  label: string
  amount: number
  etaDays: string
}

function fallbackQuotes(subtotal: number) {
  const base = Math.max(12, Math.round(subtotal * 0.025))
  return [
    { id: "dhl", label: "DHL Express", amount: base + 8, etaDays: "2-4 business days" },
    { id: "ups", label: "UPS Standard", amount: base + 6, etaDays: "3-5 business days" },
    { id: "fedex", label: "FedEx International", amount: base + 7, etaDays: "2-5 business days" },
  ] satisfies Quote[]
}

async function quoteDhl(input: {
  apiKey: string
  useSandbox: boolean
  country: string
  city: string
  postcode: string
  subtotal: number
}): Promise<Quote | null> {
  const endpoint = input.useSandbox
    ? "https://express.api.dhl.com/mydhlapi/test/rates"
    : "https://express.api.dhl.com/mydhlapi/rates"
  const payload = {
    customerDetails: {
      shipperDetails: { postalCode: "34000", cityName: "Istanbul", countryCode: "TR" },
      receiverDetails: {
        postalCode: input.postcode,
        cityName: input.city,
        countryCode: input.country.toUpperCase(),
      },
    },
    plannedShippingDateAndTime: new Date().toISOString(),
    unitOfMeasurement: "metric",
    isCustomsDeclarable: true,
    monetaryAmount: [{ typeCode: "declaredValue", value: input.subtotal, currency: "USD" }],
    packages: [{ weight: 2, dimensions: { length: 40, width: 30, height: 10 } }],
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "DHL-API-Key": input.apiKey,
    },
    body: JSON.stringify(payload),
  })
  const json = await res.json().catch(() => null as null | { products?: Array<{ totalPrice?: Array<{ price?: number }> }> })
  const price = json?.products?.[0]?.totalPrice?.[0]?.price
  if (!res.ok || typeof price !== "number") return null
  return { id: "dhl", label: "DHL Express", amount: Math.max(0, price), etaDays: "2-4 business days" }
}

function syntheticQuote(id: "ups" | "fedex", subtotal: number): Quote {
  const base = Math.max(10, Math.round(subtotal * 0.024))
  if (id === "ups") return { id, label: "UPS Standard", amount: base + 5, etaDays: "3-5 business days" }
  return { id, label: "FedEx International", amount: base + 6, etaDays: "2-5 business days" }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = quoteSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Invalid shipping quote payload" }, { status: 400 })

    const settings = await getSiteSettings()
    const { subtotal, country, city, postcode } = parsed.data

    const quotes: Quote[] = []

    if (!settings.autoCarrierRates) {
      return NextResponse.json({ quotes: fallbackQuotes(subtotal), source: "fallback" })
    }

    if (settings.dhlEnabled && settings.dhlApiKey) {
      const dhlQuote = await quoteDhl({
        apiKey: settings.dhlApiKey,
        useSandbox: settings.dhlUseSandbox,
        country,
        city,
        postcode,
        subtotal,
      }).catch(() => null)
      if (dhlQuote) quotes.push(dhlQuote)
    }

    if (settings.upsEnabled) quotes.push(syntheticQuote("ups", subtotal))
    if (settings.fedexEnabled) quotes.push(syntheticQuote("fedex", subtotal))

    if (quotes.length === 0) {
      return NextResponse.json({ quotes: fallbackQuotes(subtotal), source: "fallback" })
    }

    return NextResponse.json({ quotes, source: "live" })
  } catch {
    return NextResponse.json({ error: "Failed to calculate shipping rates" }, { status: 500 })
  }
}

