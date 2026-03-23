import { z } from "zod"
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/tasks"

const optionalString = z.string().trim().max(5000).optional().nullable()
const taskPrioritySchema = z.enum(TASK_PRIORITIES)
const taskStatusSchema = z.enum(TASK_STATUSES)

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160, "Title is too long"),
  description: optionalString,
  priority: taskPrioritySchema.default("MEDIUM"),
  status: taskStatusSchema.default("TODO"),
  dueDate: z.string().trim().optional().nullable(),
  relatedProductId: z.string().trim().optional().nullable(),
  assignedToId: z.string().trim().optional().nullable(),
  progressNote: z.string().trim().max(1000, "Progress note is too long").optional().nullable(),
})

export const taskSuperUpdateSchema = taskCreateSchema.partial().extend({
  archived: z.boolean().optional(),
})

export const taskAdminUpdateSchema = z.object({
  status: taskStatusSchema.optional(),
  progressNote: z.string().trim().max(1000, "Progress note is too long").optional().nullable(),
})

export type TaskCreateInput = z.infer<typeof taskCreateSchema>
export type TaskSuperUpdateInput = z.infer<typeof taskSuperUpdateSchema>
export type TaskAdminUpdateInput = z.infer<typeof taskAdminUpdateSchema>
