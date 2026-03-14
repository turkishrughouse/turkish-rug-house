import { getSiteUrl } from "@/lib/site-url"

type PasswordResetEmailInput = {
  recipientName: string
  resetLink: string
  expiresInMinutes: number
  supportEmail: string
  siteName?: string
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export function buildPasswordResetEmail(input: PasswordResetEmailInput) {
  const siteName = input.siteName?.trim() || "Turkish Rug House"
  const recipientName = input.recipientName.trim() || "Customer"
  const safeLink = escapeHtml(input.resetLink)
  const safeSupportEmail = escapeHtml(input.supportEmail)
  const safeSiteName = escapeHtml(siteName)
  const siteUrl = getSiteUrl()

  return {
    subject: `Reset your ${siteName} password`,
    text: [
      `Hello ${recipientName},`,
      "",
      `We received a request to reset the password for your ${siteName} account.`,
      "",
      `Reset your password: ${input.resetLink}`,
      "",
      `This link will expire in ${input.expiresInMinutes} minutes and can be used once.`,
      "If you did not request this change, you can ignore this email and your password will remain unchanged.",
      "",
      `Need help? Contact us at ${input.supportEmail}.`,
      `${siteName} | ${siteUrl}`,
    ].join("\n"),
    html: `
      <div style="margin:0;background:#f3f4f6;padding:32px 16px;font-family:Arial,sans-serif;color:#0f172a;">
        <div style="margin:0 auto;max-width:640px;overflow:hidden;border:1px solid #e2e8f0;border-radius:20px;background:#ffffff;">
          <div style="background:#0f766e;padding:28px 32px;color:#ffffff;">
            <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.84;">${safeSiteName}</div>
            <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;">Reset your password</h1>
          </div>
          <div style="padding:32px;">
            <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Hello ${escapeHtml(recipientName)},</p>
            <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">
              We received a request to reset the password for your ${safeSiteName} account.
            </p>
            <p style="margin:0 0 24px;font-size:16px;line-height:1.7;">
              Use the button below to choose a new password. This link expires in ${input.expiresInMinutes} minutes and can only be used once.
            </p>
            <div style="margin:0 0 24px;">
              <a
                href="${safeLink}"
                style="display:inline-block;border-radius:999px;background:#0f766e;padding:14px 24px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;"
              >
                Reset Password
              </a>
            </div>
            <div style="margin:0 0 24px;border-radius:14px;background:#f8fafc;padding:16px 18px;">
              <div style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#475569;">Security note</div>
              <p style="margin:0;font-size:14px;line-height:1.7;color:#334155;">
                If you did not request this change, you can ignore this email and your password will remain unchanged.
              </p>
            </div>
            <p style="margin:0 0 8px;font-size:14px;line-height:1.7;color:#334155;">
              If the button does not open, copy and paste this link into your browser:
            </p>
            <p style="margin:0 0 24px;word-break:break-word;font-size:14px;line-height:1.7;">
              <a href="${safeLink}" style="color:#0f766e;text-decoration:underline;">${safeLink}</a>
            </p>
            <p style="margin:0;font-size:14px;line-height:1.7;color:#475569;">
              Need help? Contact <a href="mailto:${safeSupportEmail}" style="color:#0f766e;">${safeSupportEmail}</a>.
            </p>
          </div>
          <div style="border-top:1px solid #e2e8f0;background:#f8fafc;padding:18px 32px;font-size:12px;line-height:1.7;color:#64748b;">
            ${safeSiteName}<br />
            <a href="${escapeHtml(siteUrl)}" style="color:#0f766e;text-decoration:none;">${escapeHtml(siteUrl)}</a>
          </div>
        </div>
      </div>
    `.trim(),
  }
}
