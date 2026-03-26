import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth-server"
import {
  assertAdminTaskTransitionAllowed,
  ensureTaskWorkflowColumns,
  getTaskStatusUpdateMetadata,
  updateTaskWorkflowColumns,
} from "@/lib/actions/task-actions"
import { prisma } from "@/lib/db"
import { normalizeTaskStatus, type TaskPriority, type TaskStatus } from "@/lib/tasks"
import { taskAdminUpdateSchema, taskSuperUpdateSchema } from "@/lib/validations/task"

function parseDueDate(value: string | null | undefined) {
  const trimmed = (value || "").trim()
  if (!trimmed) return null
  const date = new Date(trimmed)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser("admin")
  if (!user || (user.role !== "SUPER_USER" && user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const body = await req.json()
  await ensureTaskWorkflowColumns()

  if (user.role === "SUPER_USER") {
    const parsed = taskSuperUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues.map((issue) => issue.message).join(", ") }, { status: 400 })
    }

    const payload = parsed.data
    const nextStatus = payload.status === undefined ? undefined : normalizeTaskStatus(payload.status)
    await prisma.task.update({
      where: { id },
      data: {
        title: payload.title,
        description: payload.description === undefined ? undefined : payload.description || null,
        priority: payload.priority as TaskPriority | undefined,
        status: nextStatus as TaskStatus | undefined,
        dueDate: payload.dueDate === undefined ? undefined : parseDueDate(payload.dueDate),
        relatedProductId: payload.relatedProductId === undefined ? undefined : payload.relatedProductId || payload.relatedProductIds?.[0] || null,
        assignedToId: payload.assignedToId === undefined ? undefined : payload.assignedToId || null,
        progressNote: payload.progressNote === undefined ? undefined : payload.progressNote || null,
        archivedAt: payload.archived === undefined ? undefined : payload.archived ? new Date() : null,
        updatedAt: new Date(),
      },
    })

    if (
      payload.relatedCategoryId !== undefined ||
      payload.relatedProductIds !== undefined ||
      nextStatus !== undefined
    ) {
      const metadata = nextStatus ? getTaskStatusUpdateMetadata(nextStatus) : null
      await updateTaskWorkflowColumns({
        id,
        relatedCategoryId: payload.relatedCategoryId === undefined ? undefined : payload.relatedCategoryId || null,
        relatedProductIds: payload.relatedProductIds,
        completedAt: metadata?.completedAt,
        pausedAt: metadata?.pausedAt,
      })
    }

    return NextResponse.json({ success: true })
  }

  const parsed = taskAdminUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((issue) => issue.message).join(", ") }, { status: 400 })
  }

  const task = await prisma.task.findFirst({
    where: {
      id,
      assignedToId: user.id,
      archivedAt: null,
    },
    select: { id: true, status: true },
  })
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 })
  }

  const nextStatus = parsed.data.status ? normalizeTaskStatus(parsed.data.status) : undefined
  if (nextStatus) {
    assertAdminTaskTransitionAllowed(normalizeTaskStatus(task.status), nextStatus)
  }

  await prisma.task.update({
    where: { id },
    data: {
      status: nextStatus as TaskStatus | undefined,
      progressNote: parsed.data.progressNote === undefined ? undefined : parsed.data.progressNote || null,
      updatedAt: new Date(),
    },
  })

  if (nextStatus) {
    const metadata = getTaskStatusUpdateMetadata(nextStatus)
    await updateTaskWorkflowColumns({
      id,
      completedAt: metadata.completedAt,
      pausedAt: metadata.pausedAt,
    })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser("admin")
  if (!user || user.role !== "SUPER_USER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  await prisma.task.delete({
    where: { id },
  })

  return NextResponse.json({ success: true })
}
