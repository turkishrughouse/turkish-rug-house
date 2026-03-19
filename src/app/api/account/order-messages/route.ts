import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth-server"
import { listOrderThreadsForCustomer } from "@/lib/order-messaging"

export async function GET() {
  const user = await getSessionUser("customer")
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const threads = await listOrderThreadsForCustomer(user.id, user.email)
  return NextResponse.json({ threads })
}
