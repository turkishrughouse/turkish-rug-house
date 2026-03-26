import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { ensureDynamicAttributeTables, getAttributeGroups } from "@/lib/product-attributes"

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

export async function GET() {
  try {
    await ensureDynamicAttributeTables()
    const groups = await getAttributeGroups()
    return NextResponse.json({
      groups: groups.map((group) => ({
        ...group,
        kind: group.source === "legacy" ? "fixed" : "custom",
        isMultiSelect: group.isMultiSelect,
        options: group.options.map((option) => ({
          id: option.id,
          name: option.value,
          slug: option.slug,
          hex: option.hex ?? null,
          sortOrder: option.sortOrder,
          isActive: option.isActive,
        })),
      })),
    })
  } catch (error) {
    console.error("Failed to fetch attributes:", error)
    return NextResponse.json({ error: "Failed to fetch attributes" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDynamicAttributeTables()
    const body = await req.json()
    const action = String(body?.action || "")

    if (action === "create_group" || action === "create_custom_group") {
      const name = String(body?.name || "").trim()
      const rawSlug = String(body?.slug || "").trim()
      if (!name) return NextResponse.json({ error: "Group name is required" }, { status: 400 })

      const slug = rawSlug || slugify(name)
      const key = String(body?.key || `dynamic:${slug}`).trim()
      const now = new Date()
      await prisma.$executeRaw`
        INSERT INTO "AttributeGroup"
          ("id","key","name","slug","sortOrder","isFilterable","isVisibleOnProduct","isRequired","isMultiSelect","isActive","selectionMode","source","createdAt","updatedAt")
        VALUES
          (${randomUUID()},${key},${name},${slug},${Number(body?.sortOrder || 0)},${body?.isFilterable === true},${body?.isVisibleOnProduct !== false},${body?.isRequired === true},${body?.isMultiSelect === true},${body?.isActive !== false},${body?.isMultiSelect === true || body?.selectionMode === "multiple" ? "multiple" : "single"},${"dynamic"},${now},${now})
      `
      return NextResponse.json({ success: true })
    }

    if (action === "update_group") {
      const groupId = String(body?.groupId || "")
      if (!groupId) return NextResponse.json({ error: "Group ID is required" }, { status: 400 })
      await prisma.$executeRaw`
        UPDATE "AttributeGroup"
        SET
          "name" = ${String(body?.name || "").trim()},
          "slug" = ${String(body?.slug || slugify(String(body?.name || ""))).trim()},
          "sortOrder" = ${Number(body?.sortOrder || 0)},
          "isFilterable" = ${body?.isFilterable === true},
          "isVisibleOnProduct" = ${body?.isVisibleOnProduct !== false},
          "isRequired" = ${body?.isRequired === true},
          "isMultiSelect" = ${body?.isMultiSelect === true},
          "isActive" = ${body?.isActive !== false},
          "selectionMode" = ${body?.isMultiSelect === true || body?.selectionMode === "multiple" ? "multiple" : "single"},
          "updatedAt" = ${new Date()}
        WHERE "id" = ${groupId}
      `
      return NextResponse.json({ success: true })
    }

    if (action === "delete_group" || action === "delete_custom_group") {
      const groupId = String(body?.groupId || "")
      if (!groupId) return NextResponse.json({ error: "Group ID is required" }, { status: 400 })
      await prisma.$executeRaw`DELETE FROM "AttributeGroup" WHERE "id" = ${groupId}`
      return NextResponse.json({ success: true })
    }

    if (action === "create_value" || action === "create_custom_option" || action === "create_fixed_option") {
      const legacyGroupKey = String(body?.group || "")
      const groupId = String(body?.groupId || "") || (
        legacyGroupKey
          ? (await prisma.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "AttributeGroup" WHERE "key" = ${legacyGroupKey.replace(/s$/, "")} LIMIT 1`)[0]?.id || ""
          : ""
      )
      const value = String(body?.value || body?.name || "").trim()
      const rawSlug = String(body?.slug || "").trim()
      if (!groupId || !value) return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
      const now = new Date()
      await prisma.$executeRaw`
        INSERT INTO "AttributeValue"
          ("id","groupId","value","slug","sortOrder","isActive","hex","createdAt","updatedAt")
        VALUES
          (${randomUUID()},${groupId},${value},${rawSlug || slugify(value)},${Number(body?.sortOrder || 0)},${body?.isActive !== false},${body?.hex ? String(body.hex).trim() : null},${now},${now})
      `
      return NextResponse.json({ success: true })
    }

    if (action === "update_value") {
      const valueId = String(body?.valueId || "")
      if (!valueId) return NextResponse.json({ error: "Value ID is required" }, { status: 400 })
      const value = String(body?.value || "").trim()
      await prisma.$executeRaw`
        UPDATE "AttributeValue"
        SET
          "value" = ${value},
          "slug" = ${String(body?.slug || slugify(value)).trim()},
          "sortOrder" = ${Number(body?.sortOrder || 0)},
          "isActive" = ${body?.isActive !== false},
          "hex" = ${body?.hex ? String(body.hex).trim() : null},
          "updatedAt" = ${new Date()}
        WHERE "id" = ${valueId}
      `
      return NextResponse.json({ success: true })
    }

    if (action === "delete_value" || action === "delete_custom_option" || action === "delete_fixed_option") {
      const valueId = String(body?.valueId || body?.optionId || "")
      if (!valueId) return NextResponse.json({ error: "Value ID is required" }, { status: 400 })
      await prisma.$executeRaw`DELETE FROM "AttributeValue" WHERE "id" = ${valueId}`
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Attributes operation failed:", error)
    return NextResponse.json({ error: "Attributes operation failed" }, { status: 500 })
  }
}
