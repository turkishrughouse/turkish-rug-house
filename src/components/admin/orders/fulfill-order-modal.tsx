"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { fulfillOrder } from "@/lib/actions/order-actions"
import { toast } from "sonner"
import { Loader2, Truck } from "lucide-react"

interface FulfillOrderModalProps {
    orderId: string
    isFulfillable: boolean
}

export function FulfillOrderModal({ orderId, isFulfillable }: FulfillOrderModalProps) {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [carrier, setCarrier] = useState("DHL")
    const [tracking, setTracking] = useState("")
    const [notes, setNotes] = useState("")

    const handleFulfill = async () => {
        if (!tracking) {
            toast.error("Tracking number is required")
            return
        }

        setIsLoading(true)
        try {
            const res = await fulfillOrder(orderId, carrier, tracking, notes)
            if (res.success) {
                toast.success("Order fulfilled successfully")
                window.dispatchEvent(new Event("admin-orders-updated"))
                setOpen(false)
            } else {
                toast.error(res.error || "Failed using default action")
            }
        } catch {
            toast.error("An error occurred")
        } finally {
            setIsLoading(false)
        }
    }

    if (!isFulfillable) {
        return (
            <Button disabled variant="outline" className="opacity-50 cursor-not-allowed">
                Fulfull Order
            </Button>
        )
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Truck className="mr-2 h-4 w-4" /> Fulfill Order
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Fulfill Order</DialogTitle>
                    <DialogDescription>
                        Enter shipping details to mark this order as fulfilled.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label>Carrier</Label>
                        <Select value={carrier} onValueChange={setCarrier}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select carrier" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="DHL">DHL Express</SelectItem>
                                <SelectItem value="UPS">UPS</SelectItem>
                                <SelectItem value="FedEx">FedEx</SelectItem>
                                <SelectItem value="USPS">USPS</SelectItem>
                                <SelectItem value="Other">Other / Manual</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="tracking">Tracking Number</Label>
                        <Input
                            id="tracking"
                            value={tracking}
                            onChange={(e) => setTracking(e.target.value)}
                            placeholder="e.g. 1Z999..."
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="notes">Notes (Optional)</Label>
                        <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Internal notes..."
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleFulfill} disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirm Fulfillment
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
