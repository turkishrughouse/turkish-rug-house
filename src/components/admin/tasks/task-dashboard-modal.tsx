"use client"

import { useState } from "react"
import Link from "next/link"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { TaskForm } from "@/components/admin/tasks/task-form"
import { StorefrontProductImage } from "@/components/storefront/storefront-product-image"
import { buildProductImageAlt, getProductImageUrlCandidates, parseProductImageRecords } from "@/lib/product-images"
import type { TaskCategoryOption } from "@/components/admin/tasks/task-board-types"

type AssignableUser = {
  id: string
  name: string | null
  email: string
  role: string
}

type TaskRecord = {
  id: string
  title: string
  description: string | null
  priority: string
  status: string
  dueDate: string | null
  assignedToId: string | null
  progressNote: string | null
  assignedTo: { id: string; name: string | null; email: string } | null
  createdBy?: { id: string; name: string | null; email: string }
  relatedProduct: { id: string; title: string; slug: string; sku: string | null; images: string } | null
}

type TaskProductOption = {
  id: string
  title: string
  slug: string
  sku: string | null
  images: string
}

export function TaskDashboardModal({
  open,
  onOpenChange,
  currentUser,
  tasks,
  users,
  products,
  categories,
  onRefresh,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUser: { role: string }
  tasks: TaskRecord[]
  users: AssignableUser[]
  products: TaskProductOption[]
  categories: TaskCategoryOption[]
  onRefresh: () => Promise<void>
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) || tasks[0] || null
  const selectedProductImages = selectedTask?.relatedProduct ? parseProductImageRecords(selectedTask.relatedProduct.images) : []
  const selectedProductCandidates = selectedTask?.relatedProduct ? getProductImageUrlCandidates(selectedProductImages[0], "thumb") : []

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[88vh] max-w-4xl overflow-hidden border-[#dce3ed] bg-white p-0">
          <DialogHeader className="border-b border-[#e5ebf3] px-6 py-4">
            <DialogTitle className="text-xl font-semibold text-slate-950">
              {currentUser.role === "SUPER_USER" ? "All Tasks" : "My Tasks"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid h-[72vh] grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1.1fr)_340px]">
            <div className="space-y-4 overflow-y-auto border-b border-[#e5ebf3] p-6 lg:border-b-0 lg:border-r">
            {currentUser.role === "SUPER_USER" ? (
              <div className="flex justify-end">
                <Button onClick={() => setCreateOpen(true)}>Create task</Button>
              </div>
            ) : null}
            <div className="space-y-3">
              {tasks.map((task) => (
                <button key={task.id} type="button" onClick={() => setSelectedTaskId(task.id)} className={`block w-full rounded-2xl border p-4 text-left ${selectedTask?.id === task.id ? "border-slate-900 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.08)]" : "border-[#dce3ed] bg-slate-50"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-900">{task.title}</p>
                      {task.description ? <p className="text-sm text-slate-600">{task.description}</p> : null}
                      <p className="text-xs text-slate-500">
                        {task.assignedTo ? `Assigned to ${task.assignedTo.name || task.assignedTo.email}` : "Unassigned"}
                        {task.dueDate ? ` • Due ${new Date(task.dueDate).toLocaleDateString("en-US")}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {currentUser.role === "ADMIN" ? (
                        <select
                          defaultValue={task.status}
                          className="h-10 rounded-md border border-[#dce3ed] px-3 text-sm"
                          onChange={async (event) => {
                            await fetch(`/api/admin/tasks/${task.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ status: event.target.value }),
                            })
                            await onRefresh()
                          }}
                        >
                          <option value="BACKLOG">BACKLOG</option>
                          <option value="IN_PROGRESS">IN_PROGRESS</option>
                          <option value="PAUSED">PAUSED</option>
                          <option value="COMPLETED">COMPLETED</option>
                        </select>
                      ) : (
                        <Button variant="outline" onClick={() => (window.location.href = "/dashboard/tasks")}>Open</Button>
                      )}
                    </div>
                  </div>
                </button>
              ))}
              {tasks.length === 0 ? <p className="text-sm text-slate-500">No tasks available.</p> : null}
            </div>
            </div>
            <div className="space-y-4 overflow-y-auto bg-slate-50/70 p-6">
              {selectedTask ? (
                <>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Task detail</p>
                    <h3 className="mt-2 text-2xl font-semibold text-slate-950">{selectedTask.title}</h3>
                    {selectedTask.description ? <p className="mt-2 text-sm leading-6 text-slate-600">{selectedTask.description}</p> : null}
                  </div>
                  <div className="grid gap-3 text-sm text-slate-700">
                    <div className="rounded-xl border border-[#dce3ed] bg-white p-4">Status: <span className="font-semibold">{selectedTask.status}</span></div>
                    <div className="rounded-xl border border-[#dce3ed] bg-white p-4">Priority: <span className="font-semibold">{selectedTask.priority}</span></div>
                    <div className="rounded-xl border border-[#dce3ed] bg-white p-4">Due: <span className="font-semibold">{selectedTask.dueDate ? new Date(selectedTask.dueDate).toLocaleDateString("en-US") : "No due date"}</span></div>
                    <div className="rounded-xl border border-[#dce3ed] bg-white p-4">Assigned: <span className="font-semibold">{selectedTask.assignedTo ? (selectedTask.assignedTo.name || selectedTask.assignedTo.email) : "Unassigned"}</span></div>
                    {selectedTask.createdBy ? <div className="rounded-xl border border-[#dce3ed] bg-white p-4">Created by: <span className="font-semibold">{selectedTask.createdBy.name || selectedTask.createdBy.email}</span></div> : null}
                  </div>
                  {selectedTask.relatedProduct ? (
                    <div className="rounded-2xl border border-[#dce3ed] bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Related product</p>
                      <div className="mt-3 flex items-center gap-3">
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-[#dce3ed] bg-white">
                          {selectedProductCandidates.length > 0 ? <StorefrontProductImage candidates={selectedProductCandidates} alt={buildProductImageAlt({ title: selectedTask.relatedProduct.title, fallbackAlt: selectedProductImages[0]?.alt })} fill sizes="64px" className="object-cover object-center" /> : null}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{selectedTask.relatedProduct.title}</p>
                          {selectedTask.relatedProduct.sku ? <p className="text-xs text-slate-500">{selectedTask.relatedProduct.sku}</p> : null}
                          <Link href={`/dashboard/products/${selectedTask.relatedProduct.id}`} className="text-xs font-medium text-slate-700 underline underline-offset-4">Open product</Link>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {selectedTask.progressNote ? (
                    <div className="rounded-2xl border border-[#dce3ed] bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Progress note</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{selectedTask.progressNote}</p>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-slate-500">Select a task to inspect details.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <TaskForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        users={users}
        products={products}
        categories={categories}
        onSubmit={async (payload) => {
          await fetch("/api/admin/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
          await onRefresh()
        }}
      />
    </>
  )
}
