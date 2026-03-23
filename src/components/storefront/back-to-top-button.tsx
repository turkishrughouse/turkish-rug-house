"use client"

import { useEffect, useState } from "react"
import { ChevronUp } from "lucide-react"

export function BackToTopButton() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 520)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  if (!visible) return null

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-24 right-4 z-[280] inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white/95 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.12)] backdrop-blur hover:bg-slate-50 md:bottom-6 md:right-6"
      aria-label="Back to top"
      title="Top"
    >
      <ChevronUp className="h-5 w-5" />
    </button>
  )
}
