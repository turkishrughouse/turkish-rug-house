"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type OrderThreadMessage = {
  id: string
  message: string
  type: "customer" | "system" | "tracking"
  createdAt: string
  user?: {
    id: string
    email: string
    name: string | null
  } | null
}

type OrderThreadResponse = {
  id: string
  orderNumber: string
  customerEmail: string
  customerName: string | null
  messagingOpen: boolean
  messages: OrderThreadMessage[]
}

export function OrderMessageThreadPanel({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(true)
  const [thread, setThread] = useState<OrderThreadResponse | null>(null)
  const [replyText, setReplyText] = useState("")
  const [type, setType] = useState<"system" | "tracking">("system")
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/admin/orders/${orderId}/messages`, { cache: "no-store" })
      const json = (await res.json().catch(() => null)) as OrderThreadResponse | { error?: string } | null
      if (!res.ok) throw new Error((json as { error?: string } | null)?.error || "Failed to load order messages")
      setThread(json as OrderThreadResponse)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load order messages")
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    void load()
  }, [load])

  const submit = async () => {
    if (!replyText.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: replyText.trim(), type }),
      })
      const json = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) throw new Error(json?.error || "Failed to send order message")
      setReplyText("")
      await load()
      toast.success(type === "tracking" ? "Tracking update posted" : "Reply sent")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send order message")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order messages</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? <p className="text-sm text-slate-500">Loading thread...</p> : null}
        {!loading && thread && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            Customer: {thread.customerName || thread.customerEmail}
            <div className="mt-1">Messaging open: {thread.messagingOpen ? "Yes" : "No"}</div>
          </div>
        )}
        <div className="max-h-[360px] space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
          {!loading && thread?.messages.length === 0 ? (
            <p className="text-sm text-slate-500">No messages yet.</p>
          ) : null}
          {thread?.messages.map((item) => (
            <div key={item.id} className={`rounded-xl px-4 py-3 ${item.type === "customer" ? "bg-white border border-slate-200" : item.type === "tracking" ? "bg-sky-50 border border-sky-200" : "bg-emerald-50 border border-emerald-200"}`}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {item.type === "customer" ? "Customer" : item.type === "tracking" ? "Tracking" : "Admin"}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{item.message}</p>
              <p className="mt-2 text-[11px] text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType("system")}
              className={`rounded-md px-3 py-2 text-sm ${type === "system" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"}`}
            >
              Admin reply
            </button>
            <button
              type="button"
              onClick={() => setType("tracking")}
              className={`rounded-md px-3 py-2 text-sm ${type === "tracking" ? "bg-sky-700 text-white" : "border border-slate-300 text-slate-700"}`}
            >
              Tracking update
            </button>
          </div>
          <Textarea
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
            placeholder={type === "tracking" ? "Post a manual tracking update..." : "Reply to the customer..."}
          />
          <Button onClick={submit} disabled={submitting || replyText.trim().length === 0}>
            {submitting ? "Sending..." : type === "tracking" ? "Post tracking update" : "Send reply"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
