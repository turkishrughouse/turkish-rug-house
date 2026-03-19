import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionUser } from "@/lib/auth-server"
import {
  deleteCustomerAddress,
  getCustomerAddressBook,
  setDefaultCustomerAddress,
  upsertCustomerAddress,
} from "@/lib/customer-addresses"

const addressSchema = z.object({
  id: z.string().optional(),
  label: z.string().max(80).optional(),
  fullName: z.string().max(160).optional(),
  phoneNumber: z.string().max(40).optional(),
  country: z.string().max(120).optional(),
  countryCode: z.string().max(12).optional(),
  state: z.string().max(120).optional(),
  city: z.string().max(120).optional(),
  addressLine1: z.string().max(255).optional(),
  addressLine2: z.string().max(255).optional(),
  postalCode: z.string().max(40).optional(),
  makeDefaultShipping: z.boolean().optional(),
  makeDefaultBilling: z.boolean().optional(),
})

const deleteSchema = z.object({
  id: z.string().min(1),
})

const defaultSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["shipping", "billing"]),
})

export async function GET() {
  const user = await getSessionUser("customer")
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const data = await getCustomerAddressBook(user.id)
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser("customer")
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const parsed = addressSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid address payload" }, { status: 400 })
  }
  const data = await upsertCustomerAddress(user.id, parsed.data, {
    makeDefaultShipping: parsed.data.makeDefaultShipping,
    makeDefaultBilling: parsed.data.makeDefaultBilling,
  })
  return NextResponse.json({ success: true, ...data })
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser("customer")
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json().catch(() => null)
  const parsedDefault = defaultSchema.safeParse(body)
  if (parsedDefault.success) {
    const data = await setDefaultCustomerAddress(user.id, parsedDefault.data.id, parsedDefault.data.kind)
    return NextResponse.json({ success: true, ...data })
  }

  const parsedAddress = addressSchema.safeParse(body)
  if (!parsedAddress.success) {
    return NextResponse.json({ error: parsedAddress.error.issues[0]?.message || "Invalid address payload" }, { status: 400 })
  }
  const data = await upsertCustomerAddress(user.id, parsedAddress.data, {
    makeDefaultShipping: parsedAddress.data.makeDefaultShipping,
    makeDefaultBilling: parsedAddress.data.makeDefaultBilling,
  })
  return NextResponse.json({ success: true, ...data })
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser("customer")
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const parsed = deleteSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid delete payload" }, { status: 400 })
  }
  const data = await deleteCustomerAddress(user.id, parsed.data.id)
  return NextResponse.json({ success: true, ...data })
}
