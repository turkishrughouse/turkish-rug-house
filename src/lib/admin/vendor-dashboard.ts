import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"

const VALID_SALES_STATUSES = ["PAID", "PROCESSING", "FULFILLED", "SHIPPED", "DELIVERED", "COMPLETED"] as const

function startOfTodayUtc() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))
}

function startOfWeekUtc() {
  const start = startOfTodayUtc()
  start.setUTCDate(start.getUTCDate() - 6)
  return start
}

function startOfYearUtc() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0))
}

function toNumber(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export type VendorDashboardMetrics = {
  productsAdded: {
    daily: number
    weekly: number
    yearly: number
    total: number
  }
  salesRevenue: {
    daily: number
    weekly: number
    yearly: number
    total: number
  }
}

async function countProductsAdded(userId: string, start: Date | null) {
  const where = start
    ? Prisma.sql`WHERE "createdById" = ${userId} AND "createdAt" >= ${start}`
    : Prisma.sql`WHERE "createdById" = ${userId}`

  const rows = await prisma.$queryRaw<Array<{ count: number | string }>>(
    Prisma.sql`SELECT COUNT(*) as count FROM "Product" ${where}`
  )
  return toNumber(rows[0]?.count)
}

async function sumRevenue(userId: string, start: Date | null) {
  const dateClause = start ? Prisma.sql`AND o."createdAt" >= ${start}` : Prisma.empty
  const rows = await prisma.$queryRaw<Array<{ revenue: number | string | null }>>(
    Prisma.sql`
      SELECT COALESCE(SUM(oi."quantity" * oi."price"), 0) as revenue
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
      JOIN "Product" p ON p."id" = oi."productId"
      WHERE p."createdById" = ${userId}
        AND o."status" IN (${Prisma.join(Array.from(VALID_SALES_STATUSES))})
        ${dateClause}
    `
  )
  const raw = rows[0]?.revenue ?? 0
  return Number(toNumber(raw).toFixed(2))
}

export async function getVendorDashboardMetrics(userId: string): Promise<VendorDashboardMetrics> {
  const dailyStart = startOfTodayUtc()
  const weeklyStart = startOfWeekUtc()
  const yearlyStart = startOfYearUtc()

  const [
    dailyProducts,
    weeklyProducts,
    yearlyProducts,
    totalProducts,
    dailyRevenue,
    weeklyRevenue,
    yearlyRevenue,
    totalRevenue,
  ] = await Promise.all([
    countProductsAdded(userId, dailyStart),
    countProductsAdded(userId, weeklyStart),
    countProductsAdded(userId, yearlyStart),
    countProductsAdded(userId, null),
    sumRevenue(userId, dailyStart),
    sumRevenue(userId, weeklyStart),
    sumRevenue(userId, yearlyStart),
    sumRevenue(userId, null),
  ])

  return {
    productsAdded: {
      daily: dailyProducts,
      weekly: weeklyProducts,
      yearly: yearlyProducts,
      total: totalProducts,
    },
    salesRevenue: {
      daily: dailyRevenue,
      weekly: weeklyRevenue,
      yearly: yearlyRevenue,
      total: totalRevenue,
    },
  }
}

