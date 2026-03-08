import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSessionUser } from "@/lib/auth"

const PURCHASE_REQUIRED_MESSAGE = "You should buy a product to write a review"

function normalizeEmail(input: string) {
  return String(input || "").trim().toLowerCase()
}

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser("customer")
    const { searchParams } = new URL(req.url)
    const fallbackEmail = normalizeEmail(searchParams.get("email") || "")
    const email = normalizeEmail(sessionUser?.email || fallbackEmail)

    if (!email) {
      return NextResponse.json({
        allowed: false,
        message: PURCHASE_REQUIRED_MESSAGE,
      })
    }

    const purchaseRows = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*) as count
      FROM "Order"
      WHERE lower("customerEmail") = ${email}
        AND "status" != 'CANCELLED'
    `
    const purchaseCount = Number(purchaseRows?.[0]?.count || 0)
    if (purchaseCount < 1) {
      return NextResponse.json({
        allowed: false,
        message: PURCHASE_REQUIRED_MESSAGE,
        email,
      })
    }

    const access = await prisma.reviewAccess.findUnique({ where: { email } })
    if (!access || !access.approved || access.remainingReviews < 1) {
      return NextResponse.json({
        allowed: false,
        message: access && access.approved ? "Your review right is finished. Please contact support." : "Your review access is pending admin approval.",
        email,
        remainingReviews: access?.remainingReviews || 0,
      })
    }

    return NextResponse.json({
      allowed: true,
      email,
      remainingReviews: access.remainingReviews,
      message: "You can submit one review now.",
    })
  } catch (error) {
    console.error("GET /api/public/reviews/eligibility error:", error)
    return NextResponse.json({ error: "Failed to check review eligibility" }, { status: 500 })
  }
}
