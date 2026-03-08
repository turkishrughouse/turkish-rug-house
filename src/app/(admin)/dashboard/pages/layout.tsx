import { requireAdminRoles } from "@/lib/admin-guard"

export default async function PagesLayout({ children }: { children: React.ReactNode }) {
  await requireAdminRoles(["SUPER_USER", "ADMIN"])
  return children
}
