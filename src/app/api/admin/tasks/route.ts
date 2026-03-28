import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth-server"
import {
  getTaskBoardBootstrap,
  getTaskStatusUpdateMetadata,
  updateTaskWorkflowColumns,
} from "@/lib/actions/task-actions"
import { prisma } from "@/lib/db"
import { normalizeTaskStatus, type TaskPriority, type TaskStatus } from "@/lib/tasks"
import { taskCreateSchema } from "@/lib/validations/task"

function parseBoolean(value: string | null) {
  return value === "true" || value === "1"
}

function parseDueDate(value: string | null | undefined) {
  const trimmed = (value || "").trim()
  if (!trimmed) return null
  const date = new Date(trimmed)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser("admin")
  if (!user || (user.role !== "SUPER_USER" && user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = req.nextUrl.searchParams
  const filters = {
    search: searchParams.get("search") || undefined,
    status: searchParams.get("status") || undefined,
    priority: searchParams.get("priority") || undefined,
    assignedToId: searchParams.get("assignedToId") || undefined,
    relatedCategoryId: searchParams.get("relatedCategoryId") || undefined,
    unassigned: parseBoolean(searchParams.get("unassigned")),
    highPriority: parseBoolean(searchParams.get("highPriority")),
    overdue: parseBoolean(searchParams.get("overdue")),
    dueToday: parseBoolean(searchParams.get("dueToday")),
    scope: (searchParams.get("scope") as "open" | "completed" | "all" | null) || "all",
    limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
  }

  const data = await getTaskBoardBootstrap(user, filters)
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser("admin")
  if (!user || user.role !== "SUPER_USER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const parsed = taskCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((issue) => issue.message).join(", ") }, { status: 400 })
  }

  const payload = parsed.data
  const nextStatus = normalizeTaskStatus(payload.status)
  const created = await prisma.task.create({
    data: {
      title: payload.title,
      description: payload.description || null,
      priority: (payload.priority || "MEDIUM") as TaskPriority,
      status: nextStatus as TaskStatus,
      dueDate: parseDueDate(payload.dueDate),
      relatedProductId: payload.relatedProductId || payload.relatedProductIds?.[0] || null,
      assignedToId: payload.assignedToId || null,
      createdById: user.id,
      progressNote: payload.progressNote || null,
    },
    select: { id: true },
  })

  const metadata = getTaskStatusUpdateMetadata(nextStatus)
  await updateTaskWorkflowColumns({
    id: created.id,
    relatedCategoryId: payload.relatedCategoryId || null,
    relatedProductIds: payload.relatedProductIds || [],
    completedAt: metadata.completedAt,
    pausedAt: metadata.pausedAt,
  })

  return NextResponse.json({ success: true, id: created.id })
}
