import { NextResponse } from "next/server"

type CountriesNowCountry = {
  name?: string
  country?: string
  Iso2?: string
  iso2?: string
}

function normalizeCountryName(name: string) {
  const raw = (name || "").trim()
  const alias: Record<string, string> = {
    "Türkiye": "Turkey",
    "Czechia": "Czech Republic",
    "Russian Federation": "Russia",
    "Korea, Republic of": "South Korea",
    "Korea, Democratic People's Republic of": "North Korea",
  }
  return alias[raw] || raw
}

export async function GET() {
  try {
    const res = await fetch("https://countriesnow.space/api/v0.1/countries/iso", {
      method: "GET",
      next: { revalidate: 60 * 60 * 24 },
    })

    if (!res.ok) throw new Error("countriesnow iso list request failed")

    const json = (await res.json()) as { data?: CountriesNowCountry[] }

    const countries = (json.data || [])
      .map((row) => ({
        code: String(row.Iso2 || row.iso2 || "").trim().toUpperCase(),
        name: normalizeCountryName(String(row.name || row.country || "")),
      }))
      .filter((item) => item.code && item.name)
      .sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ countries })
  } catch (error) {
    console.error("Countries API error:", error)
    return NextResponse.json({ countries: [] }, { status: 200 })
  }
}
