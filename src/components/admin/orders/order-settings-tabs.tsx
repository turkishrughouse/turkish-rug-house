"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const settingSections = [
  { key: "general", label: "General" },
  { key: "shipping", label: "Shipping" },
  { key: "payments", label: "Payments" },
  { key: "accounts-privacy", label: "Accounts & Privacy" },
  { key: "emails", label: "Emails" },
  { key: "advanced", label: "Advanced" },
]

export function OrderSettingsTabs() {
  const pathname = usePathname()

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-max items-center gap-2 border-b border-[#dce3ed] pb-3">
        {settingSections.map((section) => {
          const href = `/dashboard/orders/settings/${section.key}`
          const isActive = pathname === href

          return (
            <Link
              key={section.key}
              href={href}
              className={`rounded-md border px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-[#dce3ed] bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {section.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
