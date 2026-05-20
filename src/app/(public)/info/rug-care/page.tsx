import type { Metadata } from "next"
import { PageBanner } from "@/components/storefront/page-banner"
import { PageContentAlternating } from "@/components/storefront/page-content-alternating"

export const metadata: Metadata = {
  title: "Rug Care Guide | Turkish Rug House",
  description: "How to care for your handwoven Turkish rug. Cleaning, maintenance, storage, and shedding guidance to keep your rug looking its best for generations.",
}

const CONTENT = `
<p>Handwoven Turkish rugs are built to last generations with the right care. Unlike machine-made rugs, each piece carries the character of natural fibres and hand-applied dyes — a little attention goes a long way toward preserving that quality for decades to come.</p>

<h2>Regular Maintenance</h2>
<ul>
  <li><strong>Vacuum weekly</strong> on a low setting, moving with the pile direction. Do not use a beater bar or rotating brush attachment, which can damage the fibres and loosen knots over time.</li>
  <li><strong>Rotate every 6–12 months</strong> to distribute foot traffic and light exposure evenly. This prevents one area from wearing faster than the rest.</li>
  <li><strong>Use a quality rug pad</strong> underneath to protect the rug, prevent slipping, and extend its lifespan by reducing friction against the floor.</li>
</ul>

<h2>Cleaning</h2>
<ul>
  <li><strong>Blot spills immediately</strong> — never rub. Work from the outside of the spill inward to prevent spreading. Use a clean, dry cloth to absorb as much liquid as possible.</li>
  <li><strong>Spot clean</strong> with cold water and a small amount of mild soap. Rinse thoroughly and allow to air dry flat, away from direct heat.</li>
  <li><strong>Professional cleaning every 1–2 years</strong> is recommended for rugs in high-traffic areas. A specialist who works with hand-knotted rugs will know how to treat natural dyes and wool correctly.</li>
  <li><strong>Never machine wash or steam clean</strong> a handwoven rug. Excessive water and heat can cause shrinkage, colour bleeding, and structural damage to the foundation.</li>
</ul>

<h2>Storage</h2>
<ul>
  <li><strong>Roll for storage</strong> — never fold. Folding puts stress along crease lines and can permanently damage the pile and foundation over time.</li>
  <li><strong>Wrap in breathable cotton</strong>, not plastic. Plastic traps moisture, which can lead to mildew and fibre damage.</li>
  <li><strong>Store in a cool, dry place</strong> away from direct sunlight, damp walls, and extreme temperature changes.</li>
</ul>

<h2>Shedding & Fading</h2>
<ul>
  <li><strong>Some shedding is normal</strong> for the first few months with a new wool rug. This is loose surface fibre and will reduce with regular vacuuming — it does not indicate a quality problem.</li>
  <li><strong>Protect from direct sunlight</strong> to slow fading. All natural dyes are susceptible to UV light over time, and prolonged direct exposure will affect colour richness.</li>
  <li><strong>Natural dye variation is authentic character.</strong> Slight tonal differences between sections of a rug are a natural result of hand-dyeing and are part of what makes each piece unique — not a defect.</li>
</ul>

<h2>Need Advice?</h2>
<p>If you have a question about caring for a specific rug or need guidance on a particular issue, contact us at <a href="mailto:info@turkishrughouse.com">info@turkishrughouse.com</a> — we are always happy to help.</p>
`

export default function RugCarePage() {
  return (
    <main className="min-h-screen bg-white pb-16">
      <PageBanner
        title="Rug Care Guide"
        subtitle="Everything you need to keep your handwoven Turkish rug looking its best for generations."
      />
      <PageContentAlternating html={CONTENT} />
    </main>
  )
}
