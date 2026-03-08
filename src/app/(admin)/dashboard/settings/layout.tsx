import { requireAdminRoles } from "@/lib/admin-guard"

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireAdminRoles(["SUPER_USER"])
  return children
}
