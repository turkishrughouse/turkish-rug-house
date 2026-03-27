import { randomUUID } from "node:crypto"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/db"
import { addColumnIfMissing } from "@/lib/db-compat"

export type AttributeGroupRecord = {
  id: string
  key: string
  name: string
  slug: string
  sortOrder: number
  isFilterable: boolean
  isVisibleOnProduct: boolean
  isRequired: boolean
  isMultiSelect: boolean
  isActive: boolean
  selectionMode: "single" | "multiple"
  source: "dynamic" | "legacy"
  options: AttributeValueRecord[]
}

export type AttributeValueRecord = {
  id: string
  groupId: string
  value: string
  slug: string
  sortOrder: number
  isActive: boolean
  hex?: string | null
}

export type ProductAttributeSelectionInput = Record<string, string[]>

export type AttributeFacetGroup = {
  id: string
  key: string
  name: string
  slug: string
  selectionMode: "single" | "multiple"
  isPrimarySeoFacet: boolean
  options: Array<{
    id: string
    slug: string
    value: string
    hex?: string | null
    count: number
  }>
}

const CUSTOM_SETTINGS_KEY = "product_custom_attributes"
let ensurePromise: Promise<void> | null = null

const STANDARD_ATTRIBUTE_GROUPS = [
  {
    key: "type",
    name: "Type",
    slug: "type",
    sortOrder: 1,
    isFilterable: true,
    isVisibleOnProduct: true,
    isRequired: true,
    isMultiSelect: false,
    values: ["Oushak", "Kilim", "Vintage", "Anatolian", "Persian Style", "Moroccan Style"],
  },
  {
    key: "size",
    name: "Size",
    slug: "size",
    sortOrder: 2,
    isFilterable: true,
    isVisibleOnProduct: true,
    isRequired: true,
    isMultiSelect: false,
    values: ["2x3", "3x5", "4x6", "5x8", "6x9", "8x10", "9x12", "10x14+"],
  },
  {
    key: "color",
    name: "Color",
    slug: "color",
    sortOrder: 3,
    isFilterable: true,
    isVisibleOnProduct: true,
    isRequired: true,
    isMultiSelect: false,
    values: ["Beige", "Ivory", "Brown", "Blue", "Red", "Green", "Multicolor"],
  },
  {
    key: "material",
    name: "Material",
    slug: "material",
    sortOrder: 4,
    isFilterable: true,
    isVisibleOnProduct: true,
    isRequired: true,
    isMultiSelect: false,
    values: ["Wool", "Wool & Cotton", "Wool & Silk", "Cotton"],
  },
  {
    key: "origin",
    name: "Origin",
    slug: "origin",
    sortOrder: 5,
    isFilterable: true,
    isVisibleOnProduct: true,
    isRequired: true,
    isMultiSelect: false,
    values: ["Turkey", "Central Anatolia", "Western Anatolia", "Eastern Anatolia"],
  },
  {
    key: "age",
    name: "Age",
    slug: "age",
    sortOrder: 6,
    isFilterable: true,
    isVisibleOnProduct: true,
    isRequired: true,
    isMultiSelect: false,
    values: ["New", "Vintage", "Antique"],
  },
  {
    key: "pattern",
    name: "Pattern",
    slug: "pattern",
    sortOrder: 7,
    isFilterable: true,
    isVisibleOnProduct: true,
    isRequired: false,
    isMultiSelect: false,
    values: ["Floral", "Geometric", "Medallion", "Tribal", "Minimal"],
  },
  {
    key: "style-feel",
    name: "Style Feel",
    slug: "style-feel",
    sortOrder: 8,
    isFilterable: true,
    isVisibleOnProduct: true,
    isRequired: false,
    isMultiSelect: false,
    values: ["Traditional", "Transitional", "Modern Classic", "Rustic"],
  },
  {
    key: "condition",
    name: "Condition",
    slug: "condition",
    sortOrder: 9,
    isFilterable: true,
    isVisibleOnProduct: true,
    isRequired: false,
    isMultiSelect: false,
    values: ["Excellent", "Very Good", "Good", "Restored"],
  },
  {
    key: "weave-type",
    name: "Weave Type",
    slug: "weave-type",
    sortOrder: 10,
    isFilterable: true,
    isVisibleOnProduct: true,
    isRequired: false,
    isMultiSelect: false,
    values: ["Hand-Knotted", "Handwoven"],
  },
  {
    key: "pile-height",
    name: "Pile Height",
    slug: "pile-height",
    sortOrder: 11,
    isFilterable: true,
    isVisibleOnProduct: true,
    isRequired: false,
    isMultiSelect: false,
    values: ["Low Pile", "Medium Pile", "High Pile"],
  },
  {
    key: "best-for-room",
    name: "Best For Room",
    slug: "best-for-room",
    sortOrder: 12,
    isFilterable: false,
    isVisibleOnProduct: true,
    isRequired: false,
    isMultiSelect: false,
    values: ["Living Room", "Bedroom", "Dining Room", "Entryway"],
  },
  {
    key: "key-feature",
    name: "Key Feature",
    slug: "key-feature",
    sortOrder: 13,
    isFilterable: false,
    isVisibleOnProduct: true,
    isRequired: false,
    isMultiSelect: false,
    values: ["Soft Texture", "Durable", "Easy to Maintain", "One of a Kind"],
  },
] as const

const CANONICAL_ATTRIBUTE_ALIASES: Record<string, string[]> = {
  type: ["type", "types"],
  material: ["material", "materials"],
  size: ["size", "sizes"],
  age: ["age", "ages", "circa", "age-circa"],
  origin: ["origin", "origins"],
  color: ["color", "colors", "colour", "colours"],
  pattern: ["pattern", "patterns"],
  condition: ["condition", "conditions"],
  "weave-type": ["weave-type", "weave type", "weavetype"],
  "pile-height": ["pile-height", "pile height", "pileheight"],
  style: ["style", "styles"],
  "style-feel": ["style-feel", "style feel", "stylefeel"],
  "best-for-room": ["best-for-room", "best for room"],
  "key-feature": ["key-feature", "key feature"],
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

function normalizeAttributeToken(input: string | null | undefined) {
  if (!input) return ""
  return slugify(String(input).replace(/^custom:/i, "").trim())
}

function resolveCanonicalAttributeKey(input: { key?: string | null; slug?: string | null; name?: string | null }) {
  const tokens = [
    normalizeAttributeToken(input.key),
    normalizeAttributeToken(input.slug),
    normalizeAttributeToken(input.name),
  ].filter(Boolean)

  for (const [canonicalKey, aliases] of Object.entries(CANONICAL_ATTRIBUTE_ALIASES)) {
    const aliasSet = new Set(aliases.map((alias) => normalizeAttributeToken(alias)))
    if (tokens.some((token) => aliasSet.has(token))) {
      return canonicalKey
    }
  }

  return null
}

function isMissingDynamicAttributeTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const normalized = message.toLowerCase()
  return (
    normalized.includes("no such table") ||
    normalized.includes("relation") && normalized.includes("attributegroup") ||
    normalized.includes("relation") && normalized.includes("attributevalue") ||
    normalized.includes("relation") && normalized.includes("productattributevalue") ||
    normalized.includes("does not exist")
  )
}

type LegacyCustomGroup = {
  id: string
  name: string
  slug: string
  options: Array<{ id: string; name: string; slug: string }>
}

type LegacyCustomAttribute = {
  name: string
  values: string[]
  visible: boolean
}

async function getLegacyCustomGroups(): Promise<LegacyCustomGroup[]> {
  const row = await prisma.designSettings.findUnique({
    where: { key: CUSTOM_SETTINGS_KEY },
    select: { config: true },
  })

  if (!row?.config) return []
  try {
    const parsed = JSON.parse(row.config) as { groups?: LegacyCustomGroup[] }
    return Array.isArray(parsed.groups) ? parsed.groups : []
  } catch {
    return []
  }
}

function normalizeLegacyCustomAttributes(raw: string | null | undefined): LegacyCustomAttribute[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null
        const name = typeof item.name === "string" ? item.name.trim() : ""
        const values = Array.isArray(item.values)
                    ? item.values.filter((value: unknown): value is string => typeof value === "string").map((value: string) => value.trim()).filter(Boolean)
          : []
        if (!name || values.length === 0) return null
        return {
          name,
          values,
          visible: item.visible !== false,
        } as LegacyCustomAttribute
      })
      .filter((item): item is LegacyCustomAttribute => Boolean(item))
  } catch {
    return []
  }
}

async function upsertGroup(input: {
  key: string
  name: string
  slug: string
  sortOrder: number
  isFilterable: boolean
  isVisibleOnProduct: boolean
  isRequired?: boolean
  isMultiSelect?: boolean
  isActive: boolean
  selectionMode?: "single" | "multiple"
  source?: "dynamic" | "legacy"
}) {
  const resolvedSelectionMode =
    input.isMultiSelect === true
      ? "multiple"
      : input.isMultiSelect === false
        ? "single"
        : (input.selectionMode || "multiple")

  const now = new Date()
  await prisma.$executeRaw`
    INSERT INTO "AttributeGroup"
      ("id","key","name","slug","sortOrder","isFilterable","isVisibleOnProduct","isRequired","isMultiSelect","isActive","selectionMode","source","createdAt","updatedAt")
    VALUES
      (${randomUUID()},${input.key},${input.name},${input.slug},${input.sortOrder},${input.isFilterable},${input.isVisibleOnProduct},${input.isRequired ?? false},${input.isMultiSelect ?? (resolvedSelectionMode === "multiple")},${input.isActive},${resolvedSelectionMode},${input.source || "dynamic"},${now},${now})
    ON CONFLICT ("key") DO UPDATE SET
      "name" = EXCLUDED."name",
      "slug" = EXCLUDED."slug",
      "sortOrder" = EXCLUDED."sortOrder",
      "isFilterable" = EXCLUDED."isFilterable",
      "isVisibleOnProduct" = EXCLUDED."isVisibleOnProduct",
      "isRequired" = EXCLUDED."isRequired",
      "isMultiSelect" = EXCLUDED."isMultiSelect",
      "isActive" = EXCLUDED."isActive",
      "selectionMode" = EXCLUDED."selectionMode",
      "source" = EXCLUDED."source",
      "updatedAt" = EXCLUDED."updatedAt"
  `
}

async function getGroupIdByKey(key: string) {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "AttributeGroup" WHERE "key" = ${key} LIMIT 1
  `
  return rows[0]?.id || null
}

async function upsertValue(input: {
  groupId: string
  slug: string
  value: string
  sortOrder: number
  isActive?: boolean
  hex?: string | null
}) {
  const now = new Date()
  await prisma.$executeRaw`
    INSERT INTO "AttributeValue"
      ("id","groupId","slug","value","sortOrder","isActive","hex","createdAt","updatedAt")
    VALUES
      (${randomUUID()},${input.groupId},${input.slug},${input.value},${input.sortOrder},${input.isActive ?? true},${input.hex ?? null},${now},${now})
    ON CONFLICT ("groupId","slug") DO UPDATE SET
      "value" = EXCLUDED."value",
      "sortOrder" = EXCLUDED."sortOrder",
      "isActive" = EXCLUDED."isActive",
      "hex" = EXCLUDED."hex",
      "updatedAt" = EXCLUDED."updatedAt"
  `
}

async function migrateLegacySources() {
  const legacyGroups = [
    {
      key: "type",
      name: "Type",
      slug: "type",
      sortOrder: 10,
      isFilterable: true,
      isVisibleOnProduct: true,
      selectionMode: "multiple" as const,
      rows: await prisma.type.findMany({ orderBy: { name: "asc" } }),
    },
    {
      key: "style",
      name: "Style",
      slug: "style",
      sortOrder: 20,
      isFilterable: true,
      isVisibleOnProduct: true,
      selectionMode: "multiple" as const,
      rows: await prisma.style.findMany({ orderBy: { name: "asc" } }),
    },
    {
      key: "color",
      name: "Color",
      slug: "color",
      sortOrder: 30,
      isFilterable: true,
      isVisibleOnProduct: true,
      selectionMode: "multiple" as const,
      rows: await prisma.color.findMany({ orderBy: { name: "asc" } }),
    },
    {
      key: "size",
      name: "Size",
      slug: "size",
      sortOrder: 40,
      isFilterable: true,
      isVisibleOnProduct: true,
      selectionMode: "multiple" as const,
      rows: await prisma.size.findMany({ orderBy: { name: "asc" } }),
    },
    {
      key: "age",
      name: "Age",
      slug: "age",
      sortOrder: 50,
      isFilterable: true,
      isVisibleOnProduct: true,
      selectionMode: "multiple" as const,
      rows: await prisma.age.findMany({ orderBy: { name: "asc" } }),
    },
    {
      key: "material",
      name: "Material",
      slug: "material",
      sortOrder: 60,
      isFilterable: true,
      isVisibleOnProduct: true,
      selectionMode: "multiple" as const,
      rows: await (prisma as unknown as {
        material?: { findMany: (...args: any[]) => Promise<Array<{ id: string; name: string; slug: string }>> }
      }).material?.findMany?.({ orderBy: { name: "asc" } }) || [],
    },
  ]

  for (const group of legacyGroups) {
    await upsertGroup({
      key: group.key,
      name: group.name,
      slug: group.slug,
      sortOrder: group.sortOrder,
      isFilterable: group.isFilterable,
      isVisibleOnProduct: group.isVisibleOnProduct,
      isRequired: false,
      isMultiSelect: group.selectionMode === "multiple",
      isActive: true,
      selectionMode: group.selectionMode,
      source: "legacy",
    })
    const groupId = await getGroupIdByKey(group.key)
    if (!groupId) continue
    for (const [index, row] of group.rows.entries()) {
      await upsertValue({
        groupId,
        slug: row.slug,
        value: row.name,
        sortOrder: index,
        hex: "hex" in row ? (row as { hex?: string | null }).hex ?? null : null,
      })
    }
  }

  const customGroups = await getLegacyCustomGroups()
  for (const [groupIndex, group] of customGroups.entries()) {
    await upsertGroup({
      key: `custom:${group.slug || group.id}`,
      name: group.name,
      slug: group.slug || slugify(group.name),
      sortOrder: 100 + groupIndex,
      isFilterable: true,
      isVisibleOnProduct: true,
      isRequired: false,
      isMultiSelect: true,
      isActive: true,
      selectionMode: "multiple",
      source: "dynamic",
    })
    const groupId = await getGroupIdByKey(`custom:${group.slug || group.id}`)
    if (!groupId) continue
    for (const [valueIndex, option] of group.options.entries()) {
      await upsertValue({
        groupId,
        slug: option.slug || slugify(option.name),
        value: option.name,
        sortOrder: valueIndex,
      })
    }
  }

  const legacyProducts = await prisma.$queryRaw<Array<{
    id: string
    customAttributes: string | null
  }>>`SELECT "id", "customAttributes" FROM "Product" WHERE "customAttributes" IS NOT NULL`

  for (const product of legacyProducts) {
    const customAttributes = normalizeLegacyCustomAttributes(product.customAttributes)
    for (const attribute of customAttributes) {
      const key = `custom:${slugify(attribute.name)}`
      await upsertGroup({
        key,
        name: attribute.name,
        slug: slugify(attribute.name),
        sortOrder: 500,
        isFilterable: false,
        isVisibleOnProduct: attribute.visible !== false,
        isRequired: false,
        isMultiSelect: true,
        isActive: true,
        selectionMode: "multiple",
        source: "dynamic",
      })
      const groupId = await getGroupIdByKey(key)
      if (!groupId) continue
      for (const [valueIndex, value] of attribute.values.entries()) {
        await upsertValue({
          groupId,
          slug: slugify(value),
          value,
          sortOrder: valueIndex,
        })
      }
    }
  }
}

async function ensureStandardAttributeSeeds() {
  for (const group of STANDARD_ATTRIBUTE_GROUPS) {
    await upsertGroup({
      key: group.key,
      name: group.name,
      slug: group.slug,
      sortOrder: group.sortOrder,
      isFilterable: group.isFilterable,
      isVisibleOnProduct: group.isVisibleOnProduct,
      isRequired: group.isRequired,
      isMultiSelect: group.isMultiSelect,
      isActive: true,
      selectionMode: group.isMultiSelect ? "multiple" : "single",
      source: "dynamic",
    })

    const groupId = await getGroupIdByKey(group.key)
    if (!groupId) continue

    for (const [index, value] of group.values.entries()) {
      await upsertValue({
        groupId,
        slug: slugify(value),
        value,
        sortOrder: index,
        isActive: true,
      })
    }
  }
}

type DuplicateGroupRow = {
  id: string
  key: string
  name: string
  slug: string
  source: "dynamic" | "legacy"
  isActive: boolean
  sortOrder: number
  createdAt: string | number | Date
  productLinks: bigint | number
}

type NormalizedDuplicateGroupRow = Omit<DuplicateGroupRow, "productLinks"> & {
  productLinks: number
}

async function mergeDuplicateAttributeGroups() {
  const rawGroups = await prisma.$queryRaw<DuplicateGroupRow[]>(Prisma.sql`
    SELECT
      g."id" AS "id",
      g."key" AS "key",
      g."name" AS "name",
      g."slug" AS "slug",
      g."source" AS "source",
      g."isActive" AS "isActive",
      g."sortOrder" AS "sortOrder",
      g."createdAt" AS "createdAt",
      COUNT(DISTINCT pav."id") AS "productLinks"
    FROM "AttributeGroup" g
    LEFT JOIN "ProductAttributeValue" pav ON pav."groupId" = g."id"
    GROUP BY g."id", g."key", g."name", g."slug", g."source", g."isActive", g."sortOrder", g."createdAt"
  `)
  const groups: NormalizedDuplicateGroupRow[] = rawGroups.map((group) => ({
    ...group,
    productLinks: Number(group.productLinks || 0),
  }))

  const groupsByCanonical = new Map<string, NormalizedDuplicateGroupRow[]>()
  for (const group of groups) {
    const canonicalKey = resolveCanonicalAttributeKey(group)
    if (!canonicalKey) continue
    const current = groupsByCanonical.get(canonicalKey) || []
    current.push(group)
    groupsByCanonical.set(canonicalKey, current)
  }

  for (const [canonicalKey, candidates] of groupsByCanonical.entries()) {
    if (candidates.length <= 1) continue

    const sortedCandidates = [...candidates].sort((a, b) => {
      const score = (row: NormalizedDuplicateGroupRow) => {
        let value = 0
        if (normalizeAttributeToken(row.key) === canonicalKey) value += 100
        if (normalizeAttributeToken(row.slug) === canonicalKey) value += 50
        if (row.source === "dynamic") value += 20
        if (row.isActive) value += 10
        value += Math.min(row.productLinks, 1000)
        return value
      }

      const scoreDelta = score(b) - score(a)
      if (scoreDelta !== 0) return scoreDelta
      return String(a.createdAt).localeCompare(String(b.createdAt))
    })

    const canonicalGroup = sortedCandidates[0]
    const duplicateGroups = sortedCandidates.slice(1)
    if (duplicateGroups.length === 0) continue

    const involvedGroupIds = [canonicalGroup.id, ...duplicateGroups.map((group) => group.id)]
    const allValues = await prisma.$queryRaw<Array<{
      id: string
      groupId: string
      value: string
      slug: string
      sortOrder: number
      isActive: boolean
      hex: string | null
    }>>(Prisma.sql`
      SELECT "id","groupId","value","slug","sortOrder","isActive","hex"
      FROM "AttributeValue"
      WHERE "groupId" IN (${Prisma.join(involvedGroupIds)})
      ORDER BY "sortOrder" ASC, "value" ASC
    `)

    for (const value of allValues.filter((row) => row.groupId !== canonicalGroup.id)) {
      const alreadyExists = allValues.some((candidate) =>
        candidate.groupId === canonicalGroup.id &&
        (
          normalizeAttributeToken(candidate.slug) === normalizeAttributeToken(value.slug) ||
          normalizeAttributeToken(candidate.value) === normalizeAttributeToken(value.value)
        ),
      )

      if (!alreadyExists) {
        await upsertValue({
          groupId: canonicalGroup.id,
          slug: value.slug || slugify(value.value),
          value: value.value,
          sortOrder: value.sortOrder,
          isActive: value.isActive,
          hex: value.hex,
        })
      }
    }

    const canonicalValues = await prisma.$queryRaw<Array<{
      id: string
      value: string
      slug: string
    }>>(Prisma.sql`
      SELECT "id","value","slug"
      FROM "AttributeValue"
      WHERE "groupId" = ${canonicalGroup.id}
    `)

    const canonicalValueByToken = new Map<string, { id: string; value: string; slug: string }>()
    canonicalValues.forEach((value) => {
      canonicalValueByToken.set(normalizeAttributeToken(value.slug), value)
      canonicalValueByToken.set(normalizeAttributeToken(value.value), value)
    })

    const duplicateLinks = await prisma.$queryRaw<Array<{
      productId: string
      valueSlug: string
      valueText: string
    }>>(Prisma.sql`
      SELECT
        pav."productId" AS "productId",
        v."slug" AS "valueSlug",
        v."value" AS "valueText"
      FROM "ProductAttributeValue" pav
      JOIN "AttributeValue" v ON v."id" = pav."valueId"
      WHERE pav."groupId" IN (${Prisma.join(duplicateGroups.map((group) => group.id))})
    `)

    for (const link of duplicateLinks) {
      const canonicalValue =
        canonicalValueByToken.get(normalizeAttributeToken(link.valueSlug)) ||
        canonicalValueByToken.get(normalizeAttributeToken(link.valueText))
      if (!canonicalValue) continue

      await prisma.$executeRaw`
        INSERT INTO "ProductAttributeValue" ("id","productId","groupId","valueId","createdAt")
        VALUES (${randomUUID()},${link.productId},${canonicalGroup.id},${canonicalValue.id},${new Date()})
        ON CONFLICT ("productId","groupId","valueId") DO NOTHING
      `
    }

    await prisma.$executeRaw`
      DELETE FROM "ProductAttributeValue"
      WHERE "groupId" IN (${Prisma.join(duplicateGroups.map((group) => group.id))})
    `

    await prisma.$executeRaw`
      UPDATE "AttributeGroup"
      SET "isActive" = FALSE, "updatedAt" = ${new Date()}
      WHERE "id" IN (${Prisma.join(duplicateGroups.map((group) => group.id))})
    `
  }
}

export async function ensureDynamicAttributeTables() {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "AttributeGroup" (
          "id" TEXT PRIMARY KEY,
          "key" TEXT NOT NULL UNIQUE,
          "name" TEXT NOT NULL,
          "slug" TEXT NOT NULL,
          "sortOrder" INTEGER NOT NULL DEFAULT 0,
          "isFilterable" BOOLEAN NOT NULL DEFAULT false,
          "isVisibleOnProduct" BOOLEAN NOT NULL DEFAULT true,
          "isRequired" BOOLEAN NOT NULL DEFAULT false,
          "isMultiSelect" BOOLEAN NOT NULL DEFAULT false,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "selectionMode" TEXT NOT NULL DEFAULT 'multiple',
          "source" TEXT NOT NULL DEFAULT 'dynamic',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "AttributeValue" (
          "id" TEXT PRIMARY KEY,
          "groupId" TEXT NOT NULL REFERENCES "AttributeGroup"("id") ON DELETE CASCADE,
          "value" TEXT NOT NULL,
          "slug" TEXT NOT NULL,
          "sortOrder" INTEGER NOT NULL DEFAULT 0,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "hex" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE("groupId","slug")
        )
      `
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "ProductAttributeValue" (
          "id" TEXT PRIMARY KEY,
          "productId" TEXT NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE,
          "groupId" TEXT NOT NULL REFERENCES "AttributeGroup"("id") ON DELETE CASCADE,
          "valueId" TEXT NOT NULL REFERENCES "AttributeValue"("id") ON DELETE CASCADE,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE("productId","groupId","valueId")
        )
      `
      await addColumnIfMissing(prisma, "AttributeGroup", "isRequired", `BOOLEAN NOT NULL DEFAULT false`)
      await addColumnIfMissing(prisma, "AttributeGroup", "isMultiSelect", `BOOLEAN NOT NULL DEFAULT false`)
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "ProductAttributeValue_productId_valueId_idx" ON "ProductAttributeValue" ("productId","valueId")`
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "ProductAttributeValue_valueId_idx" ON "ProductAttributeValue" ("valueId")`
      await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "ProductAttributeValue_productId_valueId_key" ON "ProductAttributeValue" ("productId","valueId")`
      await migrateLegacySources()
      await ensureStandardAttributeSeeds()
      await mergeDuplicateAttributeGroups()
    })().catch((error) => {
      ensurePromise = null
      throw error
    })
  }
  await ensurePromise
}

export async function getAttributeGroups(input?: { activeOnly?: boolean; filterableOnly?: boolean; visibleOnly?: boolean }) {
  try {
    const activeClause = input?.activeOnly === false ? "" : `AND g."isActive" = TRUE`
    const filterableClause = input?.filterableOnly ? `AND g."isFilterable" = TRUE` : ""
    const visibleClause = input?.visibleOnly ? `AND g."isVisibleOnProduct" = TRUE` : ""
    const groups = await prisma.$queryRaw<Array<{
      id: string
      key: string
      name: string
      slug: string
      sortOrder: number
      isFilterable: boolean
      isVisibleOnProduct: boolean
      isRequired: boolean
      isMultiSelect: boolean
      isActive: boolean
      selectionMode: "single" | "multiple"
      source: "dynamic" | "legacy"
    }>>(Prisma.sql`
      SELECT
        g."id", g."key", g."name", g."slug", g."sortOrder",
        g."isFilterable", g."isVisibleOnProduct", g."isRequired", g."isMultiSelect", g."isActive", g."selectionMode", g."source"
      FROM "AttributeGroup" g
      WHERE 1=1 ${Prisma.raw(activeClause)} ${Prisma.raw(filterableClause)} ${Prisma.raw(visibleClause)}
      ORDER BY g."sortOrder" ASC, g."name" ASC
    `)

    const values = await prisma.$queryRaw<Array<{
      id: string
      groupId: string
      value: string
      slug: string
      sortOrder: number
      isActive: boolean
      hex: string | null
    }>>(Prisma.sql`
      SELECT
        v."id", v."groupId", v."value", v."slug", v."sortOrder", v."isActive", v."hex"
      FROM "AttributeValue" v
      ORDER BY v."sortOrder" ASC, v."value" ASC
    `)

    return groups.map((group) => ({
      ...group,
      options: values
        .filter((value) => value.groupId === group.id && value.isActive)
        .map((value) => ({
          id: value.id,
          groupId: value.groupId,
          value: value.value,
          slug: value.slug,
          sortOrder: value.sortOrder,
          isActive: value.isActive,
          hex: value.hex,
        })),
    })) as AttributeGroupRecord[]
  } catch (error) {
    if (isMissingDynamicAttributeTableError(error)) return []
    throw error
  }
}

export async function getProductAttributeSelections(productId: string) {
  try {
    const rows = await prisma.$queryRaw<Array<{
      groupId: string
      valueId: string
    }>>`SELECT "groupId", "valueId" FROM "ProductAttributeValue" WHERE "productId" = ${productId}`

    return rows.reduce<Record<string, string[]>>((acc, row) => {
      if (!acc[row.groupId]) acc[row.groupId] = []
      acc[row.groupId].push(row.valueId)
      return acc
    }, {})
  } catch (error) {
    if (isMissingDynamicAttributeTableError(error)) return {}
    throw error
  }
}

export async function saveProductAttributeSelections(productId: string, selections: ProductAttributeSelectionInput) {
  await ensureDynamicAttributeTables()
  const sanitizedSelections = Object.entries(selections || {}).reduce<Record<string, string[]>>((acc, [groupId, valueIds]) => {
    const normalizedIds = Array.from(new Set((valueIds || []).filter(Boolean)))
    if (normalizedIds.length > 0) {
      acc[groupId] = normalizedIds
    }
    return acc
  }, {})

  const allValueIds = Array.from(new Set(Object.values(sanitizedSelections).flat()))
  const validRows = allValueIds.length > 0
    ? await prisma.$queryRaw<Array<{ groupId: string; valueId: string; isActive: boolean; selectionMode: "single" | "multiple"; isRequired: boolean }>>(Prisma.sql`
        SELECT
          g."id" AS "groupId",
          v."id" AS "valueId",
          v."isActive" AS "isActive",
          g."selectionMode" AS "selectionMode",
          g."isRequired" AS "isRequired"
        FROM "AttributeGroup" g
        JOIN "AttributeValue" v ON v."groupId" = g."id"
        WHERE g."id" IN (${Prisma.join(Object.keys(sanitizedSelections))})
          AND v."id" IN (${Prisma.join(allValueIds)})
          AND g."isActive" = TRUE
      `)
    : []

  const validPairSet = new Set(validRows.filter((row) => row.isActive).map((row) => `${row.groupId}:${row.valueId}`))
  const groupConfig = new Map<string, { selectionMode: "single" | "multiple"; isRequired: boolean }>()
  validRows.forEach((row) => {
    groupConfig.set(row.groupId, {
      selectionMode: row.selectionMode,
      isRequired: row.isRequired,
    })
  })

  const normalizedSelections = Object.entries(sanitizedSelections).reduce<Record<string, string[]>>((acc, [groupId, valueIds]) => {
    const validIds = valueIds.filter((valueId) => validPairSet.has(`${groupId}:${valueId}`))
    const config = groupConfig.get(groupId)
    if (!config || validIds.length === 0) return acc
    acc[groupId] = config.selectionMode === "single" ? validIds.slice(0, 1) : validIds
    return acc
  }, {})

  const requiredGroups = await prisma.$queryRaw<Array<{ groupId: string }>>(Prisma.sql`
    SELECT "id" AS "groupId"
    FROM "AttributeGroup"
    WHERE "isActive" = TRUE
      AND "isRequired" = TRUE
  `)

  const missingRequired = requiredGroups
    .map((row) => row.groupId)
    .filter((groupId) => !normalizedSelections[groupId] || normalizedSelections[groupId].length === 0)

  if (missingRequired.length > 0) {
    throw new Error("Required attribute selections are missing")
  }

  await prisma.$executeRaw`DELETE FROM "ProductAttributeValue" WHERE "productId" = ${productId}`

  const insertRows = Object.entries(normalizedSelections).flatMap(([groupId, valueIds]) =>
    valueIds.map((valueId) => ({ groupId, valueId })),
  )

  for (const row of insertRows) {
    await prisma.$executeRaw`
      INSERT INTO "ProductAttributeValue" ("id","productId","groupId","valueId","createdAt")
      VALUES (${randomUUID()},${productId},${row.groupId},${row.valueId},${new Date()})
      ON CONFLICT ("productId","groupId","valueId") DO NOTHING
    `
  }
}

export async function getProductVisibleAttributes(productId: string) {
  try {
    const rows = await prisma.$queryRaw<Array<{
      groupName: string
      groupSort: number
      value: string
      groupVisible: boolean
      valueSort: number
    }>>(Prisma.sql`
      SELECT
        g."name" AS "groupName",
        g."sortOrder" AS "groupSort",
        g."isVisibleOnProduct" AS "groupVisible",
        v."value" AS "value",
        v."sortOrder" AS "valueSort"
      FROM "ProductAttributeValue" pav
      JOIN "AttributeGroup" g ON g."id" = pav."groupId"
      JOIN "AttributeValue" v ON v."id" = pav."valueId"
      WHERE pav."productId" = ${productId}
        AND g."isActive" = TRUE
        AND g."isVisibleOnProduct" = TRUE
        AND v."isActive" = TRUE
      ORDER BY g."sortOrder" ASC, v."sortOrder" ASC, v."value" ASC
    `)

    const grouped = new Map<string, { name: string; values: string[]; visible: boolean; sortOrder: number }>()
    for (const row of rows) {
      const current = grouped.get(row.groupName)
      if (current) {
        current.values.push(row.value)
      } else {
        grouped.set(row.groupName, {
          name: row.groupName,
          values: [row.value],
          visible: row.groupVisible,
          sortOrder: row.groupSort,
        })
      }
    }

    return Array.from(grouped.values())
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map((item) => ({ name: item.name, values: item.values, visible: item.visible }))
  } catch (error) {
    if (isMissingDynamicAttributeTableError(error)) return []
    throw error
  }
}

export function buildVisibleAttributesFromSelections(
  groups: AttributeGroupRecord[],
  selections: ProductAttributeSelectionInput,
) {
  return groups
    .filter((group) => group.isVisibleOnProduct)
    .map((group) => {
      const selectedIds = new Set((selections[group.id] || []).filter(Boolean))
      const values = group.options
        .filter((option) => selectedIds.has(option.id))
        .map((option) => option.value)
      if (values.length === 0) return null
      return {
        name: group.name,
        values,
        visible: true,
      }
    })
    .filter((item): item is { name: string; values: string[]; visible: boolean } => Boolean(item))
}

export async function getProductIdsMatchingAttributeFilters(filters: Record<string, string[]>) {
  const entries = Object.entries(filters || {}).filter(([, values]) => Array.isArray(values) && values.length > 0)
  if (entries.length === 0) return null
  const normalizedEntries = entries
    .map(([groupSlug, values]) => [groupSlug.trim(), Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))) ] as const)
    .filter(([, values]) => values.length > 0)

  if (normalizedEntries.length === 0) return null

  const slugPairs = normalizedEntries.flatMap(([groupSlug, values]) => values.map((valueSlug) => ({ groupSlug, valueSlug })))
  const pairSql = Prisma.join(
    slugPairs.map((pair) => Prisma.sql`(${pair.groupSlug}, ${pair.valueSlug})`),
  )
  const requiredGroupCount = normalizedEntries.length

  try {
    const rows = await prisma.$queryRaw<Array<{ productId: string }>>(Prisma.sql`
      SELECT matches."productId" AS "productId"
      FROM (
        SELECT
          pav."productId",
          COUNT(DISTINCT g."slug") AS "matchedGroups"
        FROM "ProductAttributeValue" pav
        JOIN "AttributeGroup" g ON g."id" = pav."groupId"
        JOIN "AttributeValue" v ON v."id" = pav."valueId"
        JOIN (VALUES ${pairSql}) AS selected("groupSlug","valueSlug")
          ON selected."groupSlug" = g."slug"
         AND selected."valueSlug" = v."slug"
        WHERE g."isActive" = TRUE
          AND g."isFilterable" = TRUE
          AND v."isActive" = TRUE
        GROUP BY pav."productId"
      ) AS matches
      WHERE matches."matchedGroups" = ${requiredGroupCount}
    `)

    return rows.map((row) => row.productId)
  } catch (error) {
    if (isMissingDynamicAttributeTableError(error)) return null
    throw error
  }
}

export async function getAttributeFacetGroupsForProductIds(productIds: string[]) {
  if (productIds.length === 0) return [] as AttributeFacetGroup[]
  try {
    const rows = await prisma.$queryRaw<Array<{
      groupId: string
      groupKey: string
      groupName: string
      groupSlug: string
      groupSort: number
      selectionMode: "single" | "multiple"
      valueId: string
      valueSlug: string
      valueText: string
      valueHex: string | null
      valueSort: number
      productCount: bigint | number
    }>>(Prisma.sql`
      SELECT
        g."id" AS "groupId",
        g."key" AS "groupKey",
        g."name" AS "groupName",
        g."slug" AS "groupSlug",
        g."sortOrder" AS "groupSort",
        g."selectionMode" AS "selectionMode",
        v."id" AS "valueId",
        v."slug" AS "valueSlug",
        v."value" AS "valueText",
        v."hex" AS "valueHex",
        v."sortOrder" AS "valueSort",
        COUNT(DISTINCT pav."productId") AS "productCount"
      FROM "ProductAttributeValue" pav
      JOIN "AttributeGroup" g ON g."id" = pav."groupId"
      JOIN "AttributeValue" v ON v."id" = pav."valueId"
      WHERE pav."productId" IN (${Prisma.join(productIds)})
        AND g."isActive" = TRUE
        AND g."isFilterable" = TRUE
        AND v."isActive" = TRUE
      GROUP BY
        g."id", g."key", g."name", g."slug", g."sortOrder", g."selectionMode",
        v."id", v."slug", v."value", v."hex", v."sortOrder"
      ORDER BY g."sortOrder" ASC, g."name" ASC, v."sortOrder" ASC, v."value" ASC
    `)

    const grouped = new Map<string, AttributeFacetGroup>()

    rows.forEach((row) => {
      const current = grouped.get(row.groupId)
      const count = Number(row.productCount || 0)
      if (!current) {
        grouped.set(row.groupId, {
          id: row.groupId,
          key: row.groupKey,
          name: row.groupName,
          slug: row.groupSlug,
          selectionMode: row.selectionMode,
          isPrimarySeoFacet: row.groupSlug === "type" || row.groupSlug === "color",
          options: count > 0
            ? [{
                id: row.valueId,
                slug: row.valueSlug,
                value: row.valueText,
                hex: row.valueHex,
                count,
              }]
            : [],
        })
        return
      }

      if (count > 0) {
        current.options.push({
          id: row.valueId,
          slug: row.valueSlug,
          value: row.valueText,
          hex: row.valueHex,
          count,
        })
      }
    })

    return Array.from(grouped.values()).filter((group) => group.options.length > 0)
  } catch (error) {
    if (isMissingDynamicAttributeTableError(error)) return []
    throw error
  }
}
