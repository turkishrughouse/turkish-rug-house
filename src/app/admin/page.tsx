import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth-server"

export default async function AdminRootPage() {
  const user = await getSessionUser("admin")
  if (!user) {
    redirect("/rughouse/login")
  }
  if (user.role === "SUPER_USER") {
    redirect("/superuser")
  }
  redirect("/dashboard")
}

