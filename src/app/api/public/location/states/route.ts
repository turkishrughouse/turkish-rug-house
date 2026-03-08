import { NextResponse } from "next/server"
import { getCountryNameByCode, getFallbackStates } from "@/lib/location/catalog"
import {
  resolveCountriesNowCountryNameByIso2,
  resolveCountriesNowStatesByIso2,
} from "@/lib/location/countriesnow"

type CountryNowStatesResponse = {
  error?: boolean
  msg?: string
  data?: {
    name?: string
    iso2?: string
    states?: Array<{ name?: string }>
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const countryCode = (searchParams.get("countryCode") || "").toUpperCase()
  const fallbackCountryName = searchParams.get("countryName") || getCountryNameByCode(countryCode)
  const countryName = await resolveCountriesNowCountryNameByIso2(countryCode, fallbackCountryName)

  if (!countryName && !countryCode) {
    return NextResponse.json({ states: [] })
  }

  const allStatesByCode = await resolveCountriesNowStatesByIso2(countryCode)
  if (allStatesByCode.length > 0) {
    return NextResponse.json({ states: allStatesByCode })
  }

  try {
    const res = await fetch("https://countriesnow.space/api/v0.1/countries/states", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country: countryName }),
      next: { revalidate: 60 * 60 * 24 },
    })
    if (res.ok) {
      const json = (await res.json()) as CountryNowStatesResponse
      const states = (json.data?.states || [])
        .map((state) => (state.name || "").trim())
        .filter((state) => state.length > 0)
      if (states.length > 0) {
        return NextResponse.json({ states })
      }
    }
  } catch {
    // ignore and use fallback
  }

  return NextResponse.json({ states: getFallbackStates(countryCode) })
}
