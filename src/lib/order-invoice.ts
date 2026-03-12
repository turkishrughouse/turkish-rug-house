import { formatOrderCurrency } from "@/lib/order-details"

type InvoiceItem = {
  title: string
  quantity: number
  price: number
}

type InvoiceOrder = {
  orderNumber: string
  createdAt: string | Date
  customerName: string | null
  customerEmail: string
  status: string
  details: {
    addressLine1?: string | null
    addressLine2?: string | null
    city?: string | null
    state?: string | null
    postcode?: string | null
    country?: string | null
    customerPhone?: string | null
    paymentMethod?: string | null
    paymentStatus?: string | null
    shippingMethod?: string | null
    shippingCost?: number
    subtotalAmount?: number
    taxAmount?: number
    discountAmount?: number
    refundedAmount?: number
    currency?: string
    invoiceNumber?: string | null
    invoiceIssuedAt?: string | null
  }
  items: InvoiceItem[]
  total: number
}

function invoiceLines(order: InvoiceOrder) {
  const currency = order.details.currency || "USD"
  const address = [
    order.details.addressLine1,
    order.details.addressLine2,
    [order.details.city, order.details.state].filter(Boolean).join(", "),
    [order.details.postcode, order.details.country].filter(Boolean).join(" "),
  ].filter(Boolean)
  const subtotal = Number(order.details.subtotalAmount || order.items.reduce((sum, item) => sum + item.price * item.quantity, 0))
  const shipping = Number(order.details.shippingCost || 0)
  const tax = Number(order.details.taxAmount || 0)
  const discount = Number(order.details.discountAmount || 0)

  return [
    "RugHouse Invoice",
    `Invoice: ${order.details.invoiceNumber || `INV-${order.orderNumber}`}`,
    `Order: ${order.orderNumber}`,
    `Date: ${new Date(order.createdAt).toLocaleDateString("en-US")}`,
    "",
    `Customer: ${order.customerName || "Customer"}`,
    `Email: ${order.customerEmail}`,
    `Phone: ${order.details.customerPhone || "-"}`,
    ...address.map((line) => String(line)),
    "",
    `Payment: ${order.details.paymentMethod || "-"} / ${order.details.paymentStatus || order.status}`,
    `Shipping: ${order.details.shippingMethod || "-"}`,
    "",
    "Items",
    ...order.items.map((item) => `${item.title} | Qty ${item.quantity} | ${formatOrderCurrency(item.price, currency)} | ${formatOrderCurrency(item.price * item.quantity, currency)}`),
    "",
    `Subtotal: ${formatOrderCurrency(subtotal, currency)}`,
    `Shipping: ${formatOrderCurrency(shipping, currency)}`,
    `Tax: ${formatOrderCurrency(tax, currency)}`,
    `Discount: ${formatOrderCurrency(discount, currency)}`,
    `Total: ${formatOrderCurrency(order.total, currency)}`,
  ]
}

function escapePdfText(input: string) {
  return input.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
}

export function buildInvoicePdf(order: InvoiceOrder) {
  const lines = invoiceLines(order)
  const contentLines = ["BT", "/F1 12 Tf", "50 780 Td"]
  lines.forEach((line, index) => {
    if (index === 0) {
      contentLines.push(`(${escapePdfText(line)}) Tj`)
      return
    }
    contentLines.push("0 -18 Td")
    contentLines.push(`(${escapePdfText(line)}) Tj`)
  })
  contentLines.push("ET")
  const stream = contentLines.join("\n")
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ]

  let pdf = "%PDF-1.4\n"
  const offsets: number[] = [0]
  objects.forEach((object, index) => {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += "0000000000 65535 f \n"
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`
  })
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  return Buffer.from(pdf, "utf-8")
}

export function buildInvoiceHtml(order: InvoiceOrder) {
  const currency = order.details.currency || "USD"
  const subtotal = Number(order.details.subtotalAmount || order.items.reduce((sum, item) => sum + item.price * item.quantity, 0))
  const shipping = Number(order.details.shippingCost || 0)
  const tax = Number(order.details.taxAmount || 0)
  const discount = Number(order.details.discountAmount || 0)
  const address = [
    order.details.addressLine1,
    order.details.addressLine2,
    [order.details.city, order.details.state].filter(Boolean).join(", "),
    [order.details.postcode, order.details.country].filter(Boolean).join(" "),
  ].filter(Boolean)

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice ${order.orderNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #0f172a; }
    .row { display:flex; justify-content:space-between; gap:24px; }
    table { width:100%; border-collapse:collapse; margin-top:24px; }
    th, td { border-bottom:1px solid #dce3ed; padding:10px 0; text-align:left; }
    th:last-child, td:last-child { text-align:right; }
    .totals { margin-top:24px; margin-left:auto; width:320px; }
    .totals div { display:flex; justify-content:space-between; padding:6px 0; }
  </style>
</head>
<body>
  <div class="row">
    <div>
      <h1>Invoice</h1>
      <div>Invoice: ${order.details.invoiceNumber || `INV-${order.orderNumber}`}</div>
      <div>Order: ${order.orderNumber}</div>
      <div>Date: ${new Date(order.createdAt).toLocaleDateString("en-US")}</div>
    </div>
    <div>
      <div><strong>${order.customerName || "Customer"}</strong></div>
      <div>${order.customerEmail}</div>
      ${address.map((line) => `<div>${line}</div>`).join("")}
    </div>
  </div>
  <table>
    <thead>
      <tr><th>Item</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr>
    </thead>
    <tbody>
      ${order.items.map((item) => `<tr><td>${item.title}</td><td>${item.quantity}</td><td>${formatOrderCurrency(item.price, currency)}</td><td>${formatOrderCurrency(item.price * item.quantity, currency)}</td></tr>`).join("")}
    </tbody>
  </table>
  <div class="totals">
    <div><span>Subtotal</span><span>${formatOrderCurrency(subtotal, currency)}</span></div>
    <div><span>Shipping</span><span>${formatOrderCurrency(shipping, currency)}</span></div>
    <div><span>Tax</span><span>${formatOrderCurrency(tax, currency)}</span></div>
    <div><span>Discount</span><span>${formatOrderCurrency(discount, currency)}</span></div>
    <div><strong>Total</strong><strong>${formatOrderCurrency(order.total, currency)}</strong></div>
  </div>
</body>
</html>`
}

