import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSessionUser } from "@/lib/auth"
import { isAdminRole } from "@/lib/rbac"
import { getLiveVisitorEvents } from "@/lib/live-visitor-activity"

type CountryMeta = { code: string; name: string }

const COUNTRY_NAME_TO_CODE: Record<string, CountryMeta> = {
  turkey: { code: "TR", name: "Turkey" },
  turkiye: { code: "TR", name: "Turkey" },
  "türkiye": { code: "TR", name: "Turkey" },
  "united states": { code: "US", name: "United States" },
  usa: { code: "US", name: "United States" },
  canada: { code: "CA", name: "Canada" },
  germany: { code: "DE", name: "Germany" },
  france: { code: "FR", name: "France" },
  italy: { code: "IT", name: "Italy" },
  spain: { code: "ES", name: "Spain" },
  "united kingdom": { code: "GB", name: "United Kingdom" },
  uk: { code: "GB", name: "United Kingdom" },
  australia: { code: "AU", name: "Australia" },
  japan: { code: "JP", name: "Japan" },
  china: { code: "CN", name: "China" },
  india: { code: "IN", name: "India" },
  brazil: { code: "BR", name: "Brazil" },
  mexico: { code: "MX", name: "Mexico" },
  "united arab emirates": { code: "AE", name: "United Arab Emirates" },
  uae: { code: "AE", name: "United Arab Emirates" },
  saudi: { code: "SA", name: "Saudi Arabia" },
  "saudi arabia": { code: "SA", name: "Saudi Arabia" },
  "united states of america": { code: "US", name: "United States" },
  america: { code: "US", name: "United States" },
  "turkey / istanbul": { code: "TR", name: "Turkey" },
}

const COUNTRY_CODE_TO_NAME: Record<string, string> = {
  TR: "Turkey",
  US: "United States",
  CA: "Canada",
  DE: "Germany",
  FR: "France",
  IT: "Italy",
  ES: "Spain",
  GB: "United Kingdom",
  AU: "Australia",
  JP: "Japan",
  CN: "China",
  IN: "India",
  BR: "Brazil",
  MX: "Mexico",
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
}

function resolveCountry(raw: string | null | undefined): CountryMeta | null {
  if (!raw) return null
  const value = raw.trim()
  if (!value) return null

  if (value.length === 2 && /^[a-zA-Z]{2}$/.test(value)) {
    const code = value.toUpperCase()
    return { code, name: COUNTRY_CODE_TO_NAME[code] || code }
  }

  const key = value.toLowerCase()
  if (COUNTRY_NAME_TO_CODE[key]) return COUNTRY_NAME_TO_CODE[key]
  for (const [name, meta] of Object.entries(COUNTRY_NAME_TO_CODE)) {
    if (key.includes(name)) return meta
  }
  return null
}

function actionFromStatus(status: string) {
  if (status === "PAID") return "Payment received"
  if (status === "FULFILLED") return "Order fulfilled"
  if (status === "PENDING") return "Checkout started"
  if (status === "CANCELLED") return "Order cancelled"
  return "Order update"
}

export async function GET() {
  try {
    const user = await getSessionUser("admin")
    if (!user || !isAdminRole(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [orders, customers] = await Promise.all([
      prisma.order.findMany({
        take: 120,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
        status: true,
        userId: true,
          customerName: true,
          customerEmail: true,
          updatedAt: true,
          user: {
            select: {
              customerProfile: {
                select: {
                  country: true,
                },
              },
            },
          },
        },
      }),
      prisma.user.findMany({
        where: {
          role: "CUSTOMER",
          customerProfile: {
            isNot: null,
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          customerProfile: {
            select: {
              country: true,
            },
          },
        },
      }),
    ])

    const orderEvents = orders
      .map((order) => {
        const country = resolveCountry(order.user?.customerProfile?.country)
        if (!country) return null
        return {
          id: order.id,
          actorKey: order.userId || order.customerEmail.toLowerCase(),
          orderNumber: order.orderNumber,
          customerName: order.customerName || order.customerEmail.split("@")[0] || "Customer",
          email: order.customerEmail || null,
          countryCode: country.code,
          countryName: country.name,
          action: actionFromStatus(order.status),
          currentPath: "/checkout",
          createdAt: order.updatedAt.toISOString(),
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))

    const registeredMap = new Map<string, number>()
    customers.forEach((user) => {
      const country = resolveCountry(user.customerProfile?.country)
      if (!country) return
      registeredMap.set(country.code, (registeredMap.get(country.code) || 0) + 1)
    })

    const customerEvents = customers
      .map((user) => {
        const country = resolveCountry(user.customerProfile?.country)
        if (!country) return null
        const eventDate = user.lastLoginAt || user.updatedAt || user.createdAt
        return {
          id: `customer-${user.id}-${eventDate.getTime()}`,
          actorKey: user.id,
          orderNumber: "ACCOUNT",
          customerName: user.name?.trim() || user.email.split("@")[0] || "Customer",
          email: user.email || null,
          countryCode: country.code,
          countryName: country.name,
          action: user.lastLoginAt ? "Customer login" : "Profile updated",
          currentPath: "/account",
          createdAt: eventDate.toISOString(),
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))

    const liveEvents = getLiveVisitorEvents(15 * 60 * 1000, 150)
      .filter((event) => resolveCountry(event.countryCode))
      .map((event) => {
        const country = resolveCountry(event.countryCode)!
        return {
          ...event,
          email: null,
          countryCode: country.code,
          countryName: country.name,
        }
      })

    const allEvents = [...liveEvents, ...orderEvents, ...customerEvents]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 120)

    // Keep active users visible for longer to avoid flicker on short idle periods.
    const activeWindowMs = 15 * 60 * 1000
    const now = Date.now()
    const activeEvents = allEvents.filter((event) => now - new Date(event.createdAt).getTime() <= activeWindowMs)

    const countryMap = new Map<string, { code: string; name: string; count: number; lastAt: string; registeredCustomers: number; actors: Set<string> }>()
    activeEvents.forEach((event) => {
      const existing = countryMap.get(event.countryCode)
      if (!existing) {
        countryMap.set(event.countryCode, {
          code: event.countryCode,
          name: event.countryName,
          count: 1,
          lastAt: event.createdAt,
          registeredCustomers: registeredMap.get(event.countryCode) || 0,
          actors: new Set([event.actorKey]),
        })
        return
      }
      existing.actors.add(event.actorKey)
      existing.count = existing.actors.size
      if (new Date(event.createdAt) > new Date(existing.lastAt)) {
        existing.lastAt = event.createdAt
      }
    })

    const countries = Array.from(countryMap.values())
      .map((row) => ({
        code: row.code,
        name: row.name,
        count: row.count,
        lastAt: row.lastAt,
        registeredCustomers: row.registeredCustomers,
      }))
      .sort((a, b) => b.count - a.count)
    const registeredByCountry = Object.fromEntries(Array.from(registeredMap.entries()))

    return NextResponse.json({
      countries,
      registeredByCountry,
      events: allEvents.slice(0, 20),
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Customer activity map error:", error)
    return NextResponse.json({ error: "Failed to fetch customer activity" }, { status: 500 })
  }
}
