import { NextRequest, NextResponse } from "next/server"
import { resolveCountriesNowStatesByIso2 } from "@/lib/location/countriesnow"

export async function GET(req: NextRequest) {
  try {
    const countryCode = req.nextUrl.searchParams.get("countryCode") || ""
    const states = await resolveCountriesNowStatesByIso2(countryCode)
    return NextResponse.json({ states })
  } catch (error) {
    console.error("States API error:", error)
    return NextResponse.json({ states: [] }, { status: 200 })
  }
}
