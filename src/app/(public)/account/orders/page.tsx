import { redirect } from "next/navigation"

export default function AccountOrdersPage() {
  redirect("/account?tab=orders")
}

