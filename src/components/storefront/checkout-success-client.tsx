"use client"

import { useEffect } from "react"
import { clearCart } from "@/lib/storefront/cart"

export function CheckoutSuccessClient() {
  useEffect(() => {
    clearCart()
  }, [])

  return null
}
