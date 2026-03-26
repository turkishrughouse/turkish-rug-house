import { Prisma, type PrismaClient } from "@prisma/client"

type PrismaLike = Pick<PrismaClient, "$executeRaw" | "$queryRaw">

function sanitizeIdentifier(input: string) {
  const value = input.trim()
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Invalid SQL identifier: ${input}`)
  }
  return value
}

function isDuplicateColumnError(error: unknown, columnName: string) {
  const message = error instanceof Error ? error.message : String(error)
  const normalized = message.toLowerCase()
  const quoted = `"${columnName.toLowerCase()}"`
  return (
    normalized.includes("duplicate column") ||
    (normalized.includes("already exists") && normalized.includes(columnName.toLowerCase())) ||
    normalized.includes(quoted)
  )
}

export async function addColumnIfMissing(
  prisma: PrismaLike,
  tableName: string,
  columnName: string,
  definition: string
) {
  try {
    const safeTableName = sanitizeIdentifier(tableName)
    const safeColumnName = sanitizeIdentifier(columnName)
    await prisma.$executeRaw(
      Prisma.sql`ALTER TABLE ${Prisma.raw(`"${safeTableName}"`)} ADD COLUMN ${Prisma.raw(`"${safeColumnName}"`)} ${Prisma.raw(definition)}`
    )
  } catch (error) {
    if (isDuplicateColumnError(error, columnName)) return
    throw error
  }
}

export async function hasTableColumn(
  prisma: PrismaLike,
  tableName: string,
  columnName: string
): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = ${tableName}
        AND column_name = ${columnName}
      LIMIT 1
    `
    if (rows.length > 0) return true
  } catch {}

  try {
    const safeTableName = sanitizeIdentifier(tableName)
    const rows = await prisma.$queryRaw<Array<{ name?: string }>>(
      Prisma.raw(`PRAGMA table_info("${safeTableName}")`)
    )
    return rows.some((row) => row.name === columnName)
  } catch {}

  return false
}
