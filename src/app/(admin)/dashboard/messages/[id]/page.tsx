"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Mail, MessageSquare, Phone, Calendar, User, FileText, Paperclip, Star } from "lucide-react"
import { toast } from "sonner"

const statusColors = {
    NEW: "bg-blue-100 text-blue-700",
    OPEN: "bg-yellow-100 text-yellow-700",
    RESOLVED: "bg-green-100 text-green-700",
}

const sourceIcons = {
    WHATSAPP: Phone,
    EMAIL: Mail,
    CONTACT: MessageSquare,
    REVIEW: Star,
    CUSTOMER: MessageSquare,
}

type Attachment = {
    type?: string
    url?: string
    filename?: string
}

type MessageMetadata = {
    pageUrl?: string
    productSlug?: string
    productTitle?: string
    rating?: number
    conversationId?: string
    userId?: string
    sender?: string
}

type ConversationMessage = {
    id: string
    sender: "CUSTOMER" | "ADMIN"
    name?: string | null
    email?: string | null
    senderName?: string
    content: string
    createdAt: string
}

type MessageDetail = {
    id: string
    source: string
    status: string
    name?: string | null
    email?: string | null
    phone?: string | null
    subject?: string | null
    content: string
    notes?: string | null
    receivedAt: string
    attachments: Attachment[]
    metadata?: MessageMetadata | null
}

export default function MessageDetailPage() {
    const params = useParams<{ id: string }>()
    const messageId = Array.isArray(params?.id) ? params.id[0] : params?.id
    const router = useRouter()
    const [message, setMessage] = useState<MessageDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [status, setStatus] = useState("")
    const [notes, setNotes] = useState("")
    const [saving, setSaving] = useState(false)
    const [threadMessages, setThreadMessages] = useState<ConversationMessage[]>([])
    const [replyText, setReplyText] = useState("")
    const [replying, setReplying] = useState(false)

    const markAsRead = async (id: string) => {
        try {
            const response = await fetch(`/api/admin/messages/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "OPEN" }),
            })

            if (!response.ok) return

            setMessage((prev) => (prev ? { ...prev, status: "OPEN" } : prev))
            setStatus("OPEN")
            window.dispatchEvent(new Event("admin-messages-updated"))
        } catch {
            // If this fails, detail page should still remain usable.
        }
    }

    const fetchMessage = useCallback(async (id: string) => {
        try {
            setLoading(true)
            const response = await fetch(`/api/admin/messages/${id}`)
            if (!response.ok) throw new Error("Failed to fetch message")

            const data = (await response.json()) as MessageDetail
            setMessage(data)
            setStatus(data.status)
            setNotes(data.notes || "")

            if (data.status === "NEW") {
                void markAsRead(id)
            }
        } catch (error) {
            console.error("Error fetching message:", error)
            toast.error("Failed to load message")
        } finally {
            setLoading(false)
        }
    }, [])

    const fetchThread = useCallback(async () => {
        if (!messageId || !message || (message.source !== "CUSTOMER" && message.source !== "EMAIL")) return
        try {
            const response = await fetch(`/api/admin/messages/${messageId}/thread`, { cache: "no-store" })
            if (!response.ok) return
            const data = (await response.json()) as { messages?: ConversationMessage[] }
            setThreadMessages(Array.isArray(data.messages) ? data.messages : [])
        } catch {
            // thread is secondary
        }
    }, [messageId, message])

    useEffect(() => {
        if (!messageId) return
        void fetchMessage(messageId)
    }, [messageId, fetchMessage])

    useEffect(() => {
        void fetchThread()
    }, [fetchThread])

    useEffect(() => {
        if (!messageId || !message || (message.source !== "CUSTOMER" && message.source !== "EMAIL")) return
        const timer = window.setInterval(() => {
            void fetchThread()
        }, 8000)
        return () => window.clearInterval(timer)
    }, [messageId, message, fetchThread])

    const handleSave = async () => {
        if (!messageId) return

        try {
            setSaving(true)
            const response = await fetch(`/api/admin/messages/${messageId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status, notes }),
            })

            if (!response.ok) throw new Error("Failed to update message")

            toast.success("Message updated successfully")
            window.dispatchEvent(new Event("admin-messages-updated"))
            await fetchMessage(messageId)
        } catch (error) {
            console.error("Error updating message:", error)
            toast.error("Failed to update message")
        } finally {
            setSaving(false)
        }
    }

    const handleReply = async () => {
        if (!messageId || replyText.trim().length === 0) return
        try {
            setReplying(true)
            const response = await fetch(`/api/admin/messages/${messageId}/reply`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: replyText.trim() }),
            })
            const json = await response.json().catch(() => null as { error?: string } | null)
            if (!response.ok) throw new Error(json?.error || "Failed to send reply")
            setReplyText("")
            toast.success("Reply sent")
            await fetchMessage(messageId)
            await fetchThread()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to send reply")
        } finally {
            setReplying(false)
        }
    }

    if (loading) {
        return (
            <div className="flex-1 p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center py-12">Loading message...</div>
                </div>
            </div>
        )
    }

    if (!message) {
        return (
            <div className="flex-1 p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center py-12">Message not found</div>
                </div>
            </div>
        )
    }

    const SourceIcon = sourceIcons[message.source as keyof typeof sourceIcons]
    const metadata = message.metadata || ({} as MessageMetadata)

    return (
        <div className="flex-1 p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold">
                            {message.source === "REVIEW" ? "Review Details" : "Message Details"}
                        </h1>
                    </div>
                    <Badge
                        variant="secondary"
                        className={statusColors[message.status as keyof typeof statusColors]}
                    >
                        {message.status}
                    </Badge>
                </div>

                {/* Metadata Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            {SourceIcon && <SourceIcon className="h-5 w-5" />}
                            {message.source} Message
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            {message.name && (
                                <div className="flex items-start gap-3">
                                    <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium">Name</p>
                                        <p className="text-sm text-muted-foreground">{message.name}</p>
                                    </div>
                                </div>
                            )}
                            {message.email && (
                                <div className="flex items-start gap-3">
                                    <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium">Email</p>
                                        <p className="text-sm text-muted-foreground">{message.email}</p>
                                    </div>
                                </div>
                            )}
                            {message.phone && (
                                <div className="flex items-start gap-3">
                                    <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium">Phone</p>
                                        <p className="text-sm text-muted-foreground">{message.phone}</p>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-start gap-3">
                                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium">Received</p>
                                    <p className="text-sm text-muted-foreground">
                                        {formatDistanceToNow(new Date(message.receivedAt), { addSuffix: true })}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {metadata?.pageUrl && (
                            <div className="flex items-start gap-3">
                                <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium">Page URL</p>
                                    <p className="text-sm text-muted-foreground break-all">{metadata.pageUrl}</p>
                                </div>
                            </div>
                        )}

                        {message.source === "REVIEW" ? (
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <div className="flex items-start gap-3">
                                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium">Product</p>
                                        {metadata?.productSlug ? (
                                            <a
                                                href={`/product/${metadata.productSlug}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-sm text-emerald-700 hover:underline"
                                            >
                                                {metadata?.productTitle || metadata.productSlug}
                                            </a>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">{metadata?.productTitle || "Unknown product"}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Star className="h-4 w-4 text-muted-foreground mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium">Rating</p>
                                        <p className="text-sm text-muted-foreground">{Number(metadata?.rating || 0)} / 5</p>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </CardContent>
                </Card>

                {/* Message Content */}
                {message.source !== "CUSTOMER" ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>
                                {message.subject || "Message Content"}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="prose prose-sm max-w-none">
                                <p className="whitespace-pre-wrap">{message.content}</p>
                            </div>
                        </CardContent>
                    </Card>
                ) : null}

                {/* Attachments */}
                {message.attachments && message.attachments.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Paperclip className="h-5 w-5" />
                                Attachments ({message.attachments.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {message.attachments.map((attachment: Attachment, index: number) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between p-3 border rounded-lg"
                                    >
                                        <div>
                                            <p className="text-sm font-medium">{attachment.filename}</p>
                                            <p className="text-xs text-muted-foreground">{attachment.type}</p>
                                        </div>
                                        {attachment.url && (
                                            <Button variant="outline" size="sm" asChild>
                                                <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                                                    Download
                                                </a>
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Status and Notes */}
                {message.source !== "REVIEW" ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>Admin Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-sm font-medium mb-2 block">Status</label>
                                <Select value={status} onValueChange={setStatus}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NEW">New</SelectItem>
                                        <SelectItem value="OPEN">Open</SelectItem>
                                        <SelectItem value="RESOLVED">Resolved</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <label className="text-sm font-medium mb-2 block">Internal Notes</label>
                                <Textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Add internal notes about this message..."
                                    rows={4}
                                />
                            </div>

                            <Button onClick={handleSave} disabled={saving}>
                                {saving ? "Saving..." : "Save Changes"}
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardHeader>
                            <CardTitle>Admin Actions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                Reviews are read-only in this panel.
                            </p>
                        </CardContent>
                    </Card>
                )}

                {message.source === "CUSTOMER" || message.source === "EMAIL" ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>Conversation</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
                                {threadMessages.length === 0 ? (
                                    <p className="text-sm text-slate-500">No conversation messages yet.</p>
                                ) : (
                                    threadMessages.map((entry) => {
                                        const isAdmin = entry.sender === "ADMIN"
                                        const senderLabel = isAdmin
                                            ? "Turkish Rug House"
                                            : entry.senderName || entry.name || entry.email || message.name || message.email || "Customer"
                                        return (
                                            <div key={entry.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                                                <div
                                                    className={`max-w-[78%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                                                        isAdmin
                                                            ? "bg-blue-600 text-white"
                                                            : "border border-slate-200 bg-white text-slate-900"
                                                    }`}
                                                >
                                                    <p className={`text-[11px] font-semibold ${isAdmin ? "text-blue-100" : "text-slate-500"}`}>
                                                        {senderLabel}
                                                    </p>
                                                    <p className="whitespace-pre-wrap">{entry.content}</p>
                                                    <p className={`mt-1 text-[11px] ${isAdmin ? "text-blue-100" : "text-slate-500"}`}>
                                                        {new Date(entry.createdAt).toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                            {message.source === "CUSTOMER" ? (
                                <div className="flex items-start gap-2">
                                    <Textarea
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        placeholder="Write a reply to customer..."
                                        rows={3}
                                    />
                                    <Button onClick={handleReply} disabled={replying || replyText.trim().length === 0}>
                                        {replying ? "Sending..." : "Reply"}
                                    </Button>
                                </div>
                            ) : (
                                <p className="text-xs text-slate-500">
                                    Email conversations are read-only here. Reply from your mail provider inbox if needed.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                ) : null}
            </div>
        </div>
    )
}
