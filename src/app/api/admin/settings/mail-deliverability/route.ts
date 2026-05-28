import { NextResponse } from "next/server"
import { buildMailDeliverabilityReport } from "@/lib/email-deliverability"
import { getSiteSettings } from "@/lib/site-settings"
import { requireAdminApiAuth } from "@/lib/admin-guard"

export async function GET() {
  const auth = await requireAdminApiAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const settings = await getSiteSettings()
    return NextResponse.json(buildMailDeliverabilityReport(settings))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load mail deliverability report." },
      { status: 500 }
    )
  }
}
