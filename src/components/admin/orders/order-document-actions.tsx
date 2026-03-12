"use client"

import { Button } from "@/components/ui/button"
import { Download, FileText } from "lucide-react"

type OrderDocumentActionsProps = {
  orderId: string
}

export function OrderDocumentActions({ orderId }: OrderDocumentActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline">
        <a href={`/api/admin/orders/${orderId}/invoice`} target="_blank" rel="noreferrer">
          <Download className="mr-2 h-4 w-4" />
          Download invoice
        </a>
      </Button>
      <Button asChild variant="outline">
        <a href={`/api/admin/orders/${orderId}/invoice?format=html`} rel="noreferrer" onClick={(event) => {
          event.preventDefault()
          window.open(`/api/admin/orders/${orderId}/invoice?format=html`, "_blank", "noopener,noreferrer")
        }}>
          <FileText className="mr-2 h-4 w-4" />
          View invoice
        </a>
      </Button>
      <Button asChild variant="outline">
        <a href={`/api/admin/orders/${orderId}/export`}>
          <Download className="mr-2 h-4 w-4" />
          Export order
        </a>
      </Button>
    </div>
  )
}
