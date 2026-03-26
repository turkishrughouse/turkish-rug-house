"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { TASK_STATUSES, type TaskPriority, type TaskStatus } from "@/lib/tasks"
import { buildProductImageAlt, getProductImageUrlCandidates, parseProductImageRecords } from "@/lib/product-images"
import { StorefrontProductImage } from "@/components/storefront/storefront-product-image"

type TaskRecord = {
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
  relatedProduct: { id: string; title: string; slug: string; sku: string | null; images: string } | null
}

type AssignableUser = {
  id: string
  name: string | null
  email: string
  role: string
}

function badgeClass(priority: string) {
  if (priority === "URGENT") return "border border-rose-300 bg-rose-100 text-rose-800"
  if (priority === "HIGH") return "border border-amber-300 bg-amber-100 text-amber-800"
  if (priority === "MEDIUM") return "border border-blue-200 bg-blue-50 text-blue-700"
  return "bg-slate-100 text-slate-700"
}

function statusTone(status: TaskStatus) {
  if (status === "COMPLETED") return "text-emerald-700"
  if (status === "PAUSED") return "text-amber-700"
  if (status === "IN_PROGRESS") return "text-blue-700"
  return "text-slate-700"
}

export function TaskList({
  tasks,
  currentUser,
  users,
  role,
  onRefresh,
  onEdit,
}: {
  tasks: TaskRecord[]
  currentUser: { id: string; role: string }
  users: AssignableUser[]
  role: string
  onRefresh: () => Promise<void>
  onEdit?: (task: TaskRecord) => void
}) {
  const [drafts, setDrafts] = useState<Record<string, { status: TaskStatus; progressNote: string }>>({})

  return (
    <div className="overflow-hidden rounded-2xl border border-[#dce3ed] bg-white shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[#e7edf5] text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Task</th>
              {role === "SUPER_USER" ? <th className="px-4 py-3 font-medium">Assigned</th> : null}
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Due</th>
              {role === "SUPER_USER" ? <th className="px-4 py-3 font-medium">Ops</th> : null}
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef2f7]">
            {tasks.map((task) => (
              <tr key={task.id} className={`align-top ${task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "COMPLETED" ? "bg-rose-50/70" : ""}`}>
                <td className="px-4 py-4">
                  <div className="space-y-1">
                    <div className="flex items-start gap-3">
                      {task.relatedProduct ? (
                        <div className="relative mt-0.5 h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-[#dce3ed] bg-white">
                          {(() => {
                            const images = parseProductImageRecords(task.relatedProduct.images)
                            const candidates = getProductImageUrlCandidates(images[0], "thumb")
                            return candidates.length > 0 ? (
                              <StorefrontProductImage
                                candidates={candidates}
                                alt={buildProductImageAlt({ title: task.relatedProduct.title, fallbackAlt: images[0]?.alt })}
                                fill
                                sizes="56px"
                                className="object-cover object-center"
                              />
                            ) : null
                          })()}
                        </div>
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900">{task.title}</p>
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass(task.priority)}`}>{task.priority}</span>
                          {task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "COMPLETED" ? (
                            <span className="inline-flex rounded-full border border-rose-300 bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800">Overdue</span>
                          ) : null}
                        </div>
                        {task.description ? <p className="max-w-md text-xs leading-5 text-slate-500">{task.description}</p> : null}
                        {task.relatedProduct ? (
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                            <span className="font-medium">{task.relatedProduct.sku || "Linked product"}</span>
                            <span>·</span>
                            <span className="truncate">{task.relatedProduct.title}</span>
                            <Link href={`/dashboard/products/${task.relatedProduct.id}`} className="font-medium text-slate-700 underline underline-offset-4">
                              Open product
                            </Link>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <textarea
                      value={drafts[task.id]?.progressNote ?? task.progressNote ?? ""}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [task.id]: { status: prev[task.id]?.status ?? task.status, progressNote: event.target.value },
                        }))
                      }
                      placeholder="Progress note"
                      className="mt-2 min-h-[68px] w-full rounded-md border border-[#dce3ed] px-3 py-2 text-xs"
                      disabled={role !== "ADMIN"}
                    />
                  </div>
                </td>
                {role === "SUPER_USER" ? (
                  <td className="px-4 py-4 text-slate-700">{task.assignedTo ? (task.assignedTo.name || task.assignedTo.email) : "Unassigned"}</td>
                ) : null}
                <td className="px-4 py-4">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass(task.priority)}`}>{task.priority}</span>
                </td>
                <td className="px-4 py-4">
                  {role === "ADMIN" ? (
                    <select
                      value={drafts[task.id]?.status ?? task.status}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [task.id]: { status: event.target.value as TaskStatus, progressNote: prev[task.id]?.progressNote ?? task.progressNote ?? "" },
                        }))
                      }
                      className="h-10 rounded-md border border-[#dce3ed] px-3 text-sm"
                    >
                      {TASK_STATUSES.map((status) => (
                        <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="space-y-2">
                      <select
                        value={drafts[task.id]?.status ?? task.status}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [task.id]: { status: event.target.value as TaskStatus, progressNote: prev[task.id]?.progressNote ?? task.progressNote ?? "" },
                          }))
                        }
                        className={`h-10 rounded-md border border-[#dce3ed] px-3 text-sm ${statusTone(drafts[task.id]?.status ?? task.status)}`}
                      >
                        {TASK_STATUSES.map((status) => (
                          <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={async () => {
                          const draft = drafts[task.id] ?? { status: task.status, progressNote: task.progressNote ?? "" }
                          await fetch(`/api/admin/tasks/${task.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(draft),
                          })
                          await onRefresh()
                        }}
                      >
                        Apply
                      </Button>
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 text-slate-700">{task.dueDate ? new Date(task.dueDate).toLocaleDateString("en-US") : "No due date"}</td>
                {role === "SUPER_USER" ? (
                  <td className="px-4 py-4">
                    <div className="space-y-2">
                      <p className="text-slate-700">{task.createdBy.name || task.createdBy.email}</p>
                      <select
                        value={task.assignedToId || ""}
                        onChange={async (event) => {
                          await fetch(`/api/admin/tasks/${task.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ assignedToId: event.target.value || null }),
                          })
                          await onRefresh()
                        }}
                        className="h-9 w-full rounded-md border border-[#dce3ed] px-3 text-xs"
                      >
                        <option value="">Unassigned</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>{user.name || user.email}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                ) : null}
                <td className="px-4 py-4">
                  <div className="flex justify-end gap-2">
                    {role === "ADMIN" ? (
                      <>
                        <Button
                          size="sm"
                          onClick={async () => {
                            const draft = drafts[task.id] ?? { status: task.status, progressNote: task.progressNote ?? "" }
                            await fetch(`/api/admin/tasks/${task.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify(draft),
                            })
                            await onRefresh()
                          }}
                        >
                          Save
                        </Button>
                        {task.status !== "COMPLETED" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              await fetch(`/api/admin/tasks/${task.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ status: "COMPLETED", progressNote: drafts[task.id]?.progressNote ?? task.progressNote ?? "" }),
                              })
                              await onRefresh()
                            }}
                          >
                            Complete
                          </Button>
                        ) : null}
                      </>
                    ) : (
                      <>
                        {onEdit ? <Button size="sm" variant="outline" onClick={() => onEdit(task)}>Edit</Button> : null}
                        {task.status !== "COMPLETED" ? (
                          <Button
                            size="sm"
                            onClick={async () => {
                              await fetch(`/api/admin/tasks/${task.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ status: "COMPLETED" }),
                              })
                              await onRefresh()
                            }}
                          >
                            Complete
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            await fetch(`/api/admin/tasks/${task.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ archived: true }),
                            })
                            await onRefresh()
                          }}
                        >
                          Archive
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={async () => {
                            await fetch(`/api/admin/tasks/${task.id}`, { method: "DELETE" })
                            await onRefresh()
                          }}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={role === "SUPER_USER" ? 7 : 5} className="px-4 py-12 text-center text-slate-500">{currentUser.role === "SUPER_USER" ? "No operational tasks found for the current filters." : "No tasks assigned to you for the current filters."}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
