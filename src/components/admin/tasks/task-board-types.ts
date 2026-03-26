import type { TaskPriority, TaskStatus } from "@/lib/tasks"

export type TaskUserPreview = {
  id: string
  name: string | null
  email: string
  role?: string
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

export type TaskRecord = {
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

export type TaskFilterState = {
  search: string
  status: string
  priority: string
  assignedToId: string
  relatedCategoryId: string
  overdue: boolean
  dueToday: boolean
  scope: "open" | "completed" | "all"
}
