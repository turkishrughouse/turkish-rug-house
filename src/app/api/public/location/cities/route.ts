import { NextResponse } from "next/server"
import { getCountryNameByCode, getFallbackCities } from "@/lib/location/catalog"
import { resolveCountriesNowCountryNameByIso2 } from "@/lib/location/countriesnow"

type CountryNowCitiesResponse = {
  error?: boolean
  msg?: string
  data?: string[]
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const countryCode = (searchParams.get("countryCode") || "").toUpperCase()
  const state = (searchParams.get("state") || "").trim()
  const fallbackCountryName = searchParams.get("countryName") || getCountryNameByCode(countryCode)
  const countryName = await resolveCountriesNowCountryNameByIso2(countryCode, fallbackCountryName)

  if (!countryName && !countryCode) {
    return NextResponse.json({ cities: [] })
  }

  const requestPayload = state.length > 0 ? { country: countryName, state } : { country: countryName }
  const requestUrl =
    state.length > 0
      ? "https://countriesnow.space/api/v0.1/countries/state/cities"
      : "https://countriesnow.space/api/v0.1/countries/cities"

  try {
    const res = await fetch(requestUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload),
      next: { revalidate: 60 * 60 * 24 },
    })
    if (res.ok) {
      const json = (await res.json()) as CountryNowCitiesResponse
      const cities = (json.data || [])
        .map((city) => (city || "").trim())
        .filter((city) => city.length > 0)
      if (cities.length > 0) {
        return NextResponse.json({ cities })
      }
    }
  } catch {
    // ignore and use fallback
  }

  return NextResponse.json({ cities: getFallbackCities(countryCode) })
}
