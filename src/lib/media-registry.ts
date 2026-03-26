import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"

export type MediaRegistryRow = {
  id: string
  image_url: string
  width: number | null
  height: number | null
  alt: string | null
  sort_order: number
  is_primary: number
  variant: string | null
  master_url: string | null
  checksum: string | null
  mime_type: string | null
  size_bytes: number | null
  storage_provider: string | null
  object_key: string | null
}

export async function ensureMediaRegistryTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "MediaAsset" (
      "id" TEXT PRIMARY KEY,
      "image_url" TEXT NOT NULL UNIQUE,
      "width" INTEGER,
      "height" INTEGER,
      "alt" TEXT,
      "sort_order" INTEGER NOT NULL DEFAULT 0,
      "is_primary" INTEGER NOT NULL DEFAULT 0,
      "variant" TEXT,
      "master_url" TEXT,
      "checksum" TEXT,
      "mime_type" TEXT,
      "size_bytes" INTEGER,
      "storage_provider" TEXT,
      "object_key" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `
}

export async function findMediaByChecksum(checksum: string) {
  await ensureMediaRegistryTable()
  return prisma.$queryRaw<MediaRegistryRow[]>`SELECT * FROM "MediaAsset" WHERE "checksum" = ${checksum} ORDER BY "is_primary" DESC, "sort_order" ASC`
}

export async function upsertMediaAsset(row: {
  id: string
  image_url: string
  width?: number | null
  height?: number | null
  alt?: string | null
  sort_order?: number
  is_primary?: boolean
  variant?: string | null
  master_url?: string | null
  checksum?: string | null
  mime_type?: string | null
  size_bytes?: number | null
  storage_provider?: string | null
  object_key?: string | null
}) {
  await ensureMediaRegistryTable()
  const stableId = row.object_key || row.id || row.image_url
  await prisma.$executeRaw`
      INSERT INTO "MediaAsset" (
        "id", "image_url", "width", "height", "alt", "sort_order", "is_primary", "variant", "master_url",
        "checksum", "mime_type", "size_bytes", "storage_provider", "object_key", "updated_at"
      ) VALUES (${stableId}, ${row.image_url}, ${row.width ?? null}, ${row.height ?? null}, ${row.alt ?? null}, ${row.sort_order ?? 0}, ${row.is_primary ? 1 : 0}, ${row.variant ?? null}, ${row.master_url ?? null}, ${row.checksum ?? null}, ${row.mime_type ?? null}, ${row.size_bytes ?? null}, ${row.storage_provider ?? null}, ${row.object_key ?? null}, CURRENT_TIMESTAMP)
      ON CONFLICT("image_url") DO UPDATE SET
        "width"=excluded."width",
        "height"=excluded."height",
        "alt"=excluded."alt",
        "sort_order"=excluded."sort_order",
        "is_primary"=excluded."is_primary",
        "variant"=excluded."variant",
        "master_url"=excluded."master_url",
        "checksum"=excluded."checksum",
        "mime_type"=excluded."mime_type",
        "size_bytes"=excluded."size_bytes",
        "storage_provider"=excluded."storage_provider",
        "object_key"=excluded."object_key",
        "updated_at"=CURRENT_TIMESTAMP
    `
}
