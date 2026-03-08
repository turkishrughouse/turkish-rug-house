"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Truck, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { updateOrderTracking } from "@/lib/actions/order-actions"

type ShipmentStatus = "PENDING" | "SHIPPED" | "IN_TRANSIT" | "DELIVERED"

type OrderTrackingPanelProps = {
  orderId: string
  trackingCarrier: string | null
  trackingNumber: string | null
  shipmentStatus: string
}

const CARRIER_OPTIONS = ["DHL", "UPS", "FedEx", "USPS", "Aras", "Yurtici", "MNG", "PTT", "Sendeo", "Other"]

export function OrderTrackingPanel({
  orderId,
  trackingCarrier,
  trackingNumber,
  shipmentStatus,
}: OrderTrackingPanelProps) {
  const [carrier, setCarrier] = useState(trackingCarrier || "DHL")
  const [trackingNo, setTrackingNo] = useState(trackingNumber || "")
  const [status, setStatus] = useState<ShipmentStatus>(
    shipmentStatus === "SHIPPED" || shipmentStatus === "IN_TRANSIT" || shipmentStatus === "DELIVERED"
      ? (shipmentStatus as ShipmentStatus)
      : "PENDING"
  )
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const saveTracking = async () => {
    setSaving(true)
    try {
      const result = await updateOrderTracking(orderId, {
        carrier,
        trackingNumber: trackingNo,
        shipmentStatus: status,
        notes,
      })
      if (!result.success) {
        toast.error(result.error || "Tracking update failed")
        return
      }
      toast.success("Tracking updated and customer notified")
      setNotes("")
      window.dispatchEvent(new Event("admin-orders-updated"))
    } catch {
      toast.error("Tracking update failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="h-full border-none shadow-none bg-transparent lg:bg-white lg:border lg:shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Truck className="h-4 w-4" />
          Shipping & Tracking
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label>Carrier</Label>
          <Select value={carrier} onValueChange={setCarrier}>
            <SelectTrigger>
              <SelectValue placeholder="Select carrier" />
            </SelectTrigger>
            <SelectContent>
              {CARRIER_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tracking-number">Tracking Number</Label>
          <Input
            id="tracking-number"
            value={trackingNo}
            onChange={(event) => setTrackingNo(event.target.value)}
            placeholder="e.g. 123456789"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="shipment-status">Shipment Status</Label>
          <Select value={status} onValueChange={(value) => setStatus(value as ShipmentStatus)}>
            <SelectTrigger id="shipment-status">
              <SelectValue placeholder="Select shipment status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="SHIPPED">Shipped</SelectItem>
              <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
              <SelectItem value="DELIVERED">Delivered</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tracking-notes">Notes (optional)</Label>
          <Textarea
            id="tracking-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Short status note for customer message..."
          />
        </div>

        <Button type="button" onClick={saveTracking} disabled={saving} className="w-full">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save Tracking
        </Button>
      </CardContent>
    </Card>
  )
}
