import type { Metadata } from "next"
import { PageBanner } from "@/components/storefront/page-banner"
import { PageContentAlternating } from "@/components/storefront/page-content-alternating"

export const metadata: Metadata = {
  title: "Shipping & Delivery | Turkish Rug House",
  description: "Free worldwide shipping on all orders. US delivery 5–10 business days, international 10–20 business days. Fully tracked and carefully packaged.",
}

const CONTENT = `
<h2>Free Worldwide Shipping</h2>
<p>We offer free shipping on every order with no minimum required. Whether you are ordering from the United States, Europe, or anywhere else in the world, your rug ships at no additional cost.</p>

<h2>Processing Time</h2>
<p>All orders are processed within <strong>1–3 business days</strong>. Once your order is dispatched, you will receive a tracking number by email so you can follow your shipment at every step.</p>

<h2>Delivery Times</h2>
<ul>
  <li><strong>United States:</strong> 5–10 business days via FedEx or UPS</li>
  <li><strong>International:</strong> 10–20 business days depending on destination</li>
</ul>
<p>Delivery estimates may vary during peak seasons or due to carrier delays outside our control.</p>

<h2>Packaging</h2>
<p>Every rug is hand-rolled and wrapped in protective packaging to ensure it arrives in perfect condition. We take care in how each piece is prepared for shipment — your rug deserves to travel well.</p>

<h2>Tracking & Signature</h2>
<p>A tracking number is sent to your email address once your order dispatches. For orders over <strong>$500</strong>, a signature is required upon delivery to ensure safe receipt.</p>

<h2>Import Duties & Taxes</h2>
<p>For international orders, any applicable import duties, customs fees, or local taxes are the responsibility of the buyer. These charges vary by country and are not included in your order total. We recommend checking with your local customs office if you have questions about potential charges.</p>

<h2>Questions?</h2>
<p>If you have any questions about your shipment or need a special delivery arrangement, contact us at <a href="mailto:info@turkishrughouse.com">info@turkishrughouse.com</a> — we are happy to help.</p>
`

export default function ShippingPage() {
  return (
    <main className="min-h-screen bg-white pb-16">
      <PageBanner
        title="Shipping & Delivery"
        subtitle="Free worldwide shipping on every order. Carefully packed and fully tracked."
      />
      <PageContentAlternating html={CONTENT} />
    </main>
  )
}
