import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import {
  canAdminTransitionTask,
  getAllowedAdminTaskTransitions,
  isHighPriorityTask,
  isTaskPriority,
  normalizeTaskStatus,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks"

export type TaskViewer = {
  id: string
  email: string
  name: string | null
  role: string
}

export type TaskFilterInput = {
  search?: string
  status?: string
  priority?: string
  assignedToId?: string
  relatedCategoryId?: string
  unassigned?: boolean
  highPriority?: boolean
  overdue?: boolean
  dueToday?: boolean
  scope?: "open" | "completed" | "all"
  limit?: number
}

export type TaskUserPreview = {
  id: string
  name: string | null
  email: string
}

export type TaskCategoryOption = {
  id: string
  slug: string
  title: string
  totalProducts: number
  uploadedProducts: number
  remainingProducts: number
}

export type TaskProductOption = {
  id: string
  title: string
  slug: string
  sku: string | null
  images: string
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
  completedAt: string | null
  pausedAt: string | null
  relatedCategoryId: string | null
  relatedProductIds: string[]
  assignedTo: TaskUserPreview | null
  createdBy: TaskUserPreview
  relatedCategory: TaskCategoryOption | null
  relatedProducts: TaskProductOption[]
  categoryContext: {
    totalProducts: number
    uploadedProducts: number
    remainingProducts: number
  } | null
  permissions: {
    canEdit: boolean
    canAssign: boolean
    canArchive: boolean
    canDelete: boolean
    canStart: boolean
    canPause: boolean
    canResume: boolean
    canComplete: boolean
    canDrag: boolean
  }
}

export type TaskSummary = {
  backlog: number
  inProgress: number
  paused: number
  completedToday: number
  unassigned: number
  highPriority: number
}

type TaskMetaRow = {
  id: string
  relatedCategoryId: string | null
  relatedProductIds: string | null
  completedAt: Date | string | null
  pausedAt: Date | string | null
}

function isSuperUser(viewer: TaskViewer) {
  return viewer.role === "SUPER_USER"
}

function parseTaskDate(value: string | Date | null | undefined) {
  if (!value) return null
  if (value instanceof Date) return value
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function parseTaskJsonArray(value: string | null | undefined) {
  if (!value) return [] as string[]
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : []
  } catch {
    return []
  }
}

function normalizePriority(value: string): TaskPriority {
  return isTaskPriority(value) ? value : "MEDIUM"
}

function statusMatchesFilter(status: TaskStatus, filter?: string) {
  if (!filter) return true
  return normalizeTaskStatus(filter) === status
}

function buildPermissions(viewer: TaskViewer, input: { assignedToId: string | null; status: TaskStatus }) {
  if (isSuperUser(viewer)) {
    return {
      canEdit: true,
      canAssign: true,
      canArchive: true,
      canDelete: true,
      canStart: true,
      canPause: true,
      canResume: true,
      canComplete: true,
      canDrag: true,
    }
  }

  const ownsTask = input.assignedToId === viewer.id
  const transitions = ownsTask ? getAllowedAdminTaskTransitions(input.status) : []
  return {
    canEdit: false,
    canAssign: false,
    canArchive: false,
    canDelete: false,
    canStart: ownsTask && transitions.includes("IN_PROGRESS"),
    canPause: ownsTask && transitions.includes("PAUSED"),
    canResume: ownsTask && input.status === "PAUSED",
    canComplete: ownsTask && transitions.includes("COMPLETED"),
    canDrag: ownsTask,
  }
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

function buildBaseTaskWhere(viewer: TaskViewer, filters: TaskFilterInput = {}): Prisma.TaskWhereInput {
  const where: Prisma.TaskWhereInput = {
    archivedAt: null,
  }

  if (!isSuperUser(viewer)) {
    where.assignedToId = viewer.id
  } else if (filters.assignedToId) {
    where.assignedToId = filters.assignedToId
  }

  if (filters.priority && isTaskPriority(filters.priority)) {
    where.priority = filters.priority
  }

  if (filters.search?.trim()) {
    const query = filters.search.trim()
    where.OR = [
      { title: { contains: query } },
      { description: { contains: query } },
      { progressNote: { contains: query } },
    ]
  }

  return where
}

async function fetchTaskMeta(taskIds: string[]) {
  if (taskIds.length === 0) return new Map<string, TaskMetaRow>()
  const rows = await prisma.task.findMany({
    where: { id: { in: taskIds } },
    select: {
      id: true,
      relatedCategoryId: true,
      relatedProductIds: true,
      completedAt: true,
      pausedAt: true,
    },
  })
  return new Map(rows.map((row) => [row.id, row]))
}

export async function getAssignableTaskUsers() {
  return prisma.user.findMany({
    where: {
      role: { in: ["SUPER_USER", "ADMIN"] },
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
}

export async function getTaskCategoryOptions(limit = 120): Promise<TaskCategoryOption[]> {
  const categories = await prisma.category.findMany({
    select: {
      id: true,
      slug: true,
      title: true,
      products: {
        select: {
          id: true,
          isPublished: true,
        },
      },
    },
    orderBy: [{ title: "asc" }],
    take: limit,
  })

  return categories.map((category) => {
    const totalProducts = category.products.length
    const uploadedProducts = category.products.filter((product) => product.isPublished).length
    return {
      id: category.id,
      slug: category.slug,
      title: category.title,
      totalProducts,
      uploadedProducts,
      remainingProducts: Math.max(totalProducts - uploadedProducts, 0),
    }
  })
}

export async function getTaskProductOptions(limit = 200): Promise<TaskProductOption[]> {
  return prisma.product.findMany({
    where: { isPublished: true },
    select: {
      id: true,
      title: true,
      slug: true,
      sku: true,
      images: true,
    },
    orderBy: [{ updatedAt: "desc" }],
    take: limit,
  })
}

export async function getTasksForViewer(viewer: TaskViewer, filters: TaskFilterInput = {}) {
  const baseTasks = await prisma.task.findMany({
    where: buildBaseTaskWhere(viewer, filters),
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      relatedProduct: { select: { id: true, title: true, slug: true, sku: true, images: true } },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: filters.limit ? Math.max(filters.limit * 4, filters.limit) : undefined,
  })

  const metaById = await fetchTaskMeta(baseTasks.map((task) => task.id))
  const categoryIds = Array.from(
    new Set(baseTasks.map((task) => metaById.get(task.id)?.relatedCategoryId).filter((value): value is string => Boolean(value))),
  )
  const categoryOptions = await getTaskCategoryOptions(Math.max(categoryIds.length, 120))
  const categoryMap = new Map(categoryOptions.map((category) => [category.id, category]))

  const relatedProductIds = Array.from(
    new Set(
      baseTasks.flatMap((task) => {
        const meta = metaById.get(task.id)
        return [...parseTaskJsonArray(meta?.relatedProductIds), ...(task.relatedProductId ? [task.relatedProductId] : [])]
      }),
    ),
  )
  const extraProducts = relatedProductIds.length > 0
    ? await prisma.product.findMany({
        where: { id: { in: relatedProductIds } },
        select: { id: true, title: true, slug: true, sku: true, images: true },
      })
    : []
  const productMap = new Map(extraProducts.map((product) => [product.id, product]))

  const todayStart = startOfToday()
  const todayEnd = endOfToday()

  const filtered = baseTasks
    .map((task) => {
      const meta = metaById.get(task.id)
      const normalizedStatus = normalizeTaskStatus(task.status)
      const relatedCategory = meta?.relatedCategoryId ? categoryMap.get(meta.relatedCategoryId) || null : null
      const relatedProductIdsForTask = Array.from(
        new Set([...parseTaskJsonArray(meta?.relatedProductIds), ...(task.relatedProductId ? [task.relatedProductId] : [])]),
      )
      const relatedProducts = relatedProductIdsForTask
        .map((productId) => productMap.get(productId))
        .filter((product): product is TaskProductOption => Boolean(product))
      const permissions = buildPermissions(viewer, {
        assignedToId: task.assignedToId,
        status: normalizedStatus,
      })

      return {
        id: task.id,
        title: task.title,
        description: task.description,
        priority: normalizePriority(task.priority),
        status: normalizedStatus,
        dueDate: task.dueDate ? task.dueDate.toISOString() : null,
        assignedToId: task.assignedToId,
        createdById: task.createdById,
        progressNote: task.progressNote,
        archivedAt: task.archivedAt ? task.archivedAt.toISOString() : null,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        completedAt: parseTaskDate(meta?.completedAt)?.toISOString() || null,
        pausedAt: parseTaskDate(meta?.pausedAt)?.toISOString() || null,
        relatedCategoryId: meta?.relatedCategoryId || null,
        relatedProductIds: relatedProductIdsForTask,
        assignedTo: task.assignedTo,
        createdBy: task.createdBy,
        relatedCategory,
        relatedProducts,
        categoryContext: relatedCategory
          ? {
              totalProducts: relatedCategory.totalProducts,
              uploadedProducts: relatedCategory.uploadedProducts,
              remainingProducts: relatedCategory.remainingProducts,
            }
          : null,
        permissions,
      } satisfies AdminTaskRecord
    })
    .filter((task) => {
      if (filters.search?.trim()) {
        const query = filters.search.trim().toLowerCase()
        const haystack = [
          task.title,
          task.description || "",
          task.progressNote || "",
          task.assignedTo?.name || "",
          task.assignedTo?.email || "",
          task.createdBy.name || "",
          task.createdBy.email || "",
          task.relatedCategory?.title || "",
          ...task.relatedProducts.flatMap((product) => [product.title, product.slug, product.sku || ""]),
        ].join(" ").toLowerCase()
        if (!haystack.includes(query)) return false
      }
      if (!statusMatchesFilter(task.status, filters.status)) return false
      if (filters.relatedCategoryId && task.relatedCategoryId !== filters.relatedCategoryId) return false
      if (filters.unassigned && task.assignedToId) return false
      if (filters.highPriority && !isHighPriorityTask(task.priority)) return false
      if (filters.scope === "open" && task.status === "COMPLETED") return false
      if (filters.scope === "completed" && task.status !== "COMPLETED") return false
      if (filters.overdue) {
        if (!task.dueDate) return false
        const dueDate = new Date(task.dueDate)
        if (!(dueDate < todayStart && task.status !== "COMPLETED")) return false
      }
      if (filters.dueToday) {
        if (!task.dueDate) return false
        const dueDate = new Date(task.dueDate)
        if (!(dueDate >= todayStart && dueDate <= todayEnd)) return false
      }
      return true
    })
    .sort((a, b) => {
      const statusOrder = ["BACKLOG", "IN_PROGRESS", "PAUSED", "COMPLETED"]
      const statusDelta = statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status)
      if (statusDelta !== 0) return statusDelta
      const priorityOrder = ["URGENT", "HIGH", "MEDIUM", "LOW"]
      const priorityDelta = priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority)
      if (priorityDelta !== 0) return priorityDelta
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER
      if (aDue !== bDue) return aDue - bDue
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })

  return filters.limit ? filtered.slice(0, filters.limit) : filtered
}

export async function getTaskDashboardSummary(viewer: TaskViewer): Promise<TaskSummary> {
  const tasks = await getTasksForViewer(viewer, { scope: "all" })
  const todayStart = startOfToday()
  const todayEnd = endOfToday()
  return {
    backlog: tasks.filter((task) => task.status === "BACKLOG").length,
    inProgress: tasks.filter((task) => task.status === "IN_PROGRESS").length,
    paused: tasks.filter((task) => task.status === "PAUSED").length,
    completedToday: tasks.filter((task) => {
      if (!task.completedAt) return false
      const completedAt = new Date(task.completedAt)
      return completedAt >= todayStart && completedAt <= todayEnd
    }).length,
    unassigned: tasks.filter((task) => !task.assignedToId && task.status !== "COMPLETED").length,
    highPriority: tasks.filter((task) => isHighPriorityTask(task.priority) && task.status !== "COMPLETED").length,
  }
}

export async function updateTaskWorkflowColumns(input: {
  id: string
  relatedCategoryId?: string | null
  relatedProductIds?: string[]
  completedAt?: Date | null
  pausedAt?: Date | null
}) {
  await prisma.task.update({
    where: { id: input.id },
    data: {
      relatedCategoryId: input.relatedCategoryId ?? null,
      relatedProductIds: JSON.stringify(input.relatedProductIds ?? []),
      completedAt: input.completedAt ?? null,
      pausedAt: input.pausedAt ?? null,
    },
  })
}

export async function getTaskBoardBootstrap(viewer: TaskViewer, filters: TaskFilterInput = {}) {
  const [tasks, summary, users, products, categories] = await Promise.all([
    getTasksForViewer(viewer, filters),
    getTaskDashboardSummary(viewer),
    isSuperUser(viewer) ? getAssignableTaskUsers() : Promise.resolve([]),
    isSuperUser(viewer) ? getTaskProductOptions() : Promise.resolve([]),
    getTaskCategoryOptions(),
  ])

  return { tasks, summary, users, products, categories }
}

export function getTaskStatusUpdateMetadata(nextStatus: TaskStatus) {
  const now = new Date()
  return {
    completedAt: nextStatus === "COMPLETED" ? now : null,
    pausedAt: nextStatus === "PAUSED" ? now : null,
  }
}

export function assertAdminTaskTransitionAllowed(currentStatus: TaskStatus, nextStatus: TaskStatus) {
  if (currentStatus === nextStatus) return
  if (!canAdminTransitionTask(currentStatus, nextStatus)) {
    throw new Error("This task transition is not allowed for admins")
  }
}
