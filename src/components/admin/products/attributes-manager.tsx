"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type AttributeOption = {
  id: string
  name: string
  slug: string
  hex?: string | null
}

type AttributeGroup = {
  id: string
  key: string
  name: string
  slug?: string
  kind: "fixed" | "custom"
  options: AttributeOption[]
}

type FormState = {
  name: string
  slug: string
  hex: string
}

const EMPTY_FORM: FormState = { name: "", slug: "", hex: "" }

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

export function AttributesManager() {
  const [groups, setGroups] = useState<AttributeGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [forms, setForms] = useState<Record<string, FormState>>({})
  const [newGroup, setNewGroup] = useState({ name: "", slug: "" })

  const fixedKeys = useMemo(() => new Set(["types", "styles", "colors", "sizes", "ages", "materials"]), [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/attributes", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load attributes")
      const json = await res.json()
      setGroups((json?.groups || []) as AttributeGroup[])
    } catch (error) {
      console.error(error)
      toast.error("Failed to load attributes")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const setForm = (groupKey: string, next: Partial<FormState>) => {
    setForms((prev) => ({
      ...prev,
      [groupKey]: { ...(prev[groupKey] || EMPTY_FORM), ...next },
    }))
  }

  const getForm = (groupKey: string) => forms[groupKey] || EMPTY_FORM

  const addOption = async (group: AttributeGroup) => {
    const form = getForm(group.key)
    const name = form.name.trim()
    const slug = (form.slug || slugify(name)).trim()
    const hex = form.hex.trim()

    if (!name) {
      toast.error("Option name is required")
      return
    }

    setSaving(true)
    try {
      const payload = fixedKeys.has(group.key)
        ? {
            action: "create_fixed_option",
            group: group.key,
            name,
            slug,
            hex: group.key === "colors" ? hex || null : undefined,
          }
        : {
            action: "create_custom_option",
            groupId: group.id,
            name,
            slug,
          }

      const res = await fetch("/api/admin/attributes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Failed to add option")

      setForm(group.key, EMPTY_FORM)
      toast.success("Option added")
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add option")
    } finally {
      setSaving(false)
    }
  }

  const removeOption = async (group: AttributeGroup, optionId: string) => {
    setSaving(true)
    try {
      const payload = fixedKeys.has(group.key)
        ? { action: "delete_fixed_option", group: group.key, optionId }
        : { action: "delete_custom_option", groupId: group.id, optionId }

      const res = await fetch("/api/admin/attributes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Failed to delete option")
      const currentScrollY = typeof window !== "undefined" ? window.scrollY : 0
      setGroups((prev) =>
        prev.map((g) =>
          g.key === group.key
            ? { ...g, options: g.options.filter((opt) => opt.id !== optionId) }
            : g
        )
      )
      toast.success("Option deleted")
      if (typeof window !== "undefined") {
        requestAnimationFrame(() => window.scrollTo({ top: currentScrollY }))
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete option")
    } finally {
      setSaving(false)
    }
  }

  const addCustomGroup = async () => {
    const name = newGroup.name.trim()
    const slug = (newGroup.slug || slugify(name)).trim()
    if (!name) {
      toast.error("Group name is required")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/admin/attributes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_custom_group",
          name,
          slug,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Failed to create group")
      setNewGroup({ name: "", slug: "" })
      toast.success("Custom attribute group created")
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create group")
    } finally {
      setSaving(false)
    }
  }

  const removeCustomGroup = async (groupId: string) => {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/attributes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_custom_group",
          groupId,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Failed to delete group")
      toast.success("Custom group deleted")
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete group")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-[#dce3ed] bg-white p-8 text-slate-600 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading attributes...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#dce3ed] bg-white p-5">
        <h3 className="text-lg font-semibold text-slate-900">Create New Attribute Group</h3>
        <p className="text-sm text-slate-600 mt-1">Add custom groups beyond Types, Styles, Colors, Sizes, Ages, and Materials.</p>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input
            placeholder="Group name (e.g. Materials)"
            value={newGroup.name}
            onChange={(e) => setNewGroup((prev) => ({ ...prev, name: e.target.value }))}
            className="bg-white border-[#dce3ed]"
          />
          <Input
            placeholder="group-slug (optional)"
            value={newGroup.slug}
            onChange={(e) => setNewGroup((prev) => ({ ...prev, slug: e.target.value }))}
            className="bg-white border-[#dce3ed]"
          />
          <Button onClick={addCustomGroup} disabled={saving}>
            <Plus className="h-4 w-4 mr-2" /> Add Group
          </Button>
        </div>
      </div>

      {groups.map((group) => {
        const form = getForm(group.key)
        return (
          <div key={group.key} className="rounded-xl border border-[#dce3ed] bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{group.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{group.options.length} options</p>
              </div>
              {group.kind === "custom" ? (
                <Button
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => removeCustomGroup(group.id)}
                  disabled={saving}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete Group
                </Button>
              ) : null}
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input
                placeholder={`Add ${group.name} option`}
                value={form.name}
                onChange={(e) => setForm(group.key, { name: e.target.value })}
                className="bg-white border-[#dce3ed]"
              />
              <Input
                placeholder="slug (optional)"
                value={form.slug}
                onChange={(e) => setForm(group.key, { slug: e.target.value })}
                className="bg-white border-[#dce3ed]"
              />
              {group.key === "colors" ? (
                <Input
                  placeholder="#0ea5e9 (optional)"
                  value={form.hex}
                  onChange={(e) => setForm(group.key, { hex: e.target.value })}
                  className="bg-white border-[#dce3ed]"
                />
              ) : (
                <div />
              )}
            </div>

            <div className="mt-3">
              <Button onClick={() => addOption(group)} disabled={saving}>
                <Plus className="h-4 w-4 mr-2" /> Add Option
              </Button>
            </div>

            <div className="mt-4 rounded-lg border border-[#e6edf5] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Name</th>
                    <th className="text-left px-3 py-2 font-medium">Slug</th>
                    <th className="text-left px-3 py-2 font-medium">Preview</th>
                    <th className="text-right px-3 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {group.options.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-3 text-slate-500">No options yet.</td>
                    </tr>
                  ) : (
                    group.options.map((opt) => (
                      <tr key={opt.id} className="border-t border-[#eef2f8]">
                        <td className="px-3 py-2 text-slate-900">{opt.name}</td>
                        <td className="px-3 py-2 text-slate-600">{opt.slug}</td>
                        <td className="px-3 py-2">
                          {opt.hex ? (
                            <span className="inline-flex items-center gap-2">
                              <span className="h-3 w-3 rounded-full border border-slate-300" style={{ backgroundColor: opt.hex }} />
                              <span className="text-xs text-slate-500">{opt.hex}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => removeOption(group, opt.id)}
                            disabled={saving}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
