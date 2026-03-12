"use client"

import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"

export function OrderPrintAction({ href }: { href?: string }) {
    return (
        <Button
            variant="outline"
            onClick={() => {
                if (typeof window === "undefined") return
                if (href) {
                    const popup = window.open(href, "_blank", "noopener,noreferrer")
                    if (popup) {
                        popup.addEventListener("load", () => popup.print(), { once: true })
                    }
                    return
                }
                window.print()
            }}
        >
            <Printer className="mr-2 h-4 w-4" /> Print
        </Button>
    )
}
