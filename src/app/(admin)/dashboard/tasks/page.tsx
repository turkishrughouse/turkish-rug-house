import { redirect } from "next/navigation"
import { requireAdminSection } from "@/lib/admin-guard"
import { getSessionUser } from "@/lib/auth-server"
import { getTaskBoardBootstrap } from "@/lib/actions/task-actions"
import { TasksPageClient } from "@/components/admin/tasks/tasks-page-client"

export default async function TasksPage() {
  await requireAdminSection("tasks")
  const user = await getSessionUser("admin")
  if (!user) {
    redirect("/rughouse/login")
  }

  const data = await getTaskBoardBootstrap(user, {
    scope: user.role === "SUPER_USER" ? "all" : "open",
  })

  return (
    <TasksPageClient
      currentUser={user}
      initialTasks={data.tasks}
      initialSummary={data.summary}
      initialUsers={data.users}
      initialProducts={data.products}
      initialCategories={data.categories}
    />
  )
}
