export const PASSWORD_RESET_PATH = "/account/reset-password"

export function getPasswordResetUrl(token: string) {
  const search = new URLSearchParams()
  if (token) search.set("token", token)
  const query = search.toString()
  return `${PASSWORD_RESET_PATH}${query ? `?${query}` : ""}`
}
