"use client"

import { Facebook, Instagram, Linkedin, MessageCircle, Send } from "lucide-react"
import { toast } from "sonner"

export function ProductDetailShare({
  title,
}: {
  title: string
}) {
  const getShareUrl = () => {
    if (typeof window === "undefined") return ""
    return window.location.href
  }

  const openShare = (url: string) => {
    if (typeof window === "undefined") return
    window.open(url, "_blank", "noopener,noreferrer,width=720,height=640")
  }

  return (
    <div className="mt-4 flex items-center gap-3 text-slate-700">
      <span className="font-semibold text-slate-900">Share:</span>
      <button type="button" onClick={() => openShare(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getShareUrl())}`)} className="rounded-md border border-[#dce3ed] p-2 text-[#1877F2] hover:bg-slate-50 hover:scale-105 transition-transform"><Facebook className="h-4 w-4" /></button>
      <button type="button" onClick={() => openShare(`https://twitter.com/intent/tweet?url=${encodeURIComponent(getShareUrl())}&text=${encodeURIComponent(title)}`)} className="rounded-md border border-[#dce3ed] p-2 text-black hover:bg-slate-50 hover:scale-105 transition-transform"><span className="text-sm font-semibold">X</span></button>
      <button type="button" onClick={() => openShare(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(getShareUrl())}`)} className="rounded-md border border-[#dce3ed] p-2 text-[#0A66C2] hover:bg-slate-50 hover:scale-105 transition-transform"><Linkedin className="h-4 w-4" /></button>
      <button
        type="button"
        onClick={async () => {
          if (typeof window === "undefined") return
          const shareUrl = getShareUrl()
          try {
            await navigator.clipboard.writeText(shareUrl)
            toast.success("Link copied. Paste it on Instagram.")
          } catch {
            toast.info("Copy the product URL and paste it on Instagram.")
          }
          window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer")
        }}
        className="rounded-md border border-[#dce3ed] p-2 text-[#E4405F] hover:bg-slate-50 hover:scale-105 transition-transform"
      >
        <Instagram className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => openShare(`https://t.me/share/url?url=${encodeURIComponent(getShareUrl())}&text=${encodeURIComponent(title)}`)} className="rounded-md border border-[#dce3ed] p-2 text-[#0088cc] hover:bg-slate-50 hover:scale-105 transition-transform"><Send className="h-4 w-4" /></button>
      <button type="button" onClick={() => openShare(`https://api.whatsapp.com/send?text=${encodeURIComponent(`${title} ${getShareUrl()}`)}`)} className="rounded-md border border-[#dce3ed] p-2 text-[#25D366] hover:bg-slate-50 hover:scale-105 transition-transform"><MessageCircle className="h-4 w-4" /></button>
    </div>
  )
}
