import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { SUPPORT_FAQ_SEED, getSupportCategorySlug, parseSupportCategory } from "@/lib/support"

function parseTags(raw: string | null | undefined) {
  if (!raw) return [] as string[]
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []
  } catch {
    return []
  }
}

export async function GET(req: NextRequest) {
  const categoryRaw = req.nextUrl.searchParams.get("category")
  const category = parseSupportCategory(categoryRaw)
  if (categoryRaw && !category) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 })
  }
  let rows: Awaited<ReturnType<typeof prisma.supportFaq.findMany>> = []
  try {
    rows = await prisma.supportFaq.findMany({
      where: category ? { category } : undefined,
      orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
      take: 7,
    })
  } catch (error) {
    console.error("[support/faqs] Falling back to seed data:", error)
    rows = []
  }

  const faqs =
    rows.length > 0
      ? rows.map((row) => ({
          id: row.id,
          category: row.category,
          categorySlug: getSupportCategorySlug(row.category),
          question: row.question,
          answerShort: row.answerShort,
          answerLong: row.answerLong,
          tags: parseTags(row.tags),
          isFeatured: row.isFeatured,
          updatedAt: row.updatedAt,
        }))
      : SUPPORT_FAQ_SEED.filter((item) => (category ? item.category === category : true))
          .slice(0, 7)
          .map((item, index) => ({
            id: `seed-${item.category}-${index + 1}`,
            category: item.category,
            categorySlug: getSupportCategorySlug(item.category),
            question: item.question,
            answerShort: item.answerShort,
            answerLong: item.answerLong,
            tags: item.tags,
            isFeatured: Boolean(item.isFeatured),
            updatedAt: new Date(0),
          }))

  return NextResponse.json({ faqs })
}
