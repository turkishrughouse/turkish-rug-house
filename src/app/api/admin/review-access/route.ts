import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSessionUser } from "@/lib/auth-server"

const ADMIN_ROLES = new Set(["SUPER_USER", "ADMIN", "MANAGER"])

function normalizeEmail(input: string) {
  return String(input || "").trim().toLowerCase()
}

async function requireAdmin() {
  const user = await getSessionUser("admin")
  if (!user || !ADMIN_ROLES.has(user.role)) return null
  return user
}

export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const rows = await prisma.reviewAccess.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    return NextResponse.json({
      items: rows.map((item) => ({
        id: item.id,
        email: item.email,
        approved: item.approved,
        remainingReviews: item.remainingReviews,
        approvedAt: item.approvedAt,
        approvedBy: item.approvedBy,
        notes: item.notes,
        updatedAt: item.updatedAt,
        user: item.user,
      })),
    })
  } catch (error) {
    console.error("GET /api/admin/review-access error:", error)
    return NextResponse.json({ error: "Failed to load review access list" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const email = normalizeEmail(body?.email || "")
    const notes = String(body?.notes || "").trim().slice(0, 600)

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 })
    }

    const purchaseRows = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*) as count
      FROM "Order"
      WHERE lower("customerEmail") = ${email}
        AND "status" != 'CANCELLED'
    `
    const purchaseCount = Number(purchaseRows?.[0]?.count || 0)

    if (purchaseCount < 1) {
      return NextResponse.json(
        { error: "No completed customer purchase found for this email" },
        { status: 400 }
      )
    }

    const linkedUserRows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "User"
      WHERE lower("email") = ${email}
      LIMIT 1
    `
    const linkedUser = linkedUserRows[0] || null

    const now = new Date()
    const existing = await prisma.reviewAccess.findUnique({ where: { email } })

    const saved = existing
      ? await prisma.reviewAccess.update({
          where: { id: existing.id },
          data: {
            approved: true,
            approvedAt: now,
            approvedBy: admin.email,
            notes: notes || existing.notes,
            userId: linkedUser?.id || existing.userId,
            remainingReviews: { increment: 1 },
          },
        })
      : await prisma.reviewAccess.create({
          data: {
            email,
            userId: linkedUser?.id || null,
            approved: true,
            approvedAt: now,
            approvedBy: admin.email,
            notes: notes || null,
            remainingReviews: 1,
          },
        })

    return NextResponse.json({
      success: true,
      item: {
        id: saved.id,
        email: saved.email,
        approved: saved.approved,
        remainingReviews: saved.remainingReviews,
        approvedAt: saved.approvedAt,
        approvedBy: saved.approvedBy,
        notes: saved.notes,
      },
    })
  } catch (error) {
    console.error("POST /api/admin/review-access error:", error)
    return NextResponse.json({ error: "Failed to grant review access" }, { status: 500 })
  }
}
