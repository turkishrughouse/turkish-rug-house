export type SupplierRecord = {
  name: string
  number: string
  company: string
  phone: string
  note: string
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizePrefix(value: unknown) {
  return cleanText(value).toUpperCase()
}

export function normalizeSku(value: unknown) {
  return normalizePrefix(value)
}

export function normalizeSupplierRecord(input: unknown): SupplierRecord | null {
  if (!input || typeof input !== "object") return null
  const supplier: SupplierRecord = {
    name: cleanText((input as { name?: unknown }).name),
    number: normalizePrefix((input as { number?: unknown }).number),
    company: cleanText((input as { company?: unknown }).company),
    phone: cleanText((input as { phone?: unknown }).phone),
    note: cleanText((input as { note?: unknown }).note),
  }

  if (!supplier.name && !supplier.number && !supplier.company) {
    return null
  }

  return supplier
}

function mergeSupplierRecords(current: SupplierRecord, incoming: SupplierRecord): SupplierRecord {
  return {
    name: current.name || incoming.name,
    number: current.number || incoming.number,
    company: current.company || incoming.company,
    phone: current.phone || incoming.phone,
    note: current.note || incoming.note,
  }
}

export function getSupplierIdentityKey(supplier: SupplierRecord) {
  const normalized = normalizeSupplierRecord(supplier)
  if (!normalized) return ""
  if (normalized.number) return `number:${normalized.number}`
  return [
    normalized.name.toUpperCase(),
    normalized.company.toUpperCase(),
    normalized.phone.toUpperCase(),
    normalized.note.toUpperCase(),
  ].join("||")
}

export function normalizeSuppliers(input: unknown): SupplierRecord[] {
  if (!Array.isArray(input)) return []

  const deduped = new Map<string, SupplierRecord>()
  for (const item of input) {
    const supplier = normalizeSupplierRecord(item)
    if (!supplier) continue
    const key = getSupplierIdentityKey(supplier)
    if (!key) continue
    const existing = deduped.get(key)
    deduped.set(key, existing ? mergeSupplierRecords(existing, supplier) : supplier)
  }

  return Array.from(deduped.values()).sort((left, right) => {
    const leftLabel = left.company || left.name || left.number
    const rightLabel = right.company || right.name || right.number
    return leftLabel.localeCompare(rightLabel, "tr")
  })
}

export function matchSupplierBySkuPrefix(sku: string | null | undefined, suppliers: SupplierRecord[]): SupplierRecord | null {
  const normalizedSku = normalizeSku(sku)
  if (!normalizedSku) return null

  const candidates = normalizeSuppliers(suppliers).filter(
    (supplier) => supplier.number && normalizedSku.startsWith(supplier.number)
  )

  if (candidates.length === 0) return null

  candidates.sort((left, right) => {
    if (right.number.length !== left.number.length) {
      return right.number.length - left.number.length
    }

    return getSupplierIdentityKey(left).localeCompare(getSupplierIdentityKey(right), "tr")
  })

  return candidates[0] || null
}
