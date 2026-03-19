import { prisma } from "@/lib/db"
import { getEnv } from "@/lib/env"

type EnsureColumnSpec = {
  name: string
  postgresType: string
  sqliteType?: string
}

function quoteIdent(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

export function isPostgresDatabase() {
  try {
    const normalized = String(getEnv().DATABASE_URL || "")
      .trim()
      .replace(/^['"]|['"]$/g, "")
      .toLowerCase()
    return normalized.startsWith("postgres")
  } catch {
    const normalized = String(process.env.DATABASE_URL || "")
      .trim()
      .replace(/^['"]|['"]$/g, "")
      .toLowerCase()
    return normalized.startsWith("postgres")
  }
}

export async function getTableColumnNames(tableName: string) {
  const tryPostgres = async () => {
    const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (table_name = ${tableName} OR table_name = ${tableName.toLowerCase()})
    `
    return new Set(rows.map((row) => row.column_name))
  }

  const trySqlite = async () => {
    const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      `PRAGMA table_info(${quoteIdent(tableName)})`
    )
    return new Set(rows.map((row) => row.name))
  }

  if (isPostgresDatabase()) {
    try {
      return await tryPostgres()
    } catch {
      return await trySqlite()
    }
  }

  try {
    return await trySqlite()
  } catch {
    return await tryPostgres()
  }
}

export async function hasTableColumn(tableName: string, columnName: string) {
  const columns = await getTableColumnNames(tableName)
  return columns.has(columnName)
}

export async function ensureTableColumns(tableName: string, specs: EnsureColumnSpec[]) {
  const existing = await getTableColumnNames(tableName)
  for (const spec of specs) {
    if (existing.has(spec.name)) continue
    const type = isPostgresDatabase() ? spec.postgresType : (spec.sqliteType || spec.postgresType)
    await prisma.$executeRawUnsafe(
      `ALTER TABLE ${quoteIdent(tableName)} ADD COLUMN ${quoteIdent(spec.name)} ${type}`
    )
    existing.add(spec.name)
  }
}

export function dbBooleanLiteral(value: boolean) {
  return isPostgresDatabase() ? (value ? "TRUE" : "FALSE") : (value ? "1" : "0")
}
