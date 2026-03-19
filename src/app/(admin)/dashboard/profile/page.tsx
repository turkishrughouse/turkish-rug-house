import { redirect } from "next/navigation"

export default async function AdminProfilePage() {
  redirect("/dashboard/settings")
}
