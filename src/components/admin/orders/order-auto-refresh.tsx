"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export function OrderAutoRefresh({ intervalMs = 15000 }: { intervalMs?: number }) {
  const router = useRouter()

  useEffect(() => {
    const refresh = () => router.refresh()
    const timer = window.setInterval(refresh, intervalMs)
    window.addEventListener("focus", refresh)
    window.addEventListener("admin-orders-updated", refresh as EventListener)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", refresh)
      window.removeEventListener("admin-orders-updated", refresh as EventListener)
    }
  }, [intervalMs, router])

  return null
}
