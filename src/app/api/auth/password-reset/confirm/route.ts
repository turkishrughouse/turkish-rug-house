import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { consumePasswordResetToken } from "@/lib/password-reset"

const confirmSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Please confirm your password"),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = confirmSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid password reset request." }, { status: 400 })
    }

    if (parsed.data.password !== parsed.data.confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 })
    }

    const result = await consumePasswordResetToken(parsed.data.token, parsed.data.password)
    if (!result.success) {
      return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: "Your password has been updated.",
    })
  } catch {
    return NextResponse.json({ error: "Unable to reset password right now." }, { status: 500 })
  }
}
