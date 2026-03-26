import { Prisma } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSessionUser } from "@/lib/auth"
import { isAdminRole } from "@/lib/rbac"
import { addColumnIfMissing } from "@/lib/db-compat"

async function ensureProductCreatorColumns() {
  await addColumnIfMissing(prisma, "Product", "deletedAt", "TIMESTAMP(3)")
  await addColumnIfMissing(prisma, "Product", "createdById", "TEXT")
  await addColumnIfMissing(prisma, "Product", "createdByName", "TEXT")
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

function normalizeUserName(value: string | null | undefined) {
  return (value || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ")
}

function normalizeCreatedAt(value: unknown) {
  if (value instanceof Date) return value
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value)
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return null
    if (/^\d+$/.test(trimmed)) {
      const asNumber = Number(trimmed)
      return Number.isFinite(asNumber) ? new Date(asNumber) : null
    }
    const parsed = new Date(trimmed)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

function matchesUser(
  row: { createdById: string | null; createdByName: string | null },
  user: { id: string; name: string | null; email: string }
) {
  if (row.createdById && row.createdById === user.id) return true

  const rowName = normalizeUserName(row.createdByName)
  if (!rowName) return false

  const aliases = new Set<string>()
  const name = normalizeUserName(user.name)
  const email = normalizeUserName(user.email)
  const emailLocalPart = normalizeUserName(user.email.split("@")[0] || "")

  if (name) aliases.add(name)
  if (email) aliases.add(email)
  if (emailLocalPart) aliases.add(emailLocalPart)

  return aliases.has(rowName)
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

    const productRows = await prisma.$queryRaw<Array<{
      id: string
      title: string
      slug: string
      sku: string | null
      createdAt: Date | string | number
      createdById: string | null
      createdByName: string | null
    }>>(Prisma.sql`
      SELECT "id", "title", "slug", "sku", "createdAt", "createdById", "createdByName"
      FROM "Product"
      WHERE "deletedAt" IS NULL
      ORDER BY "createdAt" DESC
    `)

    const rowsByPeriod = (period: string) => {
      const startAt = getPeriodStart(period)
      return productRows.filter((row) => {
        const createdAt = normalizeCreatedAt(row.createdAt)
        return createdAt ? createdAt >= startAt : false
      })
    }

    const countForUsers = (users: Array<{ id: string; name: string | null; email: string }>, period: string) => {
      const rows = rowsByPeriod(period)
      const map = new Map<string, number>()
      users.forEach((user) => {
        const count = rows.reduce((total, row) => (matchesUser(row, user) ? total + 1 : total), 0)
        map.set(user.id, count)
      })
      return map
    }

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
      period: string
    ) => {
      const selected = users.find((entry) => entry.id === selectedUserId) || users[0] || null
      const rows = rowsByPeriod(period)
      const sectionProducts = selected
        ? rows
            .filter((row) => matchesUser(row, selected))
            .map((row) => {
              const createdAt = normalizeCreatedAt(row.createdAt)
              return {
            id: row.id,
            title: row.title,
            slug: row.slug,
            sku: row.sku,
                createdAt: createdAt ? createdAt.toISOString() : new Date(0).toISOString(),
              }
            })
        : []
      return {
        selectedUserId: selected?.id || "",
        total: sectionProducts.length,
        products: sectionProducts,
      }
    }

    const superCounts = countForUsers(superUsers, superPeriod)
    const adminCounts = countForUsers(adminUsers, adminPeriod)

    return NextResponse.json({
      period: "week",
      superUsers: superUsers.map((entry) => toUserOption(entry, superCounts)),
      adminUsers: adminUsers.map((entry) => toUserOption(entry, adminCounts)),
      superUserSection: buildSection(superUserId, superUsers, superPeriod),
      adminSection: buildSection(adminUserId, adminUsers, adminPeriod),
    })
  } catch (error) {
    console.error("Dashboard product creators error:", error)
    return NextResponse.json({ error: "Failed to fetch product creators" }, { status: 500 })
  }
}
