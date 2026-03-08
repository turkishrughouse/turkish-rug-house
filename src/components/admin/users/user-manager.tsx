"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Plus, Trash2, UserCog } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type UserRow = {
  id: string
  name: string | null
  email: string
  role: string
  createdAt: string
}

const ROLE_OPTIONS = ["SUPER_USER", "ADMIN", "EDITOR"] as const

export function UserManager() {
  const searchParams = useSearchParams()
  const [users, setUsers] = useState<UserRow[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "EDITOR",
  })

  const [editingId, setEditingId] = useState<string | null>(null)

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to fetch users")
      setUsers(json.data || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch users")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    const q = (searchParams.get("q") || "").trim()
    if (q) setSearch(q)
  }, [searchParams])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return users
    return users.filter(
      (u) =>
        (u.name || "").toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        u.role.toLowerCase().includes(term)
    )
  }, [search, users])

  const resetForm = () => {
    setForm({ name: "", email: "", password: "", role: "EDITOR" })
    setEditingId(null)
  }

  const submitUser = async () => {
    if (!form.name.trim() || !form.email.trim() || (!editingId && !form.password.trim())) {
      toast.error("Name, email and password are required")
      return
    }

    setSaving(true)
    try {
      const payload: Record<string, string> = {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
      }

      if (form.password.trim()) payload.password = form.password.trim()

      const res = await fetch(editingId ? `/api/admin/users/${editingId}` : "/api/admin/users", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to save user")

      toast.success(editingId ? "User updated" : "User created")
      setDialogOpen(false)
      resetForm()
      await loadUsers()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save user")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this user?")) return
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Failed to delete user")
      toast.success("User deleted")
      await loadUsers()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete user")
    }
  }

  const openEdit = (user: UserRow) => {
    setEditingId(user.id)
    setForm({
      name: user.name || "",
      email: user.email,
      password: "",
      role: user.role,
    })
    setDialogOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-sm">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users by name, email or role..."
            className="bg-white border-[#dce3ed] text-slate-900 placeholder:text-slate-400"
          />
        </div>

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) resetForm()
          }}
        >
          <DialogTrigger asChild>
            <Button type="button">
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white border-[#dce3ed]">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit User" : "Create User"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                className="bg-white border-[#dce3ed] text-slate-900 placeholder:text-slate-400"
              />
              <Input
                placeholder="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                className="bg-white border-[#dce3ed] text-slate-900 placeholder:text-slate-400"
              />
              <Input
                placeholder={editingId ? "New password (optional)" : "Password"}
                type="password"
                value={form.password}
                onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
                className="bg-white border-[#dce3ed] text-slate-900 placeholder:text-slate-400"
              />
              <Select
                value={form.role}
                onValueChange={(value) => setForm((s) => ({ ...s, role: value }))}
              >
                <SelectTrigger className="bg-white border-[#dce3ed] text-slate-900">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button type="button" className="w-full" onClick={submitUser} disabled={saving}>
                {saving ? "Saving..." : editingId ? "Update User" : "Create User"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-[#dce3ed] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <Table>
          <TableHeader className="[&_tr]:bg-slate-50/80">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                  Loading users...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((user) => (
                <TableRow key={user.id} className="hover:bg-transparent hover:scale-[1.002] transition-transform">
                  <TableCell className="font-medium text-slate-900">{user.name || "-"}</TableCell>
                  <TableCell className="text-slate-700">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-700">
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-600 text-sm">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => openEdit(user)}>
                        <UserCog className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(user.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
