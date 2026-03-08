
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

export const menuService = {
    list: async (): Promise<Menu[]> => {
        try {
            const res = await fetch("/api/admin/menus", {
                cache: "no-store"
            })
            if (!res.ok) {
                const txt = await res.text()
                console.error(res.status, txt)
                toast.error("Failed to load menus")
                return []
            }
            const data = await res.json()
            if (!Array.isArray(data)) return []
            return data
        } catch (error) {
            console.error("menuService.list error:", error)
            toast.error("Network error fetching menus")
            return []
        }
    },

    get: async (id: string): Promise<Menu | null> => {
        try {
            const res = await fetch(`/api/admin/menus/${id}`, { cache: "no-store" })
            if (!res.ok) {
                console.error(`Failed to fetch menu ${id}: ${res.status}`)
                toast.error("Failed to load menu details")
                return null
            }
            return await res.json()
        } catch (error) {
            console.error(error)
            toast.error("Failed to load menu details")
            return null
        }
    },

    create: async (payload: { name: string, location: string }): Promise<Menu | null> => {
        const url = "/api/admin/menus"
        console.log(`[AdminMenuService] Creating menu...`, { url, payload })

        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })

            console.log(`[AdminMenuService] Response status:`, res.status)

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
            console.log(`[AdminMenuService] Menu created successfully:`, data)
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
