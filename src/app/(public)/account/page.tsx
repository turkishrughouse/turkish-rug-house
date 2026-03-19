import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth-server"
import { AccountDashboard } from "@/components/storefront/account/account-dashboard"

export default async function AccountPage() {
  const user = await getSessionUser("customer")
  if (!user) {
    redirect("/account/auth")
  }

  return (
    <AccountDashboard
      user={{
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      }}
    />
  )
}
