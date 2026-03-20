import { formatDistanceToNow } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Eye, MoreVertical, Check, Trash2, Mail, MessageSquare, Phone, Star } from "lucide-react"

interface Message {
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

interface MessagesTableProps {
    messages: Message[]
    loading: boolean
    selectedIds: Set<string>
    onSelectAll: (checked: boolean) => void
    onSelectOne: (id: string, checked: boolean) => void
    onView: (id: string) => void
    onStatusChange: (id: string, status: string) => void
    onDelete: (id: string) => void
    onBlock: (id: string) => void
    onUnblock: (id: string) => void
}

const statusColors = {
    NEW: "bg-blue-100 text-blue-700",
    OPEN: "bg-yellow-100 text-yellow-700",
    RESOLVED: "bg-green-100 text-green-700",
    BLOCKED: "bg-red-100 text-red-700",
}

const sourceIcons = {
    WHATSAPP: Phone,
    EMAIL: Mail,
    CONTACT: MessageSquare,
    REVIEW: Star,
    CUSTOMER: MessageSquare,
}

export function MessagesTable({
    messages,
    loading,
    selectedIds,
    onSelectAll,
    onSelectOne,
    onView,
    onStatusChange,
    onDelete,
    onBlock,
    onUnblock,
}: MessagesTableProps) {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-muted-foreground">Loading messages...</div>
            </div>
        )
    }

    if (messages.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No messages found</h3>
                <p className="text-muted-foreground mt-1">
                    Messages will appear here when they are received
                </p>
            </div>
        )
    }

    return (
        <div className="border rounded-lg bg-card">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-12">
                            <Checkbox
                                checked={messages.length > 0 && messages.every((message) => selectedIds.has(message.id))}
                                onCheckedChange={(checked) => onSelectAll(Boolean(checked))}
                                aria-label="Select all messages"
                            />
                        </TableHead>
                        <TableHead className="w-24">Source</TableHead>
                        <TableHead className="w-32">Status</TableHead>
                        <TableHead>From</TableHead>
                        <TableHead>Subject / Preview</TableHead>
                        <TableHead className="w-40">Received</TableHead>
                        <TableHead className="w-20 text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {messages.map((message) => {
                        const SourceIcon = sourceIcons[message.source as keyof typeof sourceIcons]
                        const from = message.name || message.email || message.phone || "Unknown"

                        return (
                            <TableRow
                                key={message.id}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => onView(message.id)}
                            >
                                <TableCell onClick={(event) => event.stopPropagation()}>
                                    <Checkbox
                                        checked={selectedIds.has(message.id)}
                                        onCheckedChange={(checked) => onSelectOne(message.id, Boolean(checked))}
                                        aria-label={`Select message ${message.id}`}
                                    />
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        {SourceIcon && <SourceIcon className="h-4 w-4 text-muted-foreground" />}
                                        <span className="text-xs font-medium">{message.source}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant="secondary"
                                        className={statusColors[message.status as keyof typeof statusColors]}
                                    >
                                        {message.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-medium">{from}</span>
                                        {message.email && message.email !== from && (
                                            <span className="text-xs text-muted-foreground">{message.email}</span>
                                        )}
                                        {message.phone && message.phone !== from && (
                                            <span className="text-xs text-muted-foreground">{message.phone}</span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col max-w-md">
                                        {message.subject && (
                                            <span className="font-medium text-sm line-clamp-1">
                                                {message.subject}
                                                {typeof message.messageCount === "number" && message.messageCount > 1 ? (
                                                    <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                                                        {message.messageCount}
                                                    </span>
                                                ) : null}
                                            </span>
                                        )}
                                        <span className="text-sm text-muted-foreground line-clamp-2">
                                            {message.preview}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    {formatDistanceToNow(new Date(message.receivedAt), { addSuffix: true })}
                                </TableCell>
                                <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => onView(message.id)}>
                                                <Eye className="h-4 w-4 mr-2" />
                                                View
                                            </DropdownMenuItem>
                                            {message.status !== "RESOLVED" && (
                                                <DropdownMenuItem onClick={() => onStatusChange(message.id, "RESOLVED")}>
                                                    <Check className="h-4 w-4 mr-2" />
                                                    Mark as Read
                                                </DropdownMenuItem>
                                            )}
                                            {message.status !== "BLOCKED" && (
                                                <DropdownMenuItem onClick={() => onBlock(message.id)}>
                                                    <Mail className="h-4 w-4 mr-2" />
                                                    Block Sender
                                                </DropdownMenuItem>
                                            )}
                                            {message.status === "BLOCKED" && (
                                                <DropdownMenuItem onClick={() => onUnblock(message.id)}>
                                                    <Mail className="h-4 w-4 mr-2" />
                                                    Remove Block
                                                </DropdownMenuItem>
                                            )}
                                            <DropdownMenuItem
                                                onClick={() => onDelete(message.id)}
                                                className="text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    )
}
