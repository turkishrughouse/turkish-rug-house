import type { PrismaClient } from "@prisma/client"

type PrismaLike = Pick<PrismaClient, "$executeRawUnsafe">

function isDuplicateColumnError(error: unknown, columnName: string) {
  const message = error instanceof Error ? error.message : String(error)
  const normalized = message.toLowerCase()
  const quoted = `"${columnName.toLowerCase()}"`
  return normalized.includes("duplicate column") || (normalized.includes("already exists") && normalized.includes(columnName.toLowerCase())) || normalized.includes(quoted)
}

export async function addColumnIfMissing(prisma: PrismaLike, tableName: string, columnName: string, definition: string) {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${definition}`)
  } catch (error) {
    if (isDuplicateColumnError(error, columnName)) return
    throw error
  }
}
