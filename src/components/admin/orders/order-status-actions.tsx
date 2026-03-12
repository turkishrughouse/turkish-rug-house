"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { updateOrderWorkflow } from "@/lib/actions/order-actions"

type OrderStatusActionsProps = {
  orderId: string
  status: string
}

export function OrderStatusActions({ orderId, status }: OrderStatusActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const runAction = (nextStatus: "PAID" | "PROCESSING" | "CANCELLED" | "REFUNDED" | "SHIPPED" | "DELIVERED") => {
    startTransition(async () => {
      const result = await updateOrderWorkflow(orderId, {
        status: nextStatus,
        paymentStatus: nextStatus === "PAID" ? "PAID" : nextStatus === "REFUNDED" ? "REFUNDED" : undefined,
      })
      if (!result.success) {
        toast.error(result.error || "Order action failed")
        return
      }
      toast.success(`Order marked ${nextStatus.toLowerCase()}`)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" disabled={isPending || status === "PAID"} onClick={() => runAction("PAID")}>
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Mark paid
      </Button>
      <Button variant="outline" size="sm" disabled={isPending || status === "PROCESSING"} onClick={() => runAction("PROCESSING")}>
        Processing
      </Button>
      <Button variant="outline" size="sm" disabled={isPending || status === "SHIPPED"} onClick={() => runAction("SHIPPED")}>
        Mark shipped
      </Button>
      <Button variant="outline" size="sm" disabled={isPending || status === "DELIVERED"} onClick={() => runAction("DELIVERED")}>
        Mark delivered
      </Button>
      <Button variant="outline" size="sm" disabled={isPending || status === "CANCELLED"} onClick={() => runAction("CANCELLED")}>
        Cancel order
      </Button>
      <Button variant="outline" size="sm" disabled={isPending || status === "REFUNDED"} onClick={() => runAction("REFUNDED")}>
        Refund order
      </Button>
    </div>
  )
}
