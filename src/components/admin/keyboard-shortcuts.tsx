"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

type AdminKeyboardShortcutsProps = {
  enabled: boolean
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName.toLowerCase()
  return tag === "input" || tag === "textarea" || tag === "select"
}

export function AdminKeyboardShortcuts({ enabled }: AdminKeyboardShortcutsProps) {
  const router = useRouter()
  const pendingGoRef = useRef(false)
  const timeoutRef = useRef<number | null>(null)
  const [active, setActive] = useState(enabled)

  useEffect(() => {
    setActive(enabled)
  }, [enabled])

  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".admin-shell")
    if (!shell) return

    const syncFromDataset = () => {
      const datasetValue = shell.dataset.adminShortcuts
      if (datasetValue === "on") setActive(true)
      if (datasetValue === "off") setActive(false)
    }

    syncFromDataset()
    const observer = new MutationObserver(syncFromDataset)
    observer.observe(shell, { attributes: true, attributeFilter: ["data-admin-shortcuts"] })

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!active) return

    const clearPending = () => {
      pendingGoRef.current = false
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return

      const key = event.key.toLowerCase()
      const editable = isEditableTarget(event.target)

      if (key === "/" && !editable) {
        event.preventDefault()
        const input = document.getElementById("admin-global-search") as HTMLInputElement | null
        input?.focus()
        input?.select()
        return
      }

      if (editable) return

      if (pendingGoRef.current) {
        if (key === "d") router.push("/dashboard")
        if (key === "o") router.push("/dashboard/orders")
        if (key === "m") router.push("/dashboard/messages")
        if (key === "p") router.push("/dashboard/profile")
        clearPending()
        return
      }

      if (key === "g") {
        pendingGoRef.current = true
        timeoutRef.current = window.setTimeout(() => {
          clearPending()
        }, 1000)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      clearPending()
    }
  }, [active, router])

  return null
}
