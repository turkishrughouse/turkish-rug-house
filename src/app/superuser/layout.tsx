import { ReactNode } from "react"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth-server"
import AdminLayout from "@/app/(admin)/layout"

export default async function SuperuserLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser("admin")
  if (!user) {
    redirect("/rughouse/login")
  }
  if (user.role !== "SUPER_USER") {
    // Non-superuser accounts should never see this shell.
    redirect("/dashboard")
  }
  return <AdminLayout>{children}</AdminLayout>
}

