# Messages Module - Webhook Setup Guide

This guide explains how to configure webhook integrations for Email and WhatsApp messages.

## Email Webhook Setup (Mailgun)

### 1. Configure Mailgun

1. Log in to your [Mailgun dashboard](https://app.mailgun.com/)
2. Go to **Sending** → **Domains**
3. Select your domain
4. Navigate to **Webhooks** section
5. Add a new webhook for **Inbound Messages**:
   - **URL**: `https://yourdomain.com/api/messages/email/webhook`
   - **Method**: POST

### 2. Get Webhook Signing Key

1. In Mailgun dashboard, go to **Settings** → **Webhooks**
2. Copy the **HTTP webhook signing key**
3. Add to your `.env` file:
   ```
   WEBHOOK_SECRET_EMAIL=your_mailgun_signing_key_here
   ```

### 3. Configure Inbound Routes

1. Go to **Receiving** → **Routes**
2. Create a new route:
   - **Expression Type**: Match Recipient
   - **Recipient**: `*@yourdomain.com` (or specific address like `contact@yourdomain.com`)
   - **Actions**: 
     - Forward to: `https://yourdomain.com/api/messages/email/webhook`
     - Store and notify: `https://yourdomain.com/api/messages/email/webhook`

### 4. Test Email Webhook

Send a test email to your configured address:
```bash
curl -X POST https://yourdomain.com/api/messages/email/webhook \
  -F 'from=Test User <test@example.com>' \
  -F 'subject=Test Email' \
  -F 'body-plain=This is a test message' \
  -F 'Message-Id=<test-123@example.com>' \
  -F 'timestamp=1234567890' \
  -F 'token=test-token' \
  -F 'signature=test-signature'
```

---

## WhatsApp Webhook Setup

### 1. Create Meta Business Account

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create a new app or use existing one
3. Add **WhatsApp** product to your app

### 2. Get WhatsApp Credentials

1. In your app dashboard, go to **WhatsApp** → **Configuration**
2. Note down:
   - **App Secret** (from Settings → Basic)
   - Create a **Verify Token** (any random string you choose)

3. Add to your `.env` file:
   ```
   WHATSAPP_VERIFY_TOKEN=your_chosen_verify_token
   WHATSAPP_APP_SECRET=your_app_secret_here
   ```

### 3. Configure Webhook

1. In WhatsApp Configuration, go to **Webhook**
2. Click **Configure Webhook**:
   - **Callback URL**: `https://yourdomain.com/api/messages/whatsapp/webhook`
   - **Verify Token**: (same as `WHATSAPP_VERIFY_TOKEN` in your .env)
3. Subscribe to webhook fields:
   - ✅ `messages`
   - ✅ `message_status` (optional)

### 4. Test WhatsApp Webhook

Verify webhook challenge:
```bash
curl "https://yourdomain.com/api/messages/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=your_verify_token&hub.challenge=test_challenge"
```

Send test message payload:
```bash
curl -X POST https://yourdomain.com/api/messages/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: sha256=test_signature" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [{
        "value": {
          "messaging_product": "whatsapp",
          "metadata": {
            "display_phone_number": "15551234567",
            "phone_number_id": "PHONE_NUMBER_ID"
          },
          "contacts": [{
            "profile": {
              "name": "Test User"
            },
            "wa_id": "15559876543"
          }],
          "messages": [{
            "from": "15559876543",
            "id": "wamid.test123",
            "timestamp": "1234567890",
            "type": "text",
            "text": {
              "body": "Test WhatsApp message"
            }
          }]
        },
        "field": "messages"
      }]
    }]
  }'
```

---

## Contact Form Setup

The contact form is already integrated and ready to use. Simply add the component to any page:

```tsx
import { ContactForm } from "@/components/storefront/contact-form"

export default function ContactPage() {
  return (
    <div className="container py-12">
      <ContactForm />
    </div>
  )
}
```

---

## Environment Variables Reference

Required environment variables in `.env`:

```env
# Database
DATABASE_URL="file:./dev.db"

# Email Webhook (Mailgun)
WEBHOOK_SECRET_EMAIL=your_mailgun_signing_key

# WhatsApp Business API
WHATSAPP_VERIFY_TOKEN=your_chosen_verify_token
WHATSAPP_APP_SECRET=your_meta_app_secret

# Application URL
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

---

## Troubleshooting

### Email Webhook Not Receiving Messages

1. Check Mailgun logs in dashboard
2. Verify webhook URL is publicly accessible
3. Ensure `WEBHOOK_SECRET_EMAIL` matches Mailgun signing key
4. Check server logs for errors: `console.log` statements in webhook route

### WhatsApp Webhook Verification Failing

1. Ensure `WHATSAPP_VERIFY_TOKEN` matches exactly what you entered in Meta dashboard
2. Check that webhook URL is HTTPS (required by Meta)
3. Verify app is in Development or Live mode

### Messages Not Appearing in Admin Panel

1. Check browser console for SSE connection errors
2. Verify database has the message (use Prisma Studio: `npx prisma studio`)
3. Check server logs for API errors
4. Ensure admin panel is connected to SSE stream (`/api/admin/messages/stream`)

### Real-time Updates Not Working

1. Check browser supports EventSource (SSE)
2. Verify SSE endpoint is accessible: open `http://localhost:3000/api/admin/messages/stream` in browser
3. Check for CORS issues if frontend and backend are on different domains
4. Look for connection errors in browser Network tab

---

## Security Notes

- **Never commit** `.env` file to version control
- Use **strong, random** values for `WHATSAPP_VERIFY_TOKEN`
- Always verify webhook signatures in production
- Implement rate limiting on public endpoints
- PII is automatically masked in logs
- Use HTTPS in production for all webhook endpoints
