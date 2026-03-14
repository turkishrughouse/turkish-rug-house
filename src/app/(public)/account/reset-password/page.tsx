import { ResetPasswordForm } from "./reset-password-form"

export const dynamic = "force-dynamic"

type ResetPasswordPageProps = {
  searchParams?: Promise<{
    token?: string | string[]
  }>
}

function getToken(token: string | string[] | undefined) {
  return typeof token === "string" ? token : Array.isArray(token) ? token[0] || "" : ""
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const token = getToken(resolvedSearchParams?.token)

  return <ResetPasswordForm token={token} />
}
