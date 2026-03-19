
import { toast } from "sonner"

export type MenuItemFlat = {
    id: string
    parentId: string | null
    type: string
    label: string
    url?: string
    referenceId?: string
    depth: number
    index: number
    originalLabel?: string
    _missing?: boolean
}

export type Menu = {
    id: string
    title: string
    slug: string
    location: string | null
    items: MenuItemFlat[]
}

function isAbortError(error: unknown) {
    return error instanceof DOMException && error.name === "AbortError"
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit & { timeoutMs?: number }) {
    const controller = new AbortController()
    const timeoutMs = init?.timeoutMs ?? 8000
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    try {
        const { timeoutMs: _timeoutMs, ...rest } = init || {}
        return await fetch(input, { ...rest, signal: controller.signal })
    } finally {
        clearTimeout(timeoutId)
    }
}

export const menuService = {
    list: async (): Promise<Menu[]> => {
        try {
            const res = await fetchWithTimeout("/api/admin/menus", { cache: "no-store", timeoutMs: 10000 })
            if (!res.ok) {
                toast.error("Failed to load menus")
                return []
            }
            const data = await res.json()
            if (!Array.isArray(data)) return []
            return data
        } catch (error) {
            if (!isAbortError(error)) {
                console.error("menuService.list error:", error)
                toast.error("Network error fetching menus")
            }
            return []
        }
    },

    get: async (id: string): Promise<Menu | null> => {
        try {
            const res = await fetchWithTimeout(`/api/admin/menus/${id}`, { cache: "no-store", timeoutMs: 10000 })
            if (!res.ok) {
                toast.error("Failed to load menu details")
                return null
            }
            return await res.json()
        } catch (error) {
            if (!isAbortError(error)) {
                console.error(error)
                toast.error("Failed to load menu details")
            }
            return null
        }
    },

    create: async (payload: { name: string, location: string }): Promise<Menu | null> => {
        const url = "/api/admin/menus"

        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })

            if (!res.ok) {
                const text = await res.text()
                console.error(`[AdminMenuService] Creation failed. Status: ${res.status}, Response: ${text}`)

                try {
                    const errorJson = JSON.parse(text)
                    toast.error(errorJson.error || `Error ${res.status}: Failed to create menu`)
                } catch {
                    toast.error(`Error ${res.status}: ${text.slice(0, 50)}`)
                }
                // Return null to indicate failure to the UI
                return null
            }

            const data = await res.json()
            toast.success("Menu created successfully")
            return data
        } catch (error) {
            console.error("[AdminMenuService] Network or logic error:", error)
            toast.error("Network error while creating menu")
            return null
        }
    },

    update: async (id: string, payload: { title: string, slug: string, location?: string | null, items: MenuItemFlat[] }): Promise<boolean> => {
        try {
            const res = await fetch(`/api/admin/menus/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })

            if (res.ok) {
                return true
            } else {
                const err = await res.json()
                toast.error(err.error || "Failed to save menu")
                return false
            }
        } catch (error) {
            console.error(error)
            toast.error("Error saving menu")
            return false
        }
    },

    delete: async (id: string): Promise<boolean> => {
        try {
            const res = await fetch(`/api/admin/menus/${id}`, { method: "DELETE" })
            if (res.ok) return true
            toast.error("Failed to delete menu")
            return false
        } catch (error) {
            console.error(error)
            toast.error("Error deleting menu")
            return false
        }
    }
}
