export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const
export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "REVIEW", "COMPLETED"] as const

export type TaskPriority = (typeof TASK_PRIORITIES)[number]
export type TaskStatus = (typeof TASK_STATUSES)[number]

export function isTaskPriority(value: string): value is TaskPriority {
  return TASK_PRIORITIES.includes(value as TaskPriority)
}

export function isTaskStatus(value: string): value is TaskStatus {
  return TASK_STATUSES.includes(value as TaskStatus)
}
