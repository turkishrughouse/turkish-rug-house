type CountriesNowCountry = {
  country: string
  iso2?: string
}

type CountriesNowState = {
  name?: string
}

type CountriesNowCountryWithStates = {
  name?: string
  iso2?: string
  states?: CountriesNowState[]
}

let countryNameByIso2Cache: Map<string, string> | null = null
let statesByIso2Cache: Map<string, string[]> | null = null

function normalizeCode(code: string) {
  return (code || "").trim().toUpperCase()
}

function normalizeCountryNameForApi(name: string) {
  const raw = (name || "").trim()
  if (!raw) return raw
  const alias: Record<string, string> = {
    "Türkiye": "Turkey",
    "Czechia": "Czech Republic",
    "Russian Federation": "Russia",
    "Korea, Republic of": "South Korea",
    "Korea, Democratic People's Republic of": "North Korea",
  }
  return alias[raw] || raw
}

async function fetchCountryIsoMapFromCountriesNow() {
  if (countryNameByIso2Cache) return countryNameByIso2Cache

  const map = new Map<string, string>()
  const res = await fetch("https://countriesnow.space/api/v0.1/countries/iso", {
    method: "GET",
    next: { revalidate: 60 * 60 * 24 },
  })
  if (!res.ok) throw new Error("countriesnow iso list request failed")
  const json = (await res.json()) as { data?: CountriesNowCountry[] }
  for (const row of json.data || []) {
    const code = normalizeCode(row.iso2 || "")
    const country = normalizeCountryNameForApi(row.country || "")
    if (!code || !country) continue
    map.set(code, country)
  }
  countryNameByIso2Cache = map
  return map
}

async function fetchStatesMapFromCountriesNow() {
  if (statesByIso2Cache) return statesByIso2Cache

  const map = new Map<string, string[]>()
  const res = await fetch("https://countriesnow.space/api/v0.1/countries/states", {
    method: "GET",
    next: { revalidate: 60 * 60 * 24 },
  })
  if (!res.ok) throw new Error("countriesnow states list request failed")
  const json = (await res.json()) as { data?: CountriesNowCountryWithStates[] }
  for (const row of json.data || []) {
    const code = normalizeCode(row.iso2 || "")
    if (!code) continue
    const states = (row.states || [])
      .map((state) => (state.name || "").trim())
      .filter((state) => state.length > 0)
    map.set(code, Array.from(new Set(states)))
  }
  statesByIso2Cache = map
  return map
}

export async function resolveCountriesNowCountryNameByIso2(code: string, fallbackName?: string) {
  const normalizedCode = normalizeCode(code)
  if (!normalizedCode) return normalizeCountryNameForApi(fallbackName || "")
  try {
    const map = await fetchCountryIsoMapFromCountriesNow()
    const found = map.get(normalizedCode)
    if (found) return found
  } catch {
    // ignore and fallback below
  }
  return normalizeCountryNameForApi(fallbackName || "")
}

export async function resolveCountriesNowStatesByIso2(code: string) {
  const normalizedCode = normalizeCode(code)
  if (!normalizedCode) return []
  try {
    const map = await fetchStatesMapFromCountriesNow()
    const states = map.get(normalizedCode)
    if (states && states.length > 0) return states
  } catch {
    // ignore and fallback
  }
  return []
}
