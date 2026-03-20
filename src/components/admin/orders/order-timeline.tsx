"use client"

import { OrderEvent } from "@prisma/client"
import {
    CheckCircle2,
    Circle,
    CreditCard,
    MessageSquare,
    Package,
    Truck,
    XCircle,
    User,
    RefreshCw
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface OrderTimelineProps {
    events: OrderEvent[]
}

export function OrderTimeline({ events }: OrderTimelineProps) {
    if (events.length === 0) {
        return (
            <div className="text-sm text-muted-foreground p-4 text-center border rounded-lg bg-slate-50/50">
                No events recorded for this order yet.
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <h3 className="font-semibold text-lg tracking-tight">Order Activity</h3>

            <div className="relative pl-2">
                {/* Vertical Line */}
                <div className="absolute left-[15px] top-2 bottom-4 w-[1px] bg-slate-200" />

                <div className="space-y-6">
                    {events.map((event) => {
                        const Icon = getEventIcon(event.type)
                        const colorClass = getEventColor(event.type)

                        return (
                            <div key={event.id} className="relative pl-10 group">
                                {/* Icon Bubble */}
                                <div className={cn(
                                    "absolute left-0 top-1 w-8 h-8 rounded-full border-2 bg-white flex items-center justify-center z-10 transition-colors",
                                    colorClass
                                )}>
                                    <Icon className="w-4 h-4" />
                                </div>

                                {/* Content */}
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium text-sm text-slate-900 group-hover:text-teal-600 transition-colors">
                                            {event.title}
                                        </span>
                                        <span className="text-xs text-muted-foreground tabular-nums opacity-60 group-hover:opacity-100">
                                            {format(new Date(event.createdAt), "MMM d, h:mm a")}
                                        </span>
                                    </div>

                                    {event.description && (
                                        <p className="text-sm text-slate-500 leading-relaxed">
                                            {event.description}
                                        </p>
                                    )}

                                    {/* Actor Label */}
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                            {event.actorType === 'SYSTEM' ? (
                                                <RefreshCw className="w-3 h-3" />
                                            ) : event.actorType === 'CUSTOMER' ? (
                                                <User className="w-3 h-3" />
                                            ) : (
                                                <CheckCircle2 className="w-3 h-3" />
                                            )}
                                            {event.actorType}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

function getEventIcon(type: string) {
    switch (type.toUpperCase()) {
        case 'CREATED': return Package
        case 'PAYMENT': return CreditCard
        case 'FULFILLMENT': return Truck
        case 'STATUS': return RefreshCw
        case 'DELIVERED': return CheckCircle2
        case 'CANCELLED': return XCircle
        case 'REFUNDED': return CreditCard
        case 'NOTE': return MessageSquare
        default: return Circle
    }
}

function getEventColor(type: string) {
    switch (type.toUpperCase()) {
        case 'PAYMENT': return "border-emerald-100 text-emerald-600"
        case 'FULFILLMENT': return "border-blue-100 text-blue-600"
        case 'STATUS': return "border-slate-200 text-slate-600"
        case 'CANCELLED': return "border-red-100 text-red-600"
        case 'REFUNDED': return "border-amber-100 text-amber-700"
        case 'NOTE': return "border-amber-100 text-amber-600"
        case 'CREATED': return "border-slate-200 text-slate-600"
        default: return "border-slate-200 text-slate-500"
    }
}
