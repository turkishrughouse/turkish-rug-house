"use client"

import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

export function LogoutButton() {
  const router = useRouter()
  const logout = async () => {
    try {
      await fetch("/api/auth/logout?portal=admin", { method: "POST" })
      toast.success("Logged out")
      router.push("/rughouse/login")
      router.refresh()
    } catch {
      toast.error("Logout failed")
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={logout}>
      <LogOut className="h-4 w-4 mr-2" />
      Logout
    </Button>
  )
}
