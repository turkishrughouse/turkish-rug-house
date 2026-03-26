"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { TaskBoardSummary } from "@/components/admin/tasks/task-board-summary"
import { TaskBoardFilters } from "@/components/admin/tasks/task-board-filters"
import { TaskBoard } from "@/components/admin/tasks/task-board"
import { TaskDetailDrawer } from "@/components/admin/tasks/task-detail-drawer"
import { TaskForm } from "@/components/admin/tasks/task-form"
import type {
  TaskCategoryOption,
  TaskFilterState,
  TaskProductOption,
  TaskRecord,
  TaskSummary,
  TaskUserPreview,
} from "@/components/admin/tasks/task-board-types"
import type { TaskStatus, TaskSummaryFilterKey } from "@/lib/tasks"

function buildFiltersWithSummary(filters: TaskFilterState, summaryKey: TaskSummaryFilterKey | null): TaskFilterState {
  if (!summaryKey) return filters
  if (summaryKey === "BACKLOG") return { ...filters, status: "BACKLOG", scope: "open", overdue: false, dueToday: false }
  if (summaryKey === "IN_PROGRESS") return { ...filters, status: "IN_PROGRESS", scope: "open", overdue: false, dueToday: false }
  if (summaryKey === "PAUSED") return { ...filters, status: "PAUSED", scope: "open", overdue: false, dueToday: false }
  if (summaryKey === "COMPLETED_TODAY") return { ...filters, status: "COMPLETED", scope: "completed", overdue: false, dueToday: true }
  if (summaryKey === "UNASSIGNED") return { ...filters, assignedToId: "", status: "", priority: "", scope: "open", overdue: false, dueToday: false }
  return { ...filters, priority: "", status: "", scope: "open", overdue: false, dueToday: false }
}

export function TasksPageClient({
  currentUser,
  initialTasks,
  initialSummary,
  initialUsers,
  initialProducts,
  initialCategories,
}: {
  currentUser: { id: string; role: string }
  initialTasks: TaskRecord[]
  initialSummary: TaskSummary
  initialUsers: TaskUserPreview[]
  initialProducts: TaskProductOption[]
  initialCategories: TaskCategoryOption[]
}) {
  const [tasks, setTasks] = useState(initialTasks)
  const [summary, setSummary] = useState(initialSummary)
  const [users] = useState(initialUsers)
  const [products] = useState(initialProducts)
  const [categories] = useState(initialCategories)
  const [filters, setFilters] = useState<TaskFilterState>({
    search: "",
    status: "",
    priority: "",
    assignedToId: "",
    relatedCategoryId: "",
    overdue: false,
    dueToday: false,
    scope: currentUser.role === "SUPER_USER" ? "all" : "open",
  })
  const [activeSummaryKey, setActiveSummaryKey] = useState<TaskSummaryFilterKey | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskRecord | null>(null)
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(initialTasks[0] || null)

  const loadBoard = async (nextFilters = filters, summaryKey = activeSummaryKey) => {
    const params = new URLSearchParams()
    if (nextFilters.search) params.set("search", nextFilters.search)
    if (nextFilters.status) params.set("status", nextFilters.status)
    if (nextFilters.priority) params.set("priority", nextFilters.priority)
    if (nextFilters.relatedCategoryId) params.set("relatedCategoryId", nextFilters.relatedCategoryId)
    if (currentUser.role === "SUPER_USER" && nextFilters.assignedToId) params.set("assignedToId", nextFilters.assignedToId)
    if (summaryKey === "UNASSIGNED") params.set("unassigned", "true")
    if (summaryKey === "HIGH_PRIORITY") params.set("highPriority", "true")
    if (nextFilters.overdue) params.set("overdue", "true")
    if (nextFilters.dueToday) params.set("dueToday", "true")
    if (nextFilters.scope) params.set("scope", nextFilters.scope)
    const res = await fetch(`/api/admin/tasks?${params.toString()}`, { cache: "no-store" })
    const json = await res.json()
    setTasks(json.tasks || [])
    setSummary(json.summary || initialSummary)
    setSelectedTask((prev) => (json.tasks || []).find((task: TaskRecord) => task.id === prev?.id) || null)
  }

  const applyPatch = async (taskId: string, payload: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({ error: "Failed to update task" }))
      throw new Error(json.error || "Failed to update task")
    }
  }

  const handleStatusChange = async (task: TaskRecord, nextStatus: TaskStatus) => {
    const previousTasks = tasks
    setTasks((prev) => prev.map((entry) => (
      entry.id === task.id
        ? {
            ...entry,
            status: nextStatus,
            pausedAt: nextStatus === "PAUSED" ? new Date().toISOString() : entry.pausedAt,
            completedAt: nextStatus === "COMPLETED" ? new Date().toISOString() : entry.completedAt,
          }
        : entry
    )))
    try {
      await applyPatch(task.id, { status: nextStatus })
      await loadBoard()
    } catch (error) {
      setTasks(previousTasks)
      console.error(error)
    }
  }

  const boardEmptyState = useMemo(() => {
    if (tasks.length > 0) return null
    return currentUser.role === "SUPER_USER"
      ? "No operational tasks match the current filters."
      : "No tasks are assigned to you for the current filters."
  }, [currentUser.role, tasks.length])

  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-6 py-8">
        <section className="rounded-[32px] border border-[#dce3ed] bg-white px-8 py-8 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Upload Operations Board</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
                {currentUser.role === "SUPER_USER" ? "Assign and move upload work across the team." : "Operate your assigned upload workflow clearly and fast."}
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Category-based execution board for rug uploads, metadata completion, and catalog progress tracking.
              </p>
            </div>
            {currentUser.role === "SUPER_USER" ? (
              <Button className="h-11 px-5" onClick={() => setCreateOpen(true)}>Create Task</Button>
            ) : null}
          </div>
        </section>

        <TaskBoardSummary
          summary={summary}
          activeKey={activeSummaryKey}
          onSelect={(key) => {
            setActiveSummaryKey(key)
            const next = buildFiltersWithSummary({
              ...filters,
              status: "",
              priority: "",
              overdue: false,
              dueToday: false,
            }, key)
            setFilters(next)
            void loadBoard(next, key)
          }}
        />

        <TaskBoardFilters
          currentUserRole={currentUser.role}
          filters={filters}
          users={users}
          categories={categories}
          onChange={(next) => {
            setFilters(next)
            setActiveSummaryKey(null)
            void loadBoard(next)
          }}
        />

        {boardEmptyState ? (
          <div className="rounded-[28px] border border-[#dce3ed] bg-white px-6 py-20 text-center text-slate-500 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
            {boardEmptyState}
          </div>
        ) : (
          <TaskBoard
            tasks={tasks}
            onOpen={(task) => setSelectedTask(task)}
            onStatusChange={(task, nextStatus) => {
              void handleStatusChange(task, nextStatus)
            }}
          />
        )}
      </div>

      <TaskDetailDrawer
        task={selectedTask}
        open={Boolean(selectedTask)}
        canManage={currentUser.role === "SUPER_USER"}
        onClose={() => setSelectedTask(null)}
        onEdit={(task) => setEditingTask(task)}
        onStatusChange={(task, nextStatus) => { void handleStatusChange(task, nextStatus) }}
        onArchive={async (task) => {
          await applyPatch(task.id, { archived: true })
          setSelectedTask(null)
          await loadBoard()
        }}
        onDelete={async (task) => {
          await fetch(`/api/admin/tasks/${task.id}`, { method: "DELETE" })
          setSelectedTask(null)
          await loadBoard()
        }}
      />

      {currentUser.role === "SUPER_USER" ? (
        <>
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
              await loadBoard()
            }}
          />
          <TaskForm
            open={Boolean(editingTask)}
            onOpenChange={(open) => {
              if (!open) setEditingTask(null)
            }}
            users={users}
            products={products}
            categories={categories}
            initialTask={editingTask}
            onSubmit={async (payload) => {
              if (!editingTask) return
              await applyPatch(editingTask.id, payload)
              setEditingTask(null)
              await loadBoard()
            }}
          />
        </>
      ) : null}
    </div>
  )
}
