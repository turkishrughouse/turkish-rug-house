import { notFound } from "next/navigation"
import { OrderSettingsSectionForm } from "@/components/admin/orders/order-settings-section-form"

const sectionLabels = {
  general: "General",
  shipping: "Shipping",
  payments: "Payments",
  "accounts-privacy": "Accounts & Privacy",
  emails: "Emails",
  advanced: "Advanced",
} as const

export default async function OrderSettingSectionPage({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = await params
  if (!(section in sectionLabels)) notFound()
  const typedSection = section as keyof typeof sectionLabels

  return <OrderSettingsSectionForm section={typedSection} label={sectionLabels[typedSection]} />
}
