import type { PrismaClient } from "@prisma/client"

type PrismaLike = Pick<PrismaClient, "$executeRawUnsafe" | "$queryRawUnsafe">

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
    await prisma.$executeRawUnsafe(`ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${definition}`)
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
    const rows = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = $1
        AND column_name = $2
      LIMIT 1
      `,
      tableName,
      columnName
    )
    if (rows.length > 0) return true
  } catch {}

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ name?: string }>>(
      `PRAGMA table_info("${tableName}")`
    )
    return rows.some((row) => row.name === columnName)
  } catch {}

  return false
}
