"use client"

import { ReactNode } from "react"
import { Header } from "@/components/storefront/header"
import { Footer } from "@/components/storefront/footer"

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />
      <main className="pt-16">{children}</main>
      <Footer />
    </div>
  )
}
