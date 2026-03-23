import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth-server"
import { getAssignableTaskUsers, getTaskDashboardSummary, getTasksForViewer } from "@/lib/actions/task-actions"
import { prisma } from "@/lib/db"
import { type TaskPriority, type TaskStatus } from "@/lib/tasks"
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
    status: searchParams.get("status") || undefined,
    priority: searchParams.get("priority") || undefined,
    assignedToId: searchParams.get("assignedToId") || undefined,
    overdue: parseBoolean(searchParams.get("overdue")),
    dueToday: parseBoolean(searchParams.get("dueToday")),
    scope: (searchParams.get("scope") as "open" | "completed" | "all" | null) || "all",
    limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
  }

  const [tasks, summary, users] = await Promise.all([
    getTasksForViewer(user, filters),
    getTaskDashboardSummary(user),
    user.role === "SUPER_USER" ? getAssignableTaskUsers() : Promise.resolve([]),
  ])

  return NextResponse.json({ tasks, summary, users })
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
  const created = await prisma.task.create({
    data: {
      title: payload.title,
      description: payload.description || null,
      priority: (payload.priority || "MEDIUM") as TaskPriority,
      status: (payload.status || "TODO") as TaskStatus,
      dueDate: parseDueDate(payload.dueDate),
      relatedProductId: payload.relatedProductId || null,
      assignedToId: payload.assignedToId || null,
      createdById: user.id,
      progressNote: payload.progressNote || null,
    },
  })

  return NextResponse.json({ success: true, id: created.id })
}
