import { NextResponse } from "next/server"
import { buildMailDeliverabilityReport } from "@/lib/email-deliverability"
import { getSiteSettings } from "@/lib/site-settings"

export async function GET() {
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
