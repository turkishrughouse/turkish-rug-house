import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

type FixedGroupKey = "types" | "styles" | "colors" | "sizes" | "ages" | "materials"

type CustomOption = {
  id: string
  name: string
  slug: string
}

type CustomGroup = {
  id: string
  name: string
  slug: string
  options: CustomOption[]
}

const CUSTOM_SETTINGS_KEY = "product_custom_attributes"

function getMaterialDelegate() {
  return (prisma as unknown as {
    material?: {
      findMany: (...args: any[]) => Promise<Array<{ id: string; name: string; slug: string }>>
      create: (args: any) => Promise<unknown>
      delete: (args: any) => Promise<unknown>
    }
  }).material
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

function isFixedGroupKey(value: string): value is FixedGroupKey {
  return ["types", "styles", "colors", "sizes", "ages", "materials"].includes(value)
}

async function getCustomGroups(): Promise<CustomGroup[]> {
  const row = await prisma.designSettings.findUnique({
    where: { key: CUSTOM_SETTINGS_KEY },
    select: { config: true },
  })

  if (!row?.config) return []
  try {
    const parsed = JSON.parse(row.config) as { groups?: CustomGroup[] }
    return Array.isArray(parsed.groups) ? parsed.groups : []
  } catch {
    return []
  }
}

async function saveCustomGroups(groups: CustomGroup[]) {
  await prisma.designSettings.upsert({
    where: { key: CUSTOM_SETTINGS_KEY },
    update: { config: JSON.stringify({ groups }) },
    create: { key: CUSTOM_SETTINGS_KEY, config: JSON.stringify({ groups }) },
  })
}

async function getFixedGroups() {
  const materialDelegate = getMaterialDelegate()
  const [types, styles, colors, sizes, ages, materials] = await Promise.all([
    prisma.type.findMany({ orderBy: { name: "asc" } }),
    prisma.style.findMany({ orderBy: { name: "asc" } }),
    prisma.color.findMany({ orderBy: { name: "asc" } }),
    prisma.size.findMany({ orderBy: { name: "asc" } }),
    prisma.age.findMany({ orderBy: { name: "asc" } }),
    materialDelegate?.findMany ? materialDelegate.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
  ])

  return [
    { id: "types", key: "types", name: "Types", kind: "fixed", options: types.map((x) => ({ id: x.id, name: x.name, slug: x.slug })) },
    { id: "styles", key: "styles", name: "Styles", kind: "fixed", options: styles.map((x) => ({ id: x.id, name: x.name, slug: x.slug })) },
    { id: "colors", key: "colors", name: "Colors", kind: "fixed", options: colors.map((x) => ({ id: x.id, name: x.name, slug: x.slug, hex: x.hex })) },
    { id: "sizes", key: "sizes", name: "Sizes", kind: "fixed", options: sizes.map((x) => ({ id: x.id, name: x.name, slug: x.slug })) },
    { id: "ages", key: "ages", name: "Ages", kind: "fixed", options: ages.map((x) => ({ id: x.id, name: x.name, slug: x.slug })) },
    { id: "materials", key: "materials", name: "Materials", kind: "fixed", options: materials.map((x) => ({ id: x.id, name: x.name, slug: x.slug })) },
  ]
}

export async function GET() {
  try {
    const [fixed, custom] = await Promise.all([getFixedGroups(), getCustomGroups()])
    const customGroups = custom.map((group) => ({
      id: group.id,
      key: `custom:${group.id}`,
      name: group.name,
      slug: group.slug,
      kind: "custom" as const,
      options: group.options || [],
    }))
    return NextResponse.json({ groups: [...fixed, ...customGroups] })
  } catch (error) {
    console.error("Failed to fetch attributes:", error)
    return NextResponse.json({ error: "Failed to fetch attributes" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const materialDelegate = getMaterialDelegate()
    const body = await req.json()
    const action = String(body?.action || "")

    if (action === "create_fixed_option") {
      const group = String(body?.group || "")
      const name = String(body?.name || "").trim()
      const rawSlug = String(body?.slug || "").trim()
      const hex = body?.hex ? String(body.hex).trim() : null

      if (!isFixedGroupKey(group)) return NextResponse.json({ error: "Invalid group" }, { status: 400 })
      if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })

      const slug = rawSlug || slugify(name)
      if (!slug) return NextResponse.json({ error: "Invalid slug" }, { status: 400 })

      if (group === "types") await prisma.type.create({ data: { name, slug } })
      if (group === "styles") await prisma.style.create({ data: { name, slug } })
      if (group === "sizes") await prisma.size.create({ data: { name, slug } })
      if (group === "ages") await prisma.age.create({ data: { name, slug } })
      if (group === "materials") {
        if (!materialDelegate?.create) return NextResponse.json({ error: "Materials are not available yet" }, { status: 503 })
        await materialDelegate.create({ data: { name, slug } })
      }
      if (group === "colors") await prisma.color.create({ data: { name, slug, hex } })

      return NextResponse.json({ success: true })
    }

    if (action === "delete_fixed_option") {
      const group = String(body?.group || "")
      const optionId = String(body?.optionId || "")
      if (!isFixedGroupKey(group) || !optionId) return NextResponse.json({ error: "Invalid payload" }, { status: 400 })

      if (group === "types") await prisma.type.delete({ where: { id: optionId } })
      if (group === "styles") await prisma.style.delete({ where: { id: optionId } })
      if (group === "sizes") await prisma.size.delete({ where: { id: optionId } })
      if (group === "ages") await prisma.age.delete({ where: { id: optionId } })
      if (group === "materials") {
        if (!materialDelegate?.delete) return NextResponse.json({ error: "Materials are not available yet" }, { status: 503 })
        await materialDelegate.delete({ where: { id: optionId } })
      }
      if (group === "colors") await prisma.color.delete({ where: { id: optionId } })

      return NextResponse.json({ success: true })
    }

    if (action === "create_custom_group") {
      const name = String(body?.name || "").trim()
      const rawSlug = String(body?.slug || "").trim()
      if (!name) return NextResponse.json({ error: "Group name is required" }, { status: 400 })

      const groups = await getCustomGroups()
      const slug = rawSlug || slugify(name)
      if (!slug) return NextResponse.json({ error: "Invalid slug" }, { status: 400 })
      if (groups.some((g) => g.slug === slug)) return NextResponse.json({ error: "Group slug already exists" }, { status: 409 })

      groups.push({
        id: crypto.randomUUID(),
        name,
        slug,
        options: [],
      })

      await saveCustomGroups(groups)
      return NextResponse.json({ success: true })
    }

    if (action === "delete_custom_group") {
      const groupId = String(body?.groupId || "")
      if (!groupId) return NextResponse.json({ error: "Group ID is required" }, { status: 400 })
      const groups = await getCustomGroups()
      await saveCustomGroups(groups.filter((g) => g.id !== groupId))
      return NextResponse.json({ success: true })
    }

    if (action === "create_custom_option") {
      const groupId = String(body?.groupId || "")
      const name = String(body?.name || "").trim()
      const rawSlug = String(body?.slug || "").trim()
      if (!groupId || !name) return NextResponse.json({ error: "Invalid payload" }, { status: 400 })

      const groups = await getCustomGroups()
      const idx = groups.findIndex((g) => g.id === groupId)
      if (idx < 0) return NextResponse.json({ error: "Group not found" }, { status: 404 })

      const slug = rawSlug || slugify(name)
      if (!slug) return NextResponse.json({ error: "Invalid slug" }, { status: 400 })
      if (groups[idx].options.some((o) => o.slug === slug)) return NextResponse.json({ error: "Option slug already exists" }, { status: 409 })

      groups[idx].options.push({
        id: crypto.randomUUID(),
        name,
        slug,
      })
      await saveCustomGroups(groups)
      return NextResponse.json({ success: true })
    }

    if (action === "delete_custom_option") {
      const groupId = String(body?.groupId || "")
      const optionId = String(body?.optionId || "")
      if (!groupId || !optionId) return NextResponse.json({ error: "Invalid payload" }, { status: 400 })

      const groups = await getCustomGroups()
      const idx = groups.findIndex((g) => g.id === groupId)
      if (idx < 0) return NextResponse.json({ error: "Group not found" }, { status: 404 })
      groups[idx].options = groups[idx].options.filter((opt) => opt.id !== optionId)
      await saveCustomGroups(groups)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Attributes operation failed:", error)
    return NextResponse.json({ error: "Attributes operation failed" }, { status: 500 })
  }
}
