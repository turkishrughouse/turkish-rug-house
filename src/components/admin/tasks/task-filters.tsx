"use client"

import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/tasks"

type AssignableUser = {
  id: string
  name: string | null
  email: string
  role: string
}

export type TaskFilterState = {
  status: string
  priority: string
  assignedToId: string
  overdue: boolean
  dueToday: boolean
  scope: "open" | "completed" | "all"
}

export function TaskFilters({
  role,
  filters,
  users,
  onChange,
}: {
  role: string
  filters: TaskFilterState
  users: AssignableUser[]
  onChange: (next: TaskFilterState) => void
}) {
  return (
    <div className="rounded-2xl border border-[#dce3ed] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <select value={filters.scope} onChange={(event) => onChange({ ...filters, scope: event.target.value as TaskFilterState["scope"] })} className="h-10 rounded-md border border-[#dce3ed] px-3 text-sm">
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="completed">Completed</option>
        </select>
        <select value={filters.status} onChange={(event) => onChange({ ...filters, status: event.target.value })} className="h-10 rounded-md border border-[#dce3ed] px-3 text-sm">
          <option value="">All statuses</option>
          {TASK_STATUSES.map((status) => (
            <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
          ))}
        </select>
        <select value={filters.priority} onChange={(event) => onChange({ ...filters, priority: event.target.value })} className="h-10 rounded-md border border-[#dce3ed] px-3 text-sm">
          <option value="">All priorities</option>
          {TASK_PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>{priority}</option>
          ))}
        </select>
        {role === "SUPER_USER" ? (
          <select value={filters.assignedToId} onChange={(event) => onChange({ ...filters, assignedToId: event.target.value })} className="h-10 rounded-md border border-[#dce3ed] px-3 text-sm">
            <option value="">All assignees</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>{user.name || user.email}</option>
            ))}
          </select>
        ) : <div />}
        <label className="flex items-center gap-2 rounded-md border border-[#dce3ed] px-3 text-sm text-slate-700">
          <input type="checkbox" checked={filters.overdue} onChange={(event) => onChange({ ...filters, overdue: event.target.checked })} />
          Overdue
        </label>
        <label className="flex items-center gap-2 rounded-md border border-[#dce3ed] px-3 text-sm text-slate-700">
          <input type="checkbox" checked={filters.dueToday} onChange={(event) => onChange({ ...filters, dueToday: event.target.checked })} />
          Due today
        </label>
      </div>
    </div>
  )
}
