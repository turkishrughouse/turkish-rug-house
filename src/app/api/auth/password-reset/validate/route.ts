import { NextRequest, NextResponse } from "next/server"
import { validatePasswordResetToken } from "@/lib/password-reset"

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || ""
  const result = await validatePasswordResetToken(token)

  if (!result) {
    return NextResponse.json({ valid: false }, { status: 404 })
  }

  return NextResponse.json({
    valid: true,
    expiresAt: result.passwordResetExpiresAt?.toISOString() || null,
  })
}
