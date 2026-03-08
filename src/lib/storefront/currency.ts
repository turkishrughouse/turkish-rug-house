export type CurrencySettings = {
  defaultCurrency?: string
  currencyPosition?: "left" | "right" | "left-space" | "right-space"
  thousandSeparator?: string
  decimalSeparator?: string
  numberOfDecimals?: number
}

export function getCurrencySymbol(code?: string) {
  switch ((code || "USD").toUpperCase()) {
    case "TRY":
      return "₺"
    case "EUR":
      return "€"
    case "GBP":
      return "£"
    case "USD":
    default:
      return "$"
  }
}

function formatNumber(value: number, decimals = 2, thousand = ".", decimal = ",") {
  const safe = Number.isFinite(value) ? value : 0
  const fixed = safe.toFixed(Math.max(0, Math.min(4, decimals)))
  const [integerPart, decimalPart = ""] = fixed.split(".")
  const withThousands = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousand || ".")
  return decimalPart.length > 0 ? `${withThousands}${decimal || ","}${decimalPart}` : withThousands
}

export function formatCurrency(value: number, settings?: CurrencySettings) {
  const symbol = getCurrencySymbol(settings?.defaultCurrency)
  const number = formatNumber(
    value,
    settings?.numberOfDecimals ?? 2,
    settings?.thousandSeparator ?? ".",
    settings?.decimalSeparator ?? ","
  )
  const position = settings?.currencyPosition || "left"

  if (position === "right") return `${number}${symbol}`
  if (position === "left-space") return `${symbol} ${number}`
  if (position === "right-space") return `${number} ${symbol}`
  return `${symbol}${number}`
}
