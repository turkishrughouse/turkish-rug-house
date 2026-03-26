export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const
export const TASK_STATUSES = ["BACKLOG", "IN_PROGRESS", "PAUSED", "COMPLETED"] as const
export const TASK_BOARD_COLUMNS = TASK_STATUSES
export const TASK_SUMMARY_FILTER_KEYS = ["BACKLOG", "IN_PROGRESS", "PAUSED", "COMPLETED_TODAY", "UNASSIGNED", "HIGH_PRIORITY"] as const

export type TaskPriority = (typeof TASK_PRIORITIES)[number]
export type TaskStatus = (typeof TASK_STATUSES)[number]
export type TaskSummaryFilterKey = (typeof TASK_SUMMARY_FILTER_KEYS)[number]

export function isTaskPriority(value: string): value is TaskPriority {
  return TASK_PRIORITIES.includes(value as TaskPriority)
}

export function isTaskStatus(value: string): value is TaskStatus {
  return TASK_STATUSES.includes(value as TaskStatus)
}

export function normalizeTaskStatus(value: string | null | undefined): TaskStatus {
  if (!value) return "BACKLOG"
  if (value === "TODO") return "BACKLOG"
  if (value === "REVIEW") return "PAUSED"
  return isTaskStatus(value) ? value : "BACKLOG"
}

export function getTaskStatusLabel(status: TaskStatus) {
  if (status === "BACKLOG") return "Backlog"
  if (status === "IN_PROGRESS") return "In Progress"
  if (status === "PAUSED") return "Paused"
  return "Completed"
}

export function getTaskPriorityLabel(priority: TaskPriority) {
  if (priority === "URGENT") return "Urgent"
  if (priority === "HIGH") return "High"
  if (priority === "MEDIUM") return "Medium"
  return "Low"
}

export function isHighPriorityTask(priority: TaskPriority) {
  return priority === "HIGH" || priority === "URGENT"
}

export function getAllowedAdminTaskTransitions(status: TaskStatus) {
  if (status === "BACKLOG") return ["IN_PROGRESS"] as TaskStatus[]
  if (status === "IN_PROGRESS") return ["PAUSED", "COMPLETED"] as TaskStatus[]
  if (status === "PAUSED") return ["IN_PROGRESS", "COMPLETED"] as TaskStatus[]
  return [] as TaskStatus[]
}

export function canAdminTransitionTask(from: TaskStatus, to: TaskStatus) {
  return getAllowedAdminTaskTransitions(from).includes(to)
}
