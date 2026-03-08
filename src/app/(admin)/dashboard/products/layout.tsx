import { requireAdminRoles } from "@/lib/admin-guard"

export default async function ProductsLayout({ children }: { children: React.ReactNode }) {
  await requireAdminRoles(["SUPER_USER", "ADMIN", "EDITOR"])
  return children
}
