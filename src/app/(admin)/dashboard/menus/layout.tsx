import { requireAdminRoles } from "@/lib/admin-guard"

export default async function MenusLayout({ children }: { children: React.ReactNode }) {
  await requireAdminRoles(["SUPER_USER"])
  return children
}
