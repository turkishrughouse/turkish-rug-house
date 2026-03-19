"use client"

import { useRef, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Search } from "lucide-react"
import { MessagesTable } from "@/components/admin/messages/messages-table"
import { toast } from "sonner"

type MessageSource = "ALL" | "CUSTOMER" | "REVIEW" | "EMAIL" | "CONTACT"
type MessageStatus = "ALL" | "NEW" | "OPEN" | "RESOLVED" | "BLOCKED"
type BulkAction = "none" | "mark_read" | "delete" | "block" | "unblock"
type MessageListItem = {
    id: string
    source: string
    status: string
    name?: string | null
    email?: string | null
    phone?: string | null
    subject?: string | null
    preview: string
    receivedAt: string
    messageCount?: number
}

type MessageSourceCounts = {
    ALL: number
    CUSTOMER: number
    REVIEW: number
    EMAIL: number
    CONTACT: number
}

type CountryCount = {
    country: string
    count: number
}

export default function MessagesPage() {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState<MessageSource>("ALL")
    const [status, setStatus] = useState<MessageStatus>("ALL")
    const [searchQuery, setSearchQuery] = useState("")
    const [messages, setMessages] = useState<MessageListItem[]>([])
    const [loading, setLoading] = useState(true)
    const [pagination, setPagination] = useState({
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
    })
    const [newMessageCount, setNewMessageCount] = useState(0)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [bulkAction, setBulkAction] = useState<BulkAction>("none")
    const [bulkLoading, setBulkLoading] = useState(false)
    const [sourceCounts, setSourceCounts] = useState<MessageSourceCounts>({
        ALL: 0,
        CUSTOMER: 0,
        REVIEW: 0,
        EMAIL: 0,
        CONTACT: 0,
    })
    const [countryCounts, setCountryCounts] = useState<CountryCount[]>([])
    const [selectedCountry, setSelectedCountry] = useState("ALL")
    const fetchAbortRef = useRef<AbortController | null>(null)
    const lastFetchErrorAtRef = useRef(0)
    const fetchInFlightRef = useRef(false)
    const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const fetchSourceCounts = async () => {
        try {
            const fetchCount = async (source: MessageSource) => {
                const params = new URLSearchParams({
                    page: "1",
                    pageSize: "1",
                    status: "NEW",
                })
                if (source !== "ALL") {
                    params.set("source", source)
                }

                const response = await fetch(`/api/admin/messages?${params.toString()}`, {
                    cache: "no-store",
                })
                if (!response.ok) return 0

                const data = await response.json() as { meta?: { total?: number } }
                return Number(data?.meta?.total || 0)
            }

            const [all, customer, review, email, contact] = await Promise.all([
                fetchCount("ALL"),
                fetchCount("CUSTOMER"),
                fetchCount("REVIEW"),
                fetchCount("EMAIL"),
                fetchCount("CONTACT"),
            ])

            setSourceCounts({
                ALL: all,
                CUSTOMER: customer,
                REVIEW: review,
                EMAIL: email,
                CONTACT: contact,
            })
            setNewMessageCount(all)
        } catch {
            // count badges are secondary to main list
        }
    }

    // Fetch messages
    const fetchMessages = async (options?: { silent?: boolean }) => {
        try {
            if (fetchInFlightRef.current) return
            fetchInFlightRef.current = true
            if (!options?.silent) {
                setLoading(true)
            }
            fetchAbortRef.current?.abort()
            const controller = new AbortController()
            fetchAbortRef.current = controller
            if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current)
            fetchTimeoutRef.current = setTimeout(() => controller.abort(), 10000)
            const params = new URLSearchParams({
                page: pagination.page.toString(),
                pageSize: pagination.pageSize.toString(),
            })

            if (activeTab !== "ALL") params.append("source", activeTab)
            if (status !== "ALL") params.append("status", status)
            if (searchQuery) params.append("q", searchQuery)
            if (selectedCountry !== "ALL") params.append("country", selectedCountry)

            const response = await fetch(`/api/admin/messages?${params}`, { signal: controller.signal })
            if (!response.ok) throw new Error("Failed to fetch messages")

            const data = await response.json()
            setMessages(data.data)
            setSelectedIds((prev) => {
                const next = new Set<string>()
                data.data.forEach((item: MessageListItem) => {
                    if (prev.has(item.id)) next.add(item.id)
                })
                return next
            })
            setPagination((prev) => ({ ...prev, ...data.meta }))

            void fetchSourceCounts()
        } catch (error) {
            const isAbort = error instanceof DOMException && error.name === "AbortError"
            if (!isAbort) {
                const now = Date.now()
                // Avoid spamming toasts/logs on transient navigation/connection issues.
                if (now - lastFetchErrorAtRef.current > 15000) {
                    toast.error("Failed to load messages")
                    lastFetchErrorAtRef.current = now
                }
            }
        } finally {
            if (fetchTimeoutRef.current) {
                clearTimeout(fetchTimeoutRef.current)
                fetchTimeoutRef.current = null
            }
            fetchInFlightRef.current = false
            if (!options?.silent) {
                setLoading(false)
            }
        }
    }

    // Initial fetch and refetch on filter changes
    useEffect(() => {
        fetchMessages()
    }, [activeTab, status, selectedCountry, pagination.page])

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery !== undefined) {
                setPagination((prev) => ({ ...prev, page: 1 }))
                fetchMessages()
            }
        }, 500)

        return () => clearTimeout(timer)
    }, [searchQuery])

    // Real-time SSE connection
    useEffect(() => {
        let eventSource: EventSource | null = null
        let retryTimer: ReturnType<typeof setTimeout> | null = null
        let closed = false
        let backoffMs = 2000

        const connect = () => {
            if (closed) return
            eventSource?.close()
            eventSource = new EventSource("/api/admin/messages/stream")

            eventSource.onmessage = (event) => {
                const data = JSON.parse(event.data)

                if (data.type === "new_message") {
                    toast.success(`New message from ${data.data.from}`, {
                        description: data.data.preview,
                    })
                    setNewMessageCount((prev) => prev + 1)
                    fetchMessages({ silent: true }) // Refresh list without blocking UI
                }
            }

            eventSource.onerror = () => {
                eventSource?.close()
                if (closed) return
                if (retryTimer) clearTimeout(retryTimer)
                retryTimer = setTimeout(connect, backoffMs)
                backoffMs = Math.min(30000, Math.round(backoffMs * 1.6))
            }
        }

        connect()
        return () => {
            closed = true
            fetchAbortRef.current?.abort()
            if (retryTimer) clearTimeout(retryTimer)
            eventSource?.close()
        }
    }, [])

    useEffect(() => {
        const loadCountryCounts = async () => {
            try {
                const res = await fetch("/api/admin/messages/countries", { cache: "no-store" })
                if (!res.ok) return
                const json = (await res.json()) as { data?: CountryCount[] }
                setCountryCounts(Array.isArray(json.data) ? json.data : [])
            } catch {
                // optional panel
            }
        }
        void loadCountryCounts()
    }, [])

    const handleViewMessage = (id: string) => {
        router.push(`/dashboard/messages/${id}`)
    }

    const handleStatusChange = async (id: string, newStatus: string) => {
        try {
            const response = await fetch(`/api/admin/messages/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            })

            if (!response.ok) throw new Error("Failed to update status")

            toast.success("Status updated")
            window.dispatchEvent(new Event("admin-messages-updated"))
            fetchMessages()
        } catch (error) {
            console.error("Error updating status:", error)
            toast.error("Failed to update status")
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this message?")) return

        try {
            const response = await fetch(`/api/admin/messages/${id}`, {
                method: "DELETE",
            })

            if (!response.ok) throw new Error("Failed to delete message")

            toast.success("Message deleted")
            window.dispatchEvent(new Event("admin-messages-updated"))
            fetchMessages()
        } catch (error) {
            console.error("Error deleting message:", error)
            toast.error("Failed to delete message")
        }
    }

    const handleBlock = async (id: string) => {
        try {
            const response = await fetch("/api/admin/messages/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: [id], action: "block" }),
            })
            if (!response.ok) throw new Error("Failed to block sender")
            toast.success("Sender blocked")
            window.dispatchEvent(new Event("admin-messages-updated"))
            fetchMessages()
        } catch (error) {
            console.error("Error blocking sender:", error)
            toast.error("Failed to block sender")
        }
    }

    const handleUnblock = async (id: string) => {
        try {
            const response = await fetch("/api/admin/messages/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: [id], action: "unblock" }),
            })
            if (!response.ok) throw new Error("Failed to remove block")
            toast.success("Sender unblocked")
            window.dispatchEvent(new Event("admin-messages-updated"))
            fetchMessages()
        } catch (error) {
            console.error("Error unblocking sender:", error)
            toast.error("Failed to remove block")
        }
    }

    const handleSelectAll = (checked: boolean) => {
        if (!checked) {
            setSelectedIds(new Set())
            return
        }
        setSelectedIds(new Set(messages.map((message) => message.id)))
    }

    const handleSelectOne = (id: string, checked: boolean) => {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (checked) next.add(id)
            else next.delete(id)
            return next
        })
    }

    const handleBulkApply = async () => {
        if (bulkAction === "none" || selectedIds.size === 0) return
        if (bulkAction === "delete" && !confirm(`${selectedIds.size} message(s) will be deleted. Continue?`)) return
        if (bulkAction === "block" && !confirm(`${selectedIds.size} sender(s) will be blocked. Continue?`)) return
        if (bulkAction === "unblock" && !confirm(`${selectedIds.size} sender(s) will be unblocked. Continue?`)) return

        setBulkLoading(true)
        try {
            const response = await fetch("/api/admin/messages/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ids: Array.from(selectedIds),
                    action: bulkAction,
                }),
            })
            if (!response.ok) throw new Error("Bulk action failed")

            const result = await response.json() as { processed?: number; failed?: number }
            toast.success(`Processed ${result.processed || 0} message(s)`)
            if ((result.failed || 0) > 0) {
                toast.warning(`${result.failed} message(s) could not be processed`)
            }
            setSelectedIds(new Set())
            setBulkAction("none")
            window.dispatchEvent(new Event("admin-messages-updated"))
            fetchMessages()
        } catch (error) {
            console.error("Bulk action error:", error)
            toast.error("Failed to apply bulk action")
        } finally {
            setBulkLoading(false)
        }
    }

    return (
        <div className="flex-1 p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
                        <p className="text-muted-foreground mt-1">
                            Manage incoming reviews, emails, and contact form messages
                        </p>
                    </div>
                    {newMessageCount > 0 && (
                        <Badge variant="destructive" className="text-lg px-4 py-2">
                            {newMessageCount} New
                        </Badge>
                    )}
                </div>

                {/* Filters */}
                <div className="flex items-center gap-4 bg-card p-4 rounded-lg border">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search messages..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <Select value={status} onValueChange={(val) => setStatus(val as MessageStatus)}>
                        <SelectTrigger className="w-40">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Status</SelectItem>
                            <SelectItem value="NEW">New</SelectItem>
                            <SelectItem value="OPEN">Open</SelectItem>
                            <SelectItem value="RESOLVED">Resolved</SelectItem>
                            <SelectItem value="BLOCKED">Blocked</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={selectedCountry} onValueChange={(value) => {
                        setSelectedCountry(value)
                        setPagination((prev) => ({ ...prev, page: 1 }))
                    }}>
                        <SelectTrigger className="w-56">
                            <SelectValue placeholder="Customer countries" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All countries</SelectItem>
                            {countryCounts.length > 0 ? (
                                countryCounts.map((item) => (
                                    <SelectItem key={item.country} value={item.country}>
                                        {`${item.country} (${item.count})`}
                                    </SelectItem>
                                ))
                            ) : (
                                <SelectItem value="UNKNOWN_EMPTY" disabled>No country data yet</SelectItem>
                            )}
                        </SelectContent>
                    </Select>
                </div>

                {/* Bulk Actions */}
                <div className="flex items-center gap-3 bg-card p-4 rounded-lg border">
                    <p className="text-sm text-muted-foreground min-w-[150px]">
                        {selectedIds.size} selected
                    </p>
                    <Select value={bulkAction} onValueChange={(val) => setBulkAction(val as BulkAction)}>
                        <SelectTrigger className="w-56">
                            <SelectValue placeholder="Bulk actions" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Bulk actions</SelectItem>
                            <SelectItem value="mark_read">Mark as Read</SelectItem>
                            <SelectItem value="delete">Delete</SelectItem>
                            <SelectItem value="block">Block Sender</SelectItem>
                            <SelectItem value="unblock">Remove Block</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleBulkApply}
                        disabled={bulkAction === "none" || selectedIds.size === 0 || bulkLoading}
                    >
                        {bulkLoading ? "Applying..." : "Apply"}
                    </Button>
                </div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as MessageSource)}>
                    <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="ALL" className="gap-2">
                            Messages
                            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-700">
                                {sourceCounts.ALL}
                            </span>
                        </TabsTrigger>
                        <TabsTrigger value="CUSTOMER" className="gap-2">
                            Customer
                            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-700">
                                {sourceCounts.CUSTOMER}
                            </span>
                        </TabsTrigger>
                        <TabsTrigger value="REVIEW" className="gap-2">
                            Reviews
                            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-700">
                                {sourceCounts.REVIEW}
                            </span>
                        </TabsTrigger>
                        <TabsTrigger value="EMAIL" className="gap-2">
                            Email
                            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-700">
                                {sourceCounts.EMAIL}
                            </span>
                        </TabsTrigger>
                        <TabsTrigger value="CONTACT" className="gap-2">
                            Contact Form
                            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-700">
                                {sourceCounts.CONTACT}
                            </span>
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value={activeTab} className="mt-6">
                        <MessagesTable
                            messages={messages}
                            loading={loading}
                            selectedIds={selectedIds}
                            onSelectAll={handleSelectAll}
                            onSelectOne={handleSelectOne}
                            onView={handleViewMessage}
                            onStatusChange={handleStatusChange}
                            onDelete={handleDelete}
                            onBlock={handleBlock}
                            onUnblock={handleUnblock}
                        />

                        {/* Pagination */}
                        {pagination.totalPages > 1 && (
                            <div className="flex items-center justify-between mt-6">
                                <p className="text-sm text-muted-foreground">
                                    Showing {messages.length} of {pagination.total} messages
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={pagination.page === 1}
                                        onClick={() =>
                                            setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                                        }
                                    >
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={pagination.page === pagination.totalPages}
                                        onClick={() =>
                                            setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                                        }
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}
