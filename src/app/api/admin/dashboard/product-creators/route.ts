import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSessionUser } from "@/lib/auth"
import { isAdminRole } from "@/lib/rbac"

async function ensureProductCreatorColumns() {
  const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("Product")`)
  const hasDeletedAt = columns.some((column) => column.name === "deletedAt")
  const hasCreatorId = columns.some((column) => column.name === "createdById")
  const hasCreatorName = columns.some((column) => column.name === "createdByName")
  if (!hasDeletedAt) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN "deletedAt" DATETIME`)
  }
  if (!hasCreatorId) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN "createdById" TEXT`)
  }
  if (!hasCreatorName) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN "createdByName" TEXT`)
  }
}

function getPeriodStart(period: string) {
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (period === "year") return new Date(now.getFullYear(), 0, 1)
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1)
  const startWeek = new Date(startToday)
  startWeek.setDate(startWeek.getDate() - 6)
  return startWeek
}

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser("admin")
    if (!user || !isAdminRole(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await ensureProductCreatorColumns()

    const superPeriod = (req.nextUrl.searchParams.get("superPeriod") || "week").trim().toLowerCase()
    const adminPeriod = (req.nextUrl.searchParams.get("adminPeriod") || "week").trim().toLowerCase()
    const superUserId = (req.nextUrl.searchParams.get("superUserId") || "").trim()
    const adminUserId = (req.nextUrl.searchParams.get("adminUserId") || "").trim()

    const [superUsers, adminUsers] = await Promise.all([
      prisma.user.findMany({
        where: { role: "SUPER_USER" },
        orderBy: [{ name: "asc" }, { email: "asc" }],
        select: { id: true, name: true, email: true },
      }),
      prisma.user.findMany({
        where: { role: "ADMIN" },
        orderBy: [{ name: "asc" }, { email: "asc" }],
        select: { id: true, name: true, email: true },
      }),
    ])

    const countByIds = async (userIds: string[], period: string) => {
      if (userIds.length === 0) return new Map<string, number>()
      const startAt = getPeriodStart(period)
      const rows = await prisma.$queryRawUnsafe<Array<{ createdById: string | null; total: number | string }>>(
        `SELECT "createdById", COUNT(*) as "total"
         FROM "Product"
         WHERE "deletedAt" IS NULL
           AND "createdAt" >= ?
           AND "createdById" IN (${userIds.map(() => "?").join(",")})
         GROUP BY "createdById"`,
        startAt.toISOString(),
        ...userIds
      )
      return new Map(rows.map((row) => [row.createdById || "", Number(row.total || 0)]))
    }

    const queryProducts = async (userId: string, period: string) => {
      if (!userId) return [] as Array<{
        id: string
        title: string
        slug: string
        sku: string | null
        createdAt: Date | string
        createdById: string | null
      }>
      const startAt = getPeriodStart(period)
      return prisma.$queryRawUnsafe<Array<{
        id: string
        title: string
        slug: string
        sku: string | null
        createdAt: Date | string
        createdById: string | null
      }>>(
        `SELECT "id", "title", "slug", "sku", "createdAt", "createdById"
         FROM "Product"
         WHERE "deletedAt" IS NULL
           AND "createdAt" >= ?
           AND "createdById" = ?
         ORDER BY "createdAt" DESC`,
        startAt.toISOString(),
        userId
      )
    }

    const [superProducts, adminProducts, superCounts, adminCounts] = await Promise.all([
      queryProducts(superUserId, superPeriod),
      queryProducts(adminUserId, adminPeriod),
      countByIds(superUsers.map((entry) => entry.id), superPeriod),
      countByIds(adminUsers.map((entry) => entry.id), adminPeriod),
    ])

    const toUserOption = (account: { id: string; name: string | null; email: string }, counts: Map<string, number>) => {
      const count = Number(counts.get(account.id) || 0)
      return {
        id: account.id,
        label: account.name?.trim() || account.email,
        email: account.email,
        count,
      }
    }

    const buildSection = (
      selectedUserId: string,
      users: Array<{ id: string; name: string | null; email: string }>,
      products: Array<{ id: string; title: string; slug: string; sku: string | null; createdAt: Date | string; createdById: string | null }>
    ) => {
      const selected = users.find((entry) => entry.id === selectedUserId) || null
      const sectionProducts = selected
        ? products.map((row) => ({
            id: row.id,
            title: row.title,
            slug: row.slug,
            sku: row.sku,
            createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : new Date(row.createdAt).toISOString(),
          }))
        : []
      return {
        selectedUserId: selected?.id || "",
        total: sectionProducts.length,
        products: sectionProducts,
      }
    }

    return NextResponse.json({
      period: "week",
      superUsers: superUsers.map((entry) => toUserOption(entry, superCounts)),
      adminUsers: adminUsers.map((entry) => toUserOption(entry, adminCounts)),
      superUserSection: buildSection(superUserId, superUsers, superProducts),
      adminSection: buildSection(adminUserId, adminUsers, adminProducts),
    })
  } catch (error) {
    console.error("Dashboard product creators error:", error)
    return NextResponse.json({ error: "Failed to fetch product creators" }, { status: 500 })
  }
}
