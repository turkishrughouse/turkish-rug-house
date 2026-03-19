"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

type OrderThreadMessage = {
  id: string
  userId?: string | null
  message: string
  type: "customer" | "system" | "tracking"
  createdAt: string
}

type OrderThreadResponse = {
  orderId: string
  orderNumber: string
  status: string
  shipmentStatus: string
  messagingOpen: boolean
  messages: OrderThreadMessage[]
}

export function AccountOrderMessageThread({
  orderId,
  onBack,
}: {
  orderId: string
  onBack?: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [thread, setThread] = useState<OrderThreadResponse | null>(null)
  const [messageText, setMessageText] = useState("")
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/account/order-messages/${orderId}/thread`, { cache: "no-store" })
      const json = (await res.json().catch(() => null)) as OrderThreadResponse | { error?: string } | null
      if (!res.ok) throw new Error((json as { error?: string } | null)?.error || "Failed to load order conversation")
      setThread(json as OrderThreadResponse)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load order conversation")
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void load()
    }, 8000)
    return () => window.clearInterval(timer)
  }, [load])

  const send = async () => {
    if (!messageText.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/account/order-messages/${orderId}/thread`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: messageText.trim() }),
      })
      const json = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) throw new Error(json?.error || "Failed to send message")
      setMessageText("")
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send message")
    } finally {
      setSending(false)
    }
  }

  const trackingMessages = thread?.messages.filter((item) => item.type === "tracking") || []

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Order conversation</p>
          <h2 className="text-xl font-semibold text-slate-900">
            {thread ? `${thread.orderNumber}` : "Loading..."}
          </h2>
          {thread ? (
            <p className="mt-1 text-xs text-slate-500">
              Status: {thread.status} • Shipment: {thread.shipmentStatus}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onBack?.()}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Back to orders
        </button>
      </div>

      <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tracking Message</p>
        {trackingMessages.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No tracking message.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {trackingMessages.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="text-sm text-slate-800">{item.message}</p>
                <p className="mt-1 text-[11px] text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="h-[360px] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
        {loading ? <p className="text-sm text-slate-500">Loading conversation...</p> : null}
        {!loading && (!thread || thread.messages.length === 0) ? (
          <p className="text-sm text-slate-500">No messages yet.</p>
        ) : null}
        {!loading && thread?.messages?.length ? (
          <div className="space-y-3">
            {thread.messages.map((item) => {
              const mine = item.type === "customer"
              const isTracking = item.type === "tracking"
              return (
                <div key={item.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[78%] rounded-2xl px-4 py-2 shadow-sm ${
                      mine
                        ? "bg-emerald-600 text-white"
                        : isTracking
                          ? "border border-sky-200 bg-sky-50 text-slate-900"
                          : "border border-slate-200 bg-white text-slate-900"
                    }`}
                  >
                    <p className={`text-[11px] font-semibold ${mine ? "text-emerald-100" : "text-slate-500"}`}>
                      {mine ? "You" : isTracking ? "Tracking update" : "Turkish Rug House"}
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-6">{item.message}</p>
                    <p className={`mt-1 text-[11px] ${mine ? "text-emerald-100" : "text-slate-500"}`}>
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        ) : null}
      </div>

      {thread?.messagingOpen ? (
        <div className="mt-4 flex gap-2">
          <textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Write your message about this shipment..."
            className="min-h-[72px] flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={send}
            disabled={sending || messageText.trim().length === 0}
            className="h-[72px] rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Messaging for this order is closed.
        </div>
      )}
    </div>
  )
}
