import { UserManager } from "@/components/admin/users/user-manager"

export default function UsersPage() {
  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Users</h2>
        <p className="text-slate-600">Create users and assign their roles.</p>
      </div>

      <div className="h-px bg-border-subtle" />

      <UserManager />
    </div>
  )
}
