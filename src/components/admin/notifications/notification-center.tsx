"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Bell, MessageSquare, ShoppingCart, FileText, Package, CheckCheck } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import type { AdminLanguage } from "@/lib/admin/i18n"

type NotificationItem = {
  id: string
  type: "SALE" | "MESSAGE" | "UPDATE"
  title: string
  description: string
  href: string
  createdAt: string
}

type NotificationsResponse = {
  items: NotificationItem[]
  meta: {
    unreadMessages: number
    openOrders: number
    openOrderIds?: string[]
    generatedAt: string
  }
}

const LAST_SEEN_KEY = "rughouse_admin_notifications_seen_at"
const LAST_SALE_ALERT_KEY = "rughouse_admin_last_sale_alert_id"
const NOTIFICATION_POLL_MS = 3000

function formatTimeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return "just now"
  if (min < 60) return `${min}m ago`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour}h ago`
  const day = Math.floor(hour / 24)
  return `${day}d ago`
}

function NotificationTypeIcon({ type }: { type: NotificationItem["type"] }) {
  if (type === "SALE") return <ShoppingCart className="h-4 w-4 text-emerald-600" />
  if (type === "MESSAGE") return <MessageSquare className="h-4 w-4 text-blue-600" />
  return <FileText className="h-4 w-4 text-slate-600" />
}

type NotificationCenterProps = {
  lang?: AdminLanguage
}

export function NotificationCenter({ lang = "en" }: NotificationCenterProps) {
  const [data, setData] = useState<NotificationsResponse | null>(null)
  const [open, setOpen] = useState(false)
  const [lastSeen, setLastSeen] = useState<string>(() => {
    if (typeof window === "undefined") return ""
    return localStorage.getItem(LAST_SEEN_KEY) || ""
  })
  const [lastSaleAlertId, setLastSaleAlertId] = useState<string>(() => {
    if (typeof window === "undefined") return ""
    return localStorage.getItem(LAST_SALE_ALERT_KEY) || ""
  })
  const audioContextRef = useRef<AudioContext | null>(null)
  const orderAudioRef = useRef<HTMLAudioElement | null>(null)
  const isTr = lang === "tr"
  const tx = (en: string, tr: string) => (isTr ? tr : en)

  const ensureAudioContext = useCallback(() => {
    if (typeof window === "undefined") return null
    if (audioContextRef.current) return audioContextRef.current
    const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return null
    audioContextRef.current = new Ctx()
    return audioContextRef.current
  }, [])

  const playOrderBell = useCallback(async () => {
    const customAudio = orderAudioRef.current
    if (customAudio) {
      try {
        customAudio.currentTime = 0
        await customAudio.play()
        return
      } catch {
        // Fall back to generated chime when custom audio is missing or blocked.
      }
    }

    const ctx = ensureAudioContext()
    if (!ctx) return
    if (ctx.state === "suspended") {
      try {
        await ctx.resume()
      } catch {
        return
      }
    }

    const chime = (start: number, baseFrequency: number, duration: number, volume: number) => {
      const partials = [
        { type: "triangle" as const, ratio: 1, gain: 1 },
        { type: "sine" as const, ratio: 2, gain: 0.45 },
        { type: "sine" as const, ratio: 3.2, gain: 0.25 },
      ]

      for (const partial of partials) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = partial.type
        osc.frequency.setValueAtTime(baseFrequency * partial.ratio, start)
        osc.frequency.exponentialRampToValueAtTime(baseFrequency * partial.ratio * 0.985, start + duration)
        gain.gain.setValueAtTime(0.0001, start)
        gain.gain.exponentialRampToValueAtTime(volume * partial.gain, start + 0.008)
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(start)
        osc.stop(start + duration + 0.02)
      }
    }

    const now = ctx.currentTime
    chime(now, 900, 0.14, 0.07)
    chime(now + 0.12, 1320, 0.2, 0.08)
    chime(now + 0.3, 1760, 0.16, 0.045)
  }, [ensureAudioContext])

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notifications", { cache: "no-store" })
      if (!res.ok) return
      const json = (await res.json()) as NotificationsResponse
      setData(json)

       const latestSale = json.items.find((item) => item.type === "SALE")
       if (latestSale) {
         if (!lastSaleAlertId) {
           localStorage.setItem(LAST_SALE_ALERT_KEY, latestSale.id)
           setLastSaleAlertId(latestSale.id)
         } else if (latestSale.id !== lastSaleAlertId) {
           toast.success(latestSale.title, { description: latestSale.description })
           void playOrderBell()
           localStorage.setItem(LAST_SALE_ALERT_KEY, latestSale.id)
           setLastSaleAlertId(latestSale.id)
         }
       }
    } catch {
      // ignore header-level fetch errors
    }
  }, [lastSaleAlertId, playOrderBell])

  useEffect(() => {
    if (typeof window === "undefined") return
    const audio = new Audio("/sounds/shopify-order.mp3")
    audio.preload = "auto"
    audio.volume = 0.9
    orderAudioRef.current = audio
    return () => {
      orderAudioRef.current = null
    }
  }, [])

  useEffect(() => {
    const unlock = () => {
      const ctx = ensureAudioContext()
      if (!ctx) return
      void ctx.resume()
      window.removeEventListener("pointerdown", unlock)
      window.removeEventListener("keydown", unlock)
    }
    window.addEventListener("pointerdown", unlock)
    window.addEventListener("keydown", unlock)
    return () => {
      window.removeEventListener("pointerdown", unlock)
      window.removeEventListener("keydown", unlock)
    }
  }, [ensureAudioContext])

  useEffect(() => {
    const initialId = window.setTimeout(() => {
      void fetchNotifications()
    }, 0)
    const handleRefresh = () => {
      void fetchNotifications()
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchNotifications()
      }
    }

    window.addEventListener("admin-messages-updated", handleRefresh as EventListener)
    window.addEventListener("admin-orders-updated", handleRefresh as EventListener)
    window.addEventListener("focus", handleRefresh)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    const intervalId = window.setInterval(() => {
      void fetchNotifications()
    }, NOTIFICATION_POLL_MS)
    return () => {
      window.clearTimeout(initialId)
      window.clearInterval(intervalId)
      window.removeEventListener("admin-messages-updated", handleRefresh as EventListener)
      window.removeEventListener("admin-orders-updated", handleRefresh as EventListener)
      window.removeEventListener("focus", handleRefresh)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [fetchNotifications])

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") return

    const stream = new EventSource("/api/admin/messages/stream")
    stream.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { type?: string }
        if (payload.type !== "new_message") return
        window.dispatchEvent(new Event("admin-messages-updated"))
        window.dispatchEvent(new Event("admin-notifications-updated"))
        void fetchNotifications()
      } catch {
        // ignore malformed sse payloads
      }
    }

    return () => {
      stream.close()
    }
  }, [fetchNotifications])

  const markAllRead = () => {
    const now = new Date().toISOString()
    localStorage.setItem(LAST_SEEN_KEY, now)
    setLastSeen(now)
  }

  const items = useMemo(() => data?.items ?? [], [data])
  const unreadCount = useMemo(() => {
    if (!lastSeen) return items.length
    return items.filter((item) => new Date(item.createdAt).getTime() > new Date(lastSeen).getTime()).length
  }, [items, lastSeen])

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (nextOpen) markAllRead()
        }}
      >
        <DropdownMenuTrigger asChild>
          <button className="admin-header-action relative rounded-full p-2 transition-colors" aria-label={tx("Notifications", "Bildirimler")}>
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full border-2 border-card" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[380px] p-0 bg-white border-[#dce3ed]">
          <div className="flex items-center justify-between px-4 py-3">
            <DropdownMenuLabel className="p-0 text-slate-900">{tx("Notifications", "Bildirimler")}</DropdownMenuLabel>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
              onClick={markAllRead}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {tx("Mark all read", "Tümünü okundu yap")}
            </button>
          </div>
          <DropdownMenuSeparator />

          <div className="max-h-[420px] overflow-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-sm text-slate-500 text-center">{tx("No notifications yet.", "Henüz bildirim yok.")}</div>
            ) : (
              items.map((item) => {
                const isUnread = !lastSeen || new Date(item.createdAt).getTime() > new Date(lastSeen).getTime()
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`flex gap-3 px-4 py-3 border-b border-[#eef2f7] hover:bg-slate-50 ${isUnread ? "bg-blue-50/40" : "bg-white"
                      }`}
                  >
                    <div className="pt-0.5">
                      <NotificationTypeIcon type={item.type} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900 truncate">{item.title}</p>
                        <span className="text-[11px] text-slate-500 shrink-0">{formatTimeAgo(item.createdAt)}</span>
                      </div>
                      <p className="text-xs text-slate-600 truncate">{item.description}</p>
                    </div>
                  </Link>
                )
              })
            )}
          </div>

          <div className="p-3 border-t border-[#eef2f7] bg-slate-50">
            <div className="grid grid-cols-1 gap-2">
              <Link href="/dashboard/orders" className="rounded-md border border-[#dce3ed] bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" />
                {tx("Orders", "Siparişler")}
              </Link>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
