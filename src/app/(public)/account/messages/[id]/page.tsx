import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth-server"
import { AccountMessageThread } from "@/components/storefront/account/account-message-thread"

export default async function AccountMessageThreadPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getSessionUser("customer")
  if (!user) redirect("/account/auth")

  const { id } = await params

  return (
    <AccountMessageThread
      user={{
        id: user.id,
        email: user.email,
        name: user.name,
      }}
      messageId={id}
    />
  )
}
