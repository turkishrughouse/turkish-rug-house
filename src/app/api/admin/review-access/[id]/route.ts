import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSessionUser } from "@/lib/auth"

const ADMIN_ROLES = new Set(["SUPER_USER", "ADMIN", "MANAGER"])

async function requireAdmin() {
  const user = await getSessionUser("admin")
  if (!user || !ADMIN_ROLES.has(user.role)) return null
  return user
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    const approved = body?.approved
    const remainingReviewsRaw = body?.remainingReviews
    const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 600) : undefined

    const data: {
      approved?: boolean
      approvedAt?: Date | null
      approvedBy?: string | null
      remainingReviews?: number
      notes?: string | null
    } = {}

    if (typeof approved === "boolean") {
      data.approved = approved
      data.approvedAt = approved ? new Date() : null
      data.approvedBy = approved ? admin.email : null
    }

    if (typeof remainingReviewsRaw === "number" && Number.isFinite(remainingReviewsRaw)) {
      data.remainingReviews = Math.max(0, Math.floor(remainingReviewsRaw))
    }

    if (notes !== undefined) {
      data.notes = notes || null
    }

    const saved = await prisma.reviewAccess.update({
      where: { id },
      data,
    })

    return NextResponse.json({ success: true, item: saved })
  } catch (error) {
    console.error("PATCH /api/admin/review-access/[id] error:", error)
    return NextResponse.json({ error: "Failed to update review access" }, { status: 500 })
  }
}
