"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogOut, UserCog } from "lucide-react"
import { toast } from "sonner"

type AdminProfileMenuProps = {
  name: string | null
  email: string
  avatarUrl?: string | null
  showName?: boolean
  hoverOpenDelayMs?: number
  side?: "top" | "right" | "bottom" | "left"
  triggerClassName?: string
  children?: ReactNode
}

export function AdminProfileMenu({
  name,
  email,
  avatarUrl,
  showName = true,
  hoverOpenDelayMs = 0,
  side = "bottom",
  triggerClassName,
  children,
}: AdminProfileMenuProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const openTimerRef = useRef<number | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  const initials = (name || email)
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

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

  useEffect(() => {
    return () => {
      if (openTimerRef.current) window.clearTimeout(openTimerRef.current)
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current)
    }
  }, [])

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  const scheduleOpen = () => {
    if (hoverOpenDelayMs <= 0) return
    clearCloseTimer()
    if (open) return
    if (openTimerRef.current) window.clearTimeout(openTimerRef.current)
    openTimerRef.current = window.setTimeout(() => {
      setOpen(true)
      openTimerRef.current = null
    }, hoverOpenDelayMs)
  }

  const scheduleClose = () => {
    if (hoverOpenDelayMs <= 0) return
    if (openTimerRef.current) {
      window.clearTimeout(openTimerRef.current)
      openTimerRef.current = null
    }
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false)
      closeTimerRef.current = null
    }, 120)
  }

  return (
    <DropdownMenu open={hoverOpenDelayMs > 0 ? open : undefined} onOpenChange={hoverOpenDelayMs > 0 ? undefined : setOpen} modal={hoverOpenDelayMs > 0 ? false : undefined}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={triggerClassName || "admin-header-action inline-flex items-center gap-2 rounded-md px-1.5 py-1"}
          aria-label="Open profile menu"
          onMouseEnter={scheduleOpen}
          onMouseLeave={scheduleClose}
        >
          {children ? (
            children
          ) : (
            <>
              <Avatar className="h-8 w-8 cursor-pointer">
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback>{initials || "AD"}</AvatarFallback>
              </Avatar>
              {showName ? (
                <div className="hidden text-right lg:block">
                  <span className="text-sm font-medium leading-none">{name || "Admin User"}</span>
                </div>
              ) : null}
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={side}
        align="end"
        className="w-52"
        onMouseEnter={clearCloseTimer}
        onMouseLeave={scheduleClose}
        onPointerDownOutside={hoverOpenDelayMs > 0 ? () => setOpen(false) : undefined}
        onEscapeKeyDown={hoverOpenDelayMs > 0 ? () => setOpen(false) : undefined}
      >
        <DropdownMenuLabel className="space-y-0.5">
          <p className="text-sm font-medium text-slate-900">{name || "Admin User"}</p>
          <p className="text-xs font-normal text-slate-500">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings" className="cursor-pointer">
            <UserCog className="mr-2 h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={logout} className="cursor-pointer text-red-600 focus:text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
