"use client"

import Link from "next/link"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getTaskPriorityLabel, getTaskStatusLabel, type TaskStatus } from "@/lib/tasks"
import type { TaskRecord } from "@/components/admin/tasks/task-board-types"

export function TaskDetailDrawer({
  task,
  open,
  canManage,
  onClose,
  onEdit,
  onStatusChange,
  onArchive,
  onDelete,
}: {
  task: TaskRecord | null
  open: boolean
  canManage: boolean
  onClose: () => void
  onEdit: (task: TaskRecord) => void
  onStatusChange: (task: TaskRecord, nextStatus: TaskStatus) => void
  onArchive: (task: TaskRecord) => void
  onDelete: (task: TaskRecord) => void
}) {
  if (!task || !open) return null

  const quickActions = [
    task.permissions.canStart ? { label: "Start Task", status: "IN_PROGRESS" as TaskStatus } : null,
    task.permissions.canPause ? { label: "Pause Task", status: "PAUSED" as TaskStatus } : null,
    task.permissions.canResume ? { label: "Resume Task", status: "IN_PROGRESS" as TaskStatus } : null,
    task.permissions.canComplete ? { label: "Complete Task", status: "COMPLETED" as TaskStatus } : null,
  ].filter(Boolean) as Array<{ label: string; status: TaskStatus }>

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/30 backdrop-blur-[1px]">
      <div className="absolute inset-y-0 right-0 w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-[#fbfcfe] shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-[#fbfcfe]/95 px-6 py-5 backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Task Detail</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">{task.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-white hover:text-slate-900">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Status</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{getTaskStatusLabel(task.status)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Priority</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{getTaskPriorityLabel(task.priority)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Due</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{task.dueDate ? new Date(task.dueDate).toLocaleDateString("en-US") : "No due date"}</p>
            </div>
          </div>

          {task.description ? (
            <section className="rounded-[24px] border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Description</p>
              <p className="mt-3 text-sm leading-7 text-slate-700">{task.description}</p>
            </section>
          ) : null}

          <section className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[24px] border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Assigned To</p>
              <p className="mt-3 text-sm font-medium text-slate-900">{task.assignedTo ? (task.assignedTo.name || task.assignedTo.email) : "Unassigned"}</p>
              <p className="mt-1 text-xs text-slate-500">{task.assignedTo?.email || "No assignee yet"}</p>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Created By</p>
              <p className="mt-3 text-sm font-medium text-slate-900">{task.createdBy.name || task.createdBy.email}</p>
              <p className="mt-1 text-xs text-slate-500">{task.createdBy.email}</p>
            </div>
          </section>

          {task.relatedCategory ? (
            <section className="rounded-[24px] border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Category</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">{task.relatedCategory.title}</p>
                </div>
                {task.categoryContext ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Upload Progress</p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">
                      {task.categoryContext.uploadedProducts}/{task.categoryContext.totalProducts} uploaded
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{task.categoryContext.remainingProducts} remaining</p>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {task.relatedProducts.length > 0 ? (
            <section className="rounded-[24px] border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Related Products</p>
              <div className="mt-4 space-y-3">
                {task.relatedProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{product.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{product.sku || product.slug}</p>
                    </div>
                    <Link href={`/dashboard/products/${product.id}`} className="text-xs font-medium text-slate-700 underline underline-offset-4">
                      Open
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[24px] border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Created</p>
              <p className="mt-3 text-sm text-slate-900">{new Date(task.createdAt).toLocaleString("en-US")}</p>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Updated</p>
              <p className="mt-3 text-sm text-slate-900">{new Date(task.updatedAt).toLocaleString("en-US")}</p>
            </div>
            {task.completedAt ? (
              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Completed</p>
                <p className="mt-3 text-sm text-emerald-900">{new Date(task.completedAt).toLocaleString("en-US")}</p>
              </div>
            ) : null}
            {task.pausedAt ? (
              <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Last Paused</p>
                <p className="mt-3 text-sm text-amber-900">{new Date(task.pausedAt).toLocaleString("en-US")}</p>
              </div>
            ) : null}
          </section>

          {task.progressNote ? (
            <section className="rounded-[24px] border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Progress Note</p>
              <p className="mt-3 text-sm leading-7 text-slate-700">{task.progressNote}</p>
            </section>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
            {canManage ? <Button variant="outline" onClick={() => onEdit(task)}>Edit</Button> : null}
            {quickActions.map((action) => (
              <Button key={action.label} onClick={() => onStatusChange(task, action.status)}>{action.label}</Button>
            ))}
            {task.permissions.canArchive ? (
              <Button variant="outline" onClick={() => onArchive(task)}>Archive</Button>
            ) : null}
            {task.permissions.canDelete ? (
              <Button variant="destructive" onClick={() => onDelete(task)}>Delete</Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
