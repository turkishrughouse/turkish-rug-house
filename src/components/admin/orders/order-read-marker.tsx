"use client"

import { useEffect } from "react"
import { markOrderAsSeen } from "@/lib/admin/notification-state"

type OrderReadMarkerProps = {
  orderId: string
}

export function OrderReadMarker({ orderId }: OrderReadMarkerProps) {
  useEffect(() => {
    if (!orderId) return
    markOrderAsSeen(orderId)
    window.dispatchEvent(new Event("admin-orders-updated"))
  }, [orderId])

  return null
}
