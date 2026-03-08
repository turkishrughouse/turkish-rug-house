import { prisma } from "@/lib/db"

const BLOCKLIST_KEY = "message_blocklist"

type MessageBlocklist = {
  emails: string[]
  phones: string[]
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function normalizePhone(value: string) {
  return value.trim()
}

function parseConfig(raw: string | null | undefined): MessageBlocklist {
  if (!raw) return { emails: [], phones: [] }
  try {
    const parsed = JSON.parse(raw) as { emails?: unknown; phones?: unknown }
    const emails = Array.isArray(parsed.emails)
      ? Array.from(
          new Set(
            parsed.emails
              .filter((item): item is string => typeof item === "string")
              .map(normalizeEmail)
              .filter(Boolean)
          )
        )
      : []
    const phones = Array.isArray(parsed.phones)
      ? Array.from(
          new Set(
            parsed.phones
              .filter((item): item is string => typeof item === "string")
              .map(normalizePhone)
              .filter(Boolean)
          )
        )
      : []
    return { emails, phones }
  } catch {
    return { emails: [], phones: [] }
  }
}

export async function getMessageBlocklist(): Promise<MessageBlocklist> {
  const row = await prisma.designSettings.findUnique({
    where: { key: BLOCKLIST_KEY },
    select: { config: true },
  })
  return parseConfig(row?.config)
}

export async function addBlockedSenders(input: { emails?: string[]; phones?: string[] }) {
  const current = await getMessageBlocklist()
  const nextEmails = Array.from(
    new Set([
      ...current.emails,
      ...(input.emails || []).map(normalizeEmail).filter(Boolean),
    ])
  )
  const nextPhones = Array.from(
    new Set([
      ...current.phones,
      ...(input.phones || []).map(normalizePhone).filter(Boolean),
    ])
  )

  const next: MessageBlocklist = {
    emails: nextEmails,
    phones: nextPhones,
  }

  await prisma.designSettings.upsert({
    where: { key: BLOCKLIST_KEY },
    update: { config: JSON.stringify(next) },
    create: { key: BLOCKLIST_KEY, config: JSON.stringify(next) },
  })

  return next
}

export async function removeBlockedSenders(input: { emails?: string[]; phones?: string[] }) {
  const current = await getMessageBlocklist()
  const removeEmails = new Set((input.emails || []).map(normalizeEmail).filter(Boolean))
  const removePhones = new Set((input.phones || []).map(normalizePhone).filter(Boolean))

  const next: MessageBlocklist = {
    emails: current.emails.filter((email) => !removeEmails.has(email)),
    phones: current.phones.filter((phone) => !removePhones.has(phone)),
  }

  await prisma.designSettings.upsert({
    where: { key: BLOCKLIST_KEY },
    update: { config: JSON.stringify(next) },
    create: { key: BLOCKLIST_KEY, config: JSON.stringify(next) },
  })

  return next
}

export async function isSenderBlocked(email?: string | null, phone?: string | null) {
  const blocklist = await getMessageBlocklist()
  const normalizedEmail = email ? normalizeEmail(email) : ""
  const normalizedPhone = phone ? normalizePhone(phone) : ""
  return (
    (normalizedEmail && blocklist.emails.includes(normalizedEmail)) ||
    (normalizedPhone && blocklist.phones.includes(normalizedPhone))
  )
}
