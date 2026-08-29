"use client"

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import type { DashboardTrendPoint } from "@/lib/admin/dashboard-metrics"

/**
 * Net revenue over the selected range, drawn with the recharts build the admin
 * already ships - no second charting dependency.
 *
 * The series is gap-filled in SQL, so a quiet week is a run of real zeros rather
 * than missing points. When the whole range is zero the caller shows an explicit
 * empty state instead, because an axis pinned to 0 reads as a broken chart.
 */
export function RevenueChart({ points, currency = "USD" }: { points: DashboardTrendPoint[]; currency?: string }) {
    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: currency || "USD",
            maximumFractionDigits: 0,
        }).format(Number(value) || 0)

    // Keep the axis readable on long ranges without dropping the end labels.
    const tickInterval = points.length > 14 ? Math.ceil(points.length / 7) - 1 : 0

    return (
        <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#0f766e" stopOpacity={0.18} />
                            <stop offset="100%" stopColor="#0f766e" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                    <XAxis
                        dataKey="label"
                        interval={tickInterval}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        minTickGap={4}
                    />
                    <YAxis
                        width={64}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        tickFormatter={(value: number) => formatCurrency(value)}
                    />
                    <Tooltip
                        cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }}
                        contentStyle={{
                            borderRadius: 10,
                            border: "1px solid #dce3ed",
                            fontSize: 12,
                            boxShadow: "0 8px 20px rgba(15,23,42,0.08)",
                        }}
                        formatter={(value) => [formatCurrency(Number(value ?? 0)), "Net revenue"]}
                    />
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#0f766e"
                        strokeWidth={2}
                        fill="url(#revenueFill)"
                        dot={false}
                        activeDot={{ r: 4 }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    )
}
