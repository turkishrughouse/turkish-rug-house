export type CountryOption = {
  code: string
  name: string
}

export type AddressRegionMode = "select" | "text" | "optional-text" | "none"

export type AddressCountryConfig = {
  regionLabel: string
  postalCodeLabel: string
  cityLabel: string
  regionMode: AddressRegionMode
  regionRequired: boolean
}

const FALLBACK_STATE_PRESETS: Record<string, string[]> = {
  TR: ["Istanbul", "Ankara", "Izmir", "Bursa", "Antalya"],
  US: ["California", "Texas", "Florida", "New York", "Illinois"],
  CA: ["Ontario", "Quebec", "British Columbia", "Alberta", "Manitoba"],
  AU: ["New South Wales", "Victoria", "Queensland", "Western Australia", "South Australia"],
  DE: ["Berlin", "Bavaria", "Hamburg", "Hesse", "Saxony"],
  GB: ["England", "Scotland", "Wales", "Northern Ireland"],
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

export function getAddressCountryConfig(countryCode: string): AddressCountryConfig {
  const code = (countryCode || "").toUpperCase()

  if (code === "US") {
    return {
      regionLabel: "State",
      postalCodeLabel: "ZIP code",
      cityLabel: "City",
      regionMode: "select",
      regionRequired: true,
    }
  }

  if (code === "CA") {
    return {
      regionLabel: "Province",
      postalCodeLabel: "Postal code",
      cityLabel: "City",
      regionMode: "select",
      regionRequired: true,
    }
  }

  if (code === "AU") {
    return {
      regionLabel: "State / Territory",
      postalCodeLabel: "Postcode",
      cityLabel: "Suburb / City",
      regionMode: "select",
      regionRequired: true,
    }
  }

  if (code === "GB") {
    return {
      regionLabel: "County / Region",
      postalCodeLabel: "Postcode",
      cityLabel: "Town / City",
      regionMode: "optional-text",
      regionRequired: false,
    }
  }

  if (code === "TR") {
    return {
      regionLabel: "Province",
      postalCodeLabel: "Postal code",
      cityLabel: "City",
      regionMode: "text",
      regionRequired: true,
    }
  }

  if (["DE", "FR", "IT", "ES", "NL", "BE", "AT", "CH", "SE", "NO", "DK", "IE"].includes(code)) {
    return {
      regionLabel: "Region / State",
      postalCodeLabel: "Postal code",
      cityLabel: "City",
      regionMode: "optional-text",
      regionRequired: false,
    }
  }

  return {
    regionLabel: "State / Province / Region",
    postalCodeLabel: "Postal code",
    cityLabel: "City",
    regionMode: "text",
    regionRequired: false,
  }
}
