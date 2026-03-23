import { redirect } from "next/navigation"
import { requireAdminSection } from "@/lib/admin-guard"
import { getSessionUser } from "@/lib/auth-server"
import { getAssignableTaskUsers, getTaskDashboardSummary, getTaskProductOptions, getTasksForViewer } from "@/lib/actions/task-actions"
import { TasksPageClient } from "@/components/admin/tasks/tasks-page-client"

export default async function TasksPage() {
  await requireAdminSection("tasks")
  const user = await getSessionUser("admin")
  if (!user) {
    redirect("/rughouse/login")
  }

  const [tasks, summary, users, products] = await Promise.all([
    getTasksForViewer(user, { scope: "all" }),
    getTaskDashboardSummary(user),
    user.role === "SUPER_USER" ? getAssignableTaskUsers() : Promise.resolve([]),
    user.role === "SUPER_USER" ? getTaskProductOptions() : Promise.resolve([]),
  ])

  return <TasksPageClient currentUser={user} initialTasks={tasks} initialSummary={summary} initialUsers={users} initialProducts={products} />
}
