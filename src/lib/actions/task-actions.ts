import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { isTaskPriority, isTaskStatus, type TaskPriority, type TaskStatus } from "@/lib/tasks"

export type TaskViewer = {
  id: string
  email: string
  name: string | null
  role: string
}

export type TaskFilterInput = {
  status?: string
  priority?: string
  assignedToId?: string
  overdue?: boolean
  dueToday?: boolean
  scope?: "open" | "completed" | "all"
  limit?: number
}

export type AdminTaskRecord = {
  id: string
  title: string
  description: string | null
  priority: TaskPriority
  status: TaskStatus
  dueDate: string | null
  assignedToId: string | null
  createdById: string
  progressNote: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  assignedTo: { id: string; name: string | null; email: string } | null
  createdBy: { id: string; name: string | null; email: string }
  relatedProduct: {
    id: string
    title: string
    slug: string
    sku: string | null
    images: string
  } | null
}

export type TaskSummary = {
  open: number
  overdue: number
  dueToday: number
  completed: number
  unassigned: number
  urgent: number
}

export type TaskProductOption = {
  id: string
  title: string
  slug: string
  sku: string | null
  images: string
}

function isSuperUser(viewer: TaskViewer) {
  return viewer.role === "SUPER_USER"
}

function startOfToday() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

function endOfToday() {
  const date = new Date()
  date.setHours(23, 59, 59, 999)
  return date
}

function buildTaskWhere(viewer: TaskViewer, filters: TaskFilterInput = {}): Prisma.TaskWhereInput {
  const where: Prisma.TaskWhereInput = {
    archivedAt: null,
  }

  if (!isSuperUser(viewer)) {
    where.assignedToId = viewer.id
  } else if (filters.assignedToId) {
    where.assignedToId = filters.assignedToId
  }

  if (filters.status && isTaskStatus(filters.status)) {
    where.status = filters.status
  }

  if (filters.priority && isTaskPriority(filters.priority)) {
    where.priority = filters.priority
  }

  const andClauses: Prisma.TaskWhereInput[] = []
  const todayStart = startOfToday()
  const todayEnd = endOfToday()

  if (filters.scope === "open") {
    andClauses.push({ status: { not: "COMPLETED" } })
  } else if (filters.scope === "completed") {
    andClauses.push({ status: "COMPLETED" })
  }

  if (filters.overdue) {
    andClauses.push({
      dueDate: { lt: todayStart },
      status: { not: "COMPLETED" },
    })
  }

  if (filters.dueToday) {
    andClauses.push({
      dueDate: {
        gte: todayStart,
        lte: todayEnd,
      },
    })
  }

  if (andClauses.length > 0) {
    where.AND = andClauses
  }

  return where
}

function serializeTask(task: {
  id: string
  title: string
  description: string | null
  priority: string
  status: string
  dueDate: Date | null
  assignedToId: string | null
  createdById: string
  progressNote: string | null
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
  assignedTo: { id: string; name: string | null; email: string } | null
  createdBy: { id: string; name: string | null; email: string }
  relatedProduct: { id: string; title: string; slug: string; sku: string | null; images: string } | null
}): AdminTaskRecord {
  return {
    ...task,
    priority: isTaskPriority(task.priority) ? task.priority : "MEDIUM",
    status: isTaskStatus(task.status) ? task.status : "TODO",
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    archivedAt: task.archivedAt ? task.archivedAt.toISOString() : null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  }
}

export async function getAssignableTaskUsers() {
  const users = await prisma.user.findMany({
    where: {
      role: {
        in: ["SUPER_USER", "ADMIN"],
      },
      isBlocked: false,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
    orderBy: [{ role: "asc" }, { name: "asc" }, { email: "asc" }],
  })

  return users
}

export async function getTasksForViewer(viewer: TaskViewer, filters: TaskFilterInput = {}) {
  const tasks = await prisma.task.findMany({
    where: buildTaskWhere(viewer, filters),
    include: {
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      relatedProduct: {
        select: { id: true, title: true, slug: true, sku: true, images: true },
      },
    },
    orderBy: [
      { dueDate: "asc" },
      { updatedAt: "desc" },
      { createdAt: "desc" },
    ],
    take: filters.limit,
  })

  return tasks.map(serializeTask)
}

export async function getTaskDashboardSummary(viewer: TaskViewer): Promise<TaskSummary> {
  const todayStart = startOfToday()
  const todayEnd = endOfToday()
  const baseWhere = buildTaskWhere(viewer, {})
  const scopeWhere = !isSuperUser(viewer) ? { assignedToId: viewer.id, archivedAt: null } : { archivedAt: null }

  const [open, overdue, dueToday, completed, unassigned, urgent] = await Promise.all([
    prisma.task.count({
      where: {
        ...baseWhere,
        status: { not: "COMPLETED" },
      },
    }),
    prisma.task.count({
      where: {
        ...scopeWhere,
        dueDate: { lt: todayStart },
        status: { not: "COMPLETED" },
      },
    }),
    prisma.task.count({
      where: {
        ...scopeWhere,
        dueDate: { gte: todayStart, lte: todayEnd },
      },
    }),
    prisma.task.count({
      where: {
        ...scopeWhere,
        status: "COMPLETED",
      },
    }),
    prisma.task.count({
      where: isSuperUser(viewer)
        ? {
            archivedAt: null,
            assignedToId: null,
            status: { not: "COMPLETED" },
          }
        : {
            archivedAt: null,
            assignedToId: viewer.id,
            status: { not: "COMPLETED" },
          },
    }),
    prisma.task.count({
      where: {
        ...scopeWhere,
        priority: "URGENT",
        status: { not: "COMPLETED" },
      },
    }),
  ])

  return { open, overdue, dueToday, completed, unassigned, urgent }
}

export async function getTaskProductOptions(limit = 120): Promise<TaskProductOption[]> {
  return prisma.product.findMany({
    where: { isPublished: true },
    select: {
      id: true,
      title: true,
      slug: true,
      sku: true,
      images: true,
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  })
}
