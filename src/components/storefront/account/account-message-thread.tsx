"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

type ThreadMessage = {
  id: string
  title?: string
  content: string
  sender: "CUSTOMER" | "ADMIN"
  senderName?: string
  createdAt: string
}

type ThreadResponse = {
  conversationId: string
  title: string
  messages: ThreadMessage[]
}

export function AccountMessageThread({
  user,
  messageId,
  embedded = false,
  onBack,
}: {
  user: { id: string; email: string; name: string | null }
  messageId: string
  embedded?: boolean
  onBack?: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [thread, setThread] = useState<ThreadResponse | null>(null)
  const [messageText, setMessageText] = useState("")
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/account/messages/${messageId}/thread`, { cache: "no-store" })
      const json = (await res.json().catch(() => null)) as ThreadResponse | { error?: string } | null
      if (!res.ok) throw new Error((json as { error?: string } | null)?.error || "Failed to load conversation")
      setThread(json as ThreadResponse)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load conversation")
    } finally {
      setLoading(false)
    }
  }, [messageId])

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
      const res = await fetch(`/api/account/messages/${messageId}/thread`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: messageText.trim() }),
      })
      const json = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) throw new Error(json?.error || "Failed to send reply")
      setMessageText("")
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send reply")
    } finally {
      setSending(false)
    }
  }

  const threadContent = (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Conversation</p>
          <h1 className="text-xl font-semibold text-slate-900">{thread?.title || "Customer Support"}</h1>
        </div>
        {embedded ? (
          <button
            type="button"
            onClick={() => onBack?.()}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Back to messages
          </button>
        ) : (
          <Link
            href="/account?tab=notifications"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Back to messages
          </Link>
        )}
      </div>

      <div className={`${embedded ? "h-[420px] min-h-[280px]" : "h-[58vh] min-h-[340px]"} overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4`}>
        {loading ? <p className="text-sm text-slate-500">Loading conversation...</p> : null}
        {!loading && (!thread || thread.messages.length === 0) ? (
          <p className="text-sm text-slate-500">No messages yet.</p>
        ) : null}
        {!loading && thread?.messages?.length ? (
          <div className="space-y-3">
            {thread.messages.map((item) => {
              const mine = item.sender === "CUSTOMER"
              return (
                <div key={item.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[78%] rounded-2xl px-4 py-2 shadow-sm ${
                      mine ? "bg-emerald-600 text-white" : "bg-white text-slate-900 border border-slate-200"
                    }`}
                  >
                    <p className={`text-[11px] font-semibold ${mine ? "text-emerald-100" : "text-slate-500"}`}>
                      {item.senderName || (mine ? "You" : "Turkish Rug House")}
                    </p>
                    <p className="text-sm leading-6 whitespace-pre-wrap">{item.content}</p>
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

      <div className="mt-4 flex gap-2">
        <textarea
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder="Write your message..."
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
      <p className="mt-2 text-xs text-slate-500">
        Signed in as {user.name || user.email}
      </p>
    </div>
  )

  if (embedded) {
    return threadContent
  }

  return (
    <section className="border-t border-slate-200 bg-[#f5f7fb]">
      <div className="mx-auto w-full max-w-[960px] px-6 py-8">{threadContent}</div>
    </section>
  )
}
