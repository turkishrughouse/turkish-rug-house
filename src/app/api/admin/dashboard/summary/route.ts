import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSessionUser } from "@/lib/auth"
import { isAdminRole } from "@/lib/rbac"
import { addColumnIfMissing } from "@/lib/db-compat"

async function ensureProductAnalyticsColumns() {
  await addColumnIfMissing(prisma, "Product", "deletedAt", "TIMESTAMP(3)")
  await addColumnIfMissing(prisma, "Product", "createdById", "TEXT")
  await addColumnIfMissing(prisma, "Product", "createdByName", "TEXT")
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

function resolveCountryName(input: string | null | undefined) {
  if (!input) return "Unknown"
  const raw = input.trim()
  if (!raw) return "Unknown"
  if (raw.length === 2) return COUNTRY_CODE_TO_NAME[raw.toUpperCase()] || raw.toUpperCase()
  return raw
}

export async function GET() {
  try {
    const user = await getSessionUser("admin")
    if (!user || !isAdminRole(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    await ensureProductAnalyticsColumns()
    const now = new Date()
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const [totalOrders, totalCustomers, customerRows, totalProductsRows, productRows, pendingDeliveryRows, revenueAgg, weeklyOrders, todayOrders, revenueRows, adminSalesRows] = await Promise.all([
      prisma.order.count(),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.user.findMany({
        where: { role: "CUSTOMER" },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          lastLoginAt: true,
          customerProfile: {
            select: { country: true },
          },
        },
      }),
      prisma.$queryRaw<Array<{ count: bigint | number }>>`
        SELECT COUNT(*) as count
        FROM "Product"
        WHERE "deletedAt" IS NULL
          AND "isPublished" IS TRUE
      `,
      prisma.$queryRaw<Array<{ createdAt: Date | string; createdByName: string | null }>>`
        SELECT "createdAt", "createdByName"
        FROM "Product"
        WHERE "deletedAt" IS NULL
      `,
      prisma.order.findMany({
        select: {
          status: true,
          shipmentStatus: true,
        },
      }),
      prisma.order.aggregate({
        where: {
          status: { not: "CANCELLED" },
        },
        _sum: { total: true },
      }),
      prisma.order.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
          },
        },
        select: {
          createdAt: true,
          total: true,
          status: true,
        },
      }),
      prisma.order.findMany({
        where: {
          createdAt: {
            gte: startToday,
          },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
          createdAt: true,
          customerName: true,
          customerEmail: true,
          user: {
            select: {
              customerProfile: {
                select: { country: true },
              },
            },
          },
          items: {
            select: {
              title: true,
              quantity: true,
              price: true,
            },
          },
        },
      }),
      prisma.order.findMany({
        where: {
          status: { not: "CANCELLED" },
        },
        select: {
          createdAt: true,
          total: true,
        },
      }),
      prisma.$queryRaw<Array<{ creator: string | null; salesTotal: number | string | null; itemsSold: number | string | null }>>`
        SELECT
          COALESCE(p."createdByName", 'Unknown') as creator,
          SUM(CAST(oi."quantity" as DOUBLE PRECISION) * CAST(oi."price" as DOUBLE PRECISION)) as "salesTotal",
          SUM(CAST(oi."quantity" as DOUBLE PRECISION)) as "itemsSold"
        FROM "OrderItem" oi
        JOIN "Order" o ON o."id" = oi."orderId"
        LEFT JOIN "Product" p ON p."id" = oi."productId"
        WHERE o."status" != 'CANCELLED'
        GROUP BY COALESCE(p."createdByName", 'Unknown')
        ORDER BY "salesTotal" DESC NULLS LAST
      `,
    ])
    const totalProducts = Number(totalProductsRows?.[0]?.count || 0)
    const startWeek = new Date(startToday)
    startWeek.setDate(startWeek.getDate() - 6)
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startYear = new Date(now.getFullYear(), 0, 1)

    const byToday = new Map<string, number>()
    const byWeek = new Map<string, number>()
    const byMonth = new Map<string, number>()
    const byYear = new Map<string, number>()
    let todayCount = 0
    let weekCount = 0
    let monthCount = 0
    let yearCount = 0

    for (const row of productRows) {
      const createdAt = row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt)
      if (Number.isNaN(createdAt.getTime())) continue
      const creator = (row.createdByName || "").trim() || "Unknown"

      if (createdAt >= startYear) {
        yearCount += 1
        byYear.set(creator, (byYear.get(creator) || 0) + 1)
      }
      if (createdAt >= startMonth) {
        monthCount += 1
        byMonth.set(creator, (byMonth.get(creator) || 0) + 1)
      }
      if (createdAt >= startWeek) {
        weekCount += 1
        byWeek.set(creator, (byWeek.get(creator) || 0) + 1)
      }
      if (createdAt >= startToday) {
        todayCount += 1
        byToday.set(creator, (byToday.get(creator) || 0) + 1)
      }
    }

    const toSortedList = (map: Map<string, number>) =>
      Array.from(map.entries())
        .map(([creator, count]) => ({ creator, count }))
        .sort((a, b) => b.count - a.count || a.creator.localeCompare(b.creator))

    const productsAdded = {
      today: todayCount,
      week: weekCount,
      month: monthCount,
      year: yearCount,
    }
    const productsAddedBy = {
      today: toSortedList(byToday),
      week: toSortedList(byWeek),
      month: toSortedList(byMonth),
      year: toSortedList(byYear),
    }
    const customersCountryMap = new Map<string, number>()
    const customersByCountryDetails = customerRows.map((customer) => {
      const country = resolveCountryName(customer.customerProfile?.country)
      customersCountryMap.set(country, (customersCountryMap.get(country) || 0) + 1)
      return {
        id: customer.id,
        name: customer.name?.trim() || customer.email.split("@")[0] || "Customer",
        email: customer.email,
        country,
        createdAt: customer.createdAt.toISOString(),
        lastLoginAt: customer.lastLoginAt ? customer.lastLoginAt.toISOString() : null,
      }
    })
    const customersByCountry = Array.from(customersCountryMap.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country))
    const ordersBreakdown = {
      today: todayOrders.length,
      week: weeklyOrders.length,
      month: 0,
    }
    const customersBreakdown = {
      today: 0,
      week: 0,
      month: 0,
    }
    for (const order of revenueRows) {
      if (order.createdAt >= startMonth) ordersBreakdown.month += 1
    }
    for (const customer of customerRows) {
      if (customer.createdAt >= startMonth) customersBreakdown.month += 1
      if (customer.createdAt >= startWeek) customersBreakdown.week += 1
      if (customer.createdAt >= startToday) customersBreakdown.today += 1
    }
    const countryMap = new Map<string, number>()
    const ordersTodayDetails = todayOrders.map((order) => {
      const country = resolveCountryName(order.user?.customerProfile?.country)
      countryMap.set(country, (countryMap.get(country) || 0) + 1)
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        createdAt: order.createdAt.toISOString(),
        customer: order.customerName || order.customerEmail.split("@")[0] || "Customer",
        country,
        products: order.items.map((item) => ({
          title: item.title,
          quantity: item.quantity,
          price: Number(item.price || 0),
        })),
      }
    })
    const ordersTodayByCountry = Array.from(countryMap.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country))
    const pendingDeliveryBreakdown = {
      shipped: 0,
      cancelled: 0,
      pending: 0,
      other: 0,
    }
    for (const row of pendingDeliveryRows) {
      const status = (row.status || "").toUpperCase()
      const shipment = (row.shipmentStatus || "").toUpperCase()
      if (status === "CANCELLED") {
        pendingDeliveryBreakdown.cancelled += 1
        continue
      }
      if (shipment === "SHIPPED" || shipment === "IN_TRANSIT") {
        pendingDeliveryBreakdown.shipped += 1
        continue
      }
      if (status === "PENDING" || status === "PAID" || shipment === "PENDING") {
        pendingDeliveryBreakdown.pending += 1
        continue
      }
      pendingDeliveryBreakdown.other += 1
    }
    const pendingDelivery =
      pendingDeliveryBreakdown.shipped + pendingDeliveryBreakdown.pending + pendingDeliveryBreakdown.other
    let revenueToday = 0
    let revenueWeek = 0
    let revenueMonth = 0
    for (const row of revenueRows) {
      const createdAt = row.createdAt
      const amount = Number(row.total || 0)
      if (createdAt >= startMonth) revenueMonth += amount
      if (createdAt >= startWeek) revenueWeek += amount
      if (createdAt >= startToday) revenueToday += amount
    }
    const revenueBreakdown = {
      today: Number(revenueToday.toFixed(2)),
      week: Number(revenueWeek.toFixed(2)),
      month: Number(revenueMonth.toFixed(2)),
    }
    const salesBuckets = new Map<string, { income: number; expense: number }>()
    const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" })
    for (let i = 6; i >= 0; i -= 1) {
      const day = new Date()
      day.setHours(0, 0, 0, 0)
      day.setDate(day.getDate() - i)
      salesBuckets.set(day.toISOString().slice(0, 10), { income: 0, expense: 0 })
    }
    for (const order of weeklyOrders) {
      const key = order.createdAt.toISOString().slice(0, 10)
      const bucket = salesBuckets.get(key)
      if (!bucket) continue
      const amount = Number(order.total || 0)
      if (order.status === "CANCELLED") {
        bucket.expense += amount
      } else {
        bucket.income += amount
      }
    }
    const salesChart = Array.from(salesBuckets.entries()).map(([dateKey, values]) => {
      const date = new Date(`${dateKey}T00:00:00`)
      return {
        name: weekday.format(date),
        income: Number(values.income.toFixed(2)),
        expense: Number(values.expense.toFixed(2)),
      }
    })
    const salesIncome = salesChart.reduce((sum, row) => sum + row.income, 0)
    const salesExpense = salesChart.reduce((sum, row) => sum + row.expense, 0)
    const adminSalesByCreator = adminSalesRows
      .map((row) => ({
        creator: (row.creator || "Unknown").trim() || "Unknown",
        salesTotal: Number(row.salesTotal || 0),
        itemsSold: Number(row.itemsSold || 0),
      }))
      .sort((a, b) => b.salesTotal - a.salesTotal || a.creator.localeCompare(b.creator))

    return NextResponse.json({
      role: user.role,
      metrics: {
        totalOrders,
        ordersBreakdown,
        totalCustomers,
        customersBreakdown,
        customersByCountry,
        customersByCountryDetails,
        totalProducts,
        ordersTodayByCountry,
        ordersTodayDetails,
        productsAdded,
        productsAddedBy,
        pendingDelivery,
        pendingDeliveryBreakdown,
        totalRevenue: revenueAgg._sum.total ? Number(revenueAgg._sum.total) : 0,
        revenueBreakdown,
        salesAnalytics: {
          income: Number(salesIncome.toFixed(2)),
          expense: Number(salesExpense.toFixed(2)),
          chart: salesChart,
        },
        adminSalesByCreator,
      },
    })
  } catch (error) {
    console.error("Dashboard summary error:", error)
    return NextResponse.json({ error: "Failed to fetch dashboard summary" }, { status: 500 })
  }
}
