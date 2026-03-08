import { NextResponse } from "next/server"
import { getCountryOptions } from "@/lib/location/catalog"

type CountriesNowCountry = { country?: string; iso2?: string }

export async function GET() {
  try {
    const res = await fetch("https://countriesnow.space/api/v0.1/countries/iso", {
      method: "GET",
      next: { revalidate: 60 * 60 * 24 },
    })
    if (res.ok) {
      const json = (await res.json()) as { data?: CountriesNowCountry[] }
      const rows = (json.data || [])
        .map((row) => ({
          code: (row.iso2 || "").trim().toUpperCase(),
          name: (row.country || "").trim(),
        }))
        .filter((row) => row.code.length === 2 && row.name.length > 0)
      if (rows.length > 0) {
        rows.sort((a, b) => a.name.localeCompare(b.name))
        return NextResponse.json({ countries: rows })
      }
    }
  } catch {
    // ignore and fallback
  }
  return NextResponse.json({ countries: getCountryOptions() })
}
