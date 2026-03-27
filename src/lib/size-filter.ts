export type FeetInches = {
  feet: number
  inches: number
}

export type ParsedCmSize = {
  widthCm: number
  heightCm: number
  normalized: string
}

export type SizeOptionLike = {
  id?: string
  slug?: string
  name?: string
  value?: string
}

const CM_PER_INCH = 2.54
const INCHES_PER_FOOT = 12

export function convertCmToFeet(cm: number): FeetInches {
  const totalInches = Math.round(cm / CM_PER_INCH)
  return {
    feet: Math.floor(totalInches / INCHES_PER_FOOT),
    inches: totalInches % INCHES_PER_FOOT,
  }
}

function formatFeetInches(value: FeetInches) {
  return `${value.feet}'${value.inches}"`
}

export function parseCmSizeInput(input: string): ParsedCmSize | null {
  const normalized = input.toLowerCase().replace(/\s+/g, "").replace(/cm/g, "")
  const match = normalized.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/)
  if (!match) return null

  const widthCm = Number(match[1])
  const heightCm = Number(match[2])
  if (!Number.isFinite(widthCm) || !Number.isFinite(heightCm) || widthCm <= 0 || heightCm <= 0) {
    return null
  }

  return {
    widthCm,
    heightCm,
    normalized: `${widthCm}x${heightCm}`,
  }
}

export function formatCmSizeWithFeet(input: string) {
  const parsed = parseCmSizeInput(input)
  if (!parsed) return null

  const widthFeet = convertCmToFeet(parsed.widthCm)
  const heightFeet = convertCmToFeet(parsed.heightCm)

  return `${parsed.normalized} cm (${formatFeetInches(widthFeet)} x ${formatFeetInches(heightFeet)})`
}

function toTotalInchesFromFeetString(value: string) {
  const normalized = value.toLowerCase().replace(/\s+/g, "").replace(/\+/g, "")
  const withMarks = normalized.match(/^(\d+)(?:'(\d{1,2})"?|(?:ft)?(\d{1,2})in)?$/)
  if (withMarks) {
    const feet = Number(withMarks[1] || 0)
    const inches = Number(withMarks[2] || withMarks[3] || 0)
    return feet * INCHES_PER_FOOT + inches
  }

  const numericFeet = Number(normalized)
  if (Number.isFinite(numericFeet)) {
    return Math.round(numericFeet * INCHES_PER_FOOT)
  }

  return null
}

function parseFeetSizeToInches(value: string) {
  const normalized = value.toLowerCase().replace(/\s*by\s*/g, "x").replace(/\s*x\s*/g, "x")
  const parts = normalized.split("x")
  if (parts.length !== 2) return null

  const width = toTotalInchesFromFeetString(parts[0] || "")
  const height = toTotalInchesFromFeetString(parts[1] || "")
  if (width === null || height === null) return null

  return [width, height] as const
}

function normalizeDimensions(width: number, height: number) {
  return width <= height ? ([width, height] as const) : ([height, width] as const)
}

function getOptionDimensionCandidates(option: SizeOptionLike) {
  return [option.slug || "", option.name || "", option.value || ""]
    .map((value) => parseFeetSizeToInches(value))
    .filter((value): value is readonly [number, number] => Boolean(value))
    .map(([width, height]) => normalizeDimensions(width, height))
}

function isWithinTolerance(
  targetWidth: number,
  targetHeight: number,
  optionWidth: number,
  optionHeight: number,
  toleranceInches: number,
) {
  const directMatch =
    Math.abs(targetWidth - optionWidth) <= toleranceInches &&
    Math.abs(targetHeight - optionHeight) <= toleranceInches
  const rotatedMatch =
    Math.abs(targetWidth - optionHeight) <= toleranceInches &&
    Math.abs(targetHeight - optionWidth) <= toleranceInches
  return directMatch || rotatedMatch
}

export function resolveMatchingSizeSlugsFromCmInput(
  input: string,
  sizeOptions: SizeOptionLike[],
  toleranceInches = 2,
) {
  const parsed = parseCmSizeInput(input)
  if (!parsed) return []

  const targetWidth = Math.round(parsed.widthCm / CM_PER_INCH)
  const targetHeight = Math.round(parsed.heightCm / CM_PER_INCH)
  const [normalizedTargetWidth, normalizedTargetHeight] = normalizeDimensions(targetWidth, targetHeight)

  return sizeOptions.flatMap((option) => {
    const candidates = getOptionDimensionCandidates(option)

    const matched = candidates.some(([width, height]) =>
      isWithinTolerance(normalizedTargetWidth, normalizedTargetHeight, width, height, toleranceInches),
    )

    return matched && option.slug ? [option.slug] : []
  })
}

export function resolveClosestSizeOptionFromCmInput(
  input: string,
  sizeOptions: SizeOptionLike[],
  toleranceInches = 6,
): SizeOptionLike | null {
  const parsed = parseCmSizeInput(input)
  if (!parsed) return null

  const targetWidth = Math.round(parsed.widthCm / CM_PER_INCH)
  const targetHeight = Math.round(parsed.heightCm / CM_PER_INCH)
  const [normalizedTargetWidth, normalizedTargetHeight] = normalizeDimensions(targetWidth, targetHeight)

  let bestMatch: { option: SizeOptionLike; score: number } | null = null

  for (const option of sizeOptions) {
    const candidates = getOptionDimensionCandidates(option)
    for (const [width, height] of candidates) {
      const widthDelta = Math.abs(normalizedTargetWidth - width)
      const heightDelta = Math.abs(normalizedTargetHeight - height)
      if (widthDelta > toleranceInches || heightDelta > toleranceInches) continue

      const score = widthDelta + heightDelta
      if (!bestMatch || score < bestMatch.score) {
        bestMatch = { option, score }
      }
    }
  }

  return bestMatch?.option ?? null
}
