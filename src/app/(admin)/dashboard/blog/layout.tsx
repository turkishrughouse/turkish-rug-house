import { requireAdminSection } from "@/lib/admin-guard"

export default async function BlogLayout({ children }: { children: React.ReactNode }) {
  await requireAdminSection("blog")
  return children
}
