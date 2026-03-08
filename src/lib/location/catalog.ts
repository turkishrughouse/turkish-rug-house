export type CountryOption = {
  code: string
  name: string
}

const FALLBACK_STATE_PRESETS: Record<string, string[]> = {
  TR: ["Istanbul", "Ankara", "Izmir", "Bursa", "Antalya"],
  US: ["California", "Texas", "Florida", "New York", "Illinois"],
  DE: ["Berlin", "Bavaria", "Hamburg", "Hesse", "Saxony"],
  GB: ["England", "Scotland", "Wales", "Northern Ireland"],
}

const FALLBACK_CITY_PRESETS: Record<string, string[]> = {
  TR: ["Istanbul", "Ankara", "Izmir", "Bursa", "Antalya"],
  US: ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix"],
  DE: ["Berlin", "Hamburg", "Munich", "Frankfurt", "Cologne"],
  GB: ["London", "Manchester", "Birmingham", "Liverpool", "Leeds"],
}

function safeDisplayNameOf(display: Intl.DisplayNames, code: string) {
  try {
    return display.of(code)
  } catch {
    return null
  }
}

export function getCountryOptions(): CountryOption[] {
  const excluded = new Set(["EU", "UN", "XA", "XB", "ZZ"])
  const options: CountryOption[] = []

  try {
    const display = new Intl.DisplayNames(["en"], { type: "region" })
    for (let i = 65; i <= 90; i += 1) {
      for (let j = 65; j <= 90; j += 1) {
        const code = String.fromCharCode(i) + String.fromCharCode(j)
        if (excluded.has(code)) continue
        const name = safeDisplayNameOf(display, code)
        if (!name || name === code) continue
        options.push({ code, name })
      }
    }
  } catch {
    // ignore
  }

  if (options.length > 0) {
    return options.sort((a, b) => a.name.localeCompare(b.name))
  }

  return [
    { code: "US", name: "United States" },
    { code: "TR", name: "Turkey" },
    { code: "GB", name: "United Kingdom" },
    { code: "DE", name: "Germany" },
  ]
}

export function getCountryNameByCode(countryCode: string): string {
  const normalized = (countryCode || "").toUpperCase()
  return getCountryOptions().find((country) => country.code === normalized)?.name || normalized
}

export function getFallbackStates(countryCode: string): string[] {
  return FALLBACK_STATE_PRESETS[(countryCode || "").toUpperCase()] || []
}

export function getFallbackCities(countryCode: string): string[] {
  return FALLBACK_CITY_PRESETS[(countryCode || "").toUpperCase()] || []
}
