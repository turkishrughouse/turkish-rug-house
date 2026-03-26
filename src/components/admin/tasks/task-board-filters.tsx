"use client"

import type { TaskFilterState, TaskCategoryOption, TaskUserPreview } from "@/components/admin/tasks/task-board-types"
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/tasks"

export function TaskBoardFilters({
  currentUserRole,
  filters,
  users,
  categories,
  onChange,
}: {
  currentUserRole: string
  filters: TaskFilterState
  users: TaskUserPreview[]
  categories: TaskCategoryOption[]
  onChange: (next: TaskFilterState) => void
}) {
  return (
    <section className="rounded-[28px] border border-[#dce3ed] bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
      <div className="grid gap-3 xl:grid-cols-[1.6fr_repeat(4,minmax(0,1fr))]">
        <input
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          placeholder="Search tasks, category, product, assignee..."
          className="h-11 rounded-xl border border-[#dce3ed] px-4 text-sm text-slate-900 outline-none transition focus:border-slate-900"
        />
        {currentUserRole === "SUPER_USER" ? (
          <select
            value={filters.assignedToId}
            onChange={(event) => onChange({ ...filters, assignedToId: event.target.value })}
            className="h-11 rounded-xl border border-[#dce3ed] px-3 text-sm"
          >
            <option value="">All assignees</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name || user.email}
              </option>
            ))}
          </select>
        ) : (
          <div className="h-11 rounded-xl border border-[#e9eef6] bg-slate-50 px-3 text-sm text-slate-500 flex items-center">
            Assigned to you
          </div>
        )}
        <select
          value={filters.relatedCategoryId}
          onChange={(event) => onChange({ ...filters, relatedCategoryId: event.target.value })}
          className="h-11 rounded-xl border border-[#dce3ed] px-3 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.title}
            </option>
          ))}
        </select>
        <select
          value={filters.priority}
          onChange={(event) => onChange({ ...filters, priority: event.target.value })}
          className="h-11 rounded-xl border border-[#dce3ed] px-3 text-sm"
        >
          <option value="">All priorities</option>
          {TASK_PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={(event) => onChange({ ...filters, status: event.target.value })}
          className="h-11 rounded-xl border border-[#dce3ed] px-3 text-sm"
        >
          <option value="">All statuses</option>
          {TASK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <select
          value={filters.scope}
          onChange={(event) => onChange({ ...filters, scope: event.target.value as TaskFilterState["scope"] })}
          className="h-11 rounded-xl border border-[#dce3ed] px-3 text-sm"
        >
          <option value="all">All scope</option>
          <option value="open">Open only</option>
          <option value="completed">Completed only</option>
        </select>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <label className="inline-flex items-center gap-2 text-slate-600">
          <input
            type="checkbox"
            checked={filters.overdue}
            onChange={(event) => onChange({ ...filters, overdue: event.target.checked })}
            className="h-4 w-4 rounded border-slate-300"
          />
          Overdue only
        </label>
        <label className="inline-flex items-center gap-2 text-slate-600">
          <input
            type="checkbox"
            checked={filters.dueToday}
            onChange={(event) => onChange({ ...filters, dueToday: event.target.checked })}
            className="h-4 w-4 rounded border-slate-300"
          />
          Due today
        </label>
      </div>
    </section>
  )
}
