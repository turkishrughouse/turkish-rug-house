"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { TaskFilters, type TaskFilterState } from "@/components/admin/tasks/task-filters"
import { TaskForm } from "@/components/admin/tasks/task-form"
import { TaskList } from "@/components/admin/tasks/task-list"

type TaskRecord = {
  id: string
  title: string
  description: string | null
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  status: "TODO" | "IN_PROGRESS" | "REVIEW" | "COMPLETED"
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

type TaskSummary = {
  open: number
  overdue: number
  dueToday: number
  completed: number
  unassigned: number
  urgent: number
}

type TaskProductOption = {
  id: string
  title: string
  slug: string
  sku: string | null
  images: string
}

export function TasksPageClient({
  currentUser,
  initialTasks,
  initialSummary,
  initialUsers,
  initialProducts,
}: {
  currentUser: { id: string; role: string }
  initialTasks: TaskRecord[]
  initialSummary: TaskSummary
  initialUsers: AssignableUser[]
  initialProducts: TaskProductOption[]
}) {
  const [tasks, setTasks] = useState(initialTasks)
  const [summary, setSummary] = useState(initialSummary)
  const [users] = useState(initialUsers)
  const [products] = useState(initialProducts)
  const [filters, setFilters] = useState<TaskFilterState>({
    status: "",
    priority: "",
    assignedToId: "",
    overdue: false,
    dueToday: false,
    scope: "all",
  })
  const [createOpen, setCreateOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskRecord | null>(null)

  const loadTasks = async (nextFilters = filters) => {
    const params = new URLSearchParams()
    if (nextFilters.status) params.set("status", nextFilters.status)
    if (nextFilters.priority) params.set("priority", nextFilters.priority)
    if (currentUser.role === "SUPER_USER" && nextFilters.assignedToId) params.set("assignedToId", nextFilters.assignedToId)
    if (nextFilters.overdue) params.set("overdue", "true")
    if (nextFilters.dueToday) params.set("dueToday", "true")
    if (nextFilters.scope) params.set("scope", nextFilters.scope)
    const res = await fetch(`/api/admin/tasks?${params.toString()}`, { cache: "no-store" })
    const json = await res.json()
    setTasks(json.tasks)
    setSummary(json.summary)
  }

  const title = currentUser.role === "SUPER_USER" ? "All Tasks" : "My Tasks"

  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
        <section className="rounded-[32px] border border-[#dce3ed] bg-white px-8 py-8 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Tasks</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">{title}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {currentUser.role === "SUPER_USER" ? "Create, assign and manage tasks across the admin team." : "Review and update the tasks assigned to you."}
              </p>
            </div>
            {currentUser.role === "SUPER_USER" ? (
              <Button onClick={() => setCreateOpen(true)}>Create Task</Button>
            ) : null}
          </div>
        </section>

        <div className={`grid gap-4 ${currentUser.role === "SUPER_USER" ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
          <div className="rounded-2xl border border-[#dce3ed] bg-white px-5 py-4"><p className="text-sm text-slate-500">Open</p><p className="mt-2 text-3xl font-semibold text-slate-950">{summary.open}</p></div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4"><p className="text-sm text-rose-700">Overdue</p><p className="mt-2 text-3xl font-semibold text-rose-700">{summary.overdue}</p></div>
          <div className="rounded-2xl border border-[#dce3ed] bg-white px-5 py-4"><p className="text-sm text-slate-500">{currentUser.role === "SUPER_USER" ? "Urgent" : "Due today"}</p><p className="mt-2 text-3xl font-semibold text-slate-950">{currentUser.role === "SUPER_USER" ? summary.urgent : summary.dueToday}</p></div>
          {currentUser.role === "SUPER_USER" ? (
            <div className="rounded-2xl border border-[#dce3ed] bg-white px-5 py-4"><p className="text-sm text-slate-500">Unassigned</p><p className="mt-2 text-3xl font-semibold text-slate-950">{summary.unassigned}</p></div>
          ) : null}
        </div>

        <TaskFilters
          role={currentUser.role}
          filters={filters}
          users={users}
          onChange={(next) => {
            setFilters(next)
            void loadTasks(next)
          }}
        />

          <TaskList
          tasks={tasks}
          currentUser={currentUser}
          users={users}
          role={currentUser.role}
          onRefresh={async () => {
            await loadTasks()
          }}
          onEdit={currentUser.role === "SUPER_USER" ? (task) => setEditingTask(task) : undefined}
        />
      </div>

      {currentUser.role === "SUPER_USER" ? (
        <>
          <TaskForm
            open={createOpen}
            onOpenChange={setCreateOpen}
            users={users}
            products={products}
            onSubmit={async (payload) => {
              await fetch("/api/admin/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              })
              await loadTasks()
            }}
          />
          <TaskForm
            open={Boolean(editingTask)}
            onOpenChange={(open) => {
              if (!open) setEditingTask(null)
            }}
            users={users}
            products={products}
            initialTask={editingTask}
            onSubmit={async (payload) => {
              if (!editingTask) return
              await fetch(`/api/admin/tasks/${editingTask.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              })
              setEditingTask(null)
              await loadTasks()
            }}
          />
        </>
      ) : null}
    </div>
  )
}
