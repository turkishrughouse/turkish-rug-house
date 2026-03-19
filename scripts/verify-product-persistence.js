const { chromium } = require("playwright")
const { PrismaClient } = require("@prisma/client")

const BASE_URL = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3011"
const EMAIL = process.env.SMOKE_ADMIN_EMAIL || "smoke-admin@lab.local"
const PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || "RughouseLocal2026!"

async function apiLogin(page, portal) {
  const res = await page.request.post(`${BASE_URL}/api/auth/login?portal=${encodeURIComponent(portal)}`, {
    data: { identifier: EMAIL, password: PASSWORD },
  })
  if (res.status() !== 200) {
    throw new Error(`login failed portal=${portal} status=${res.status()} body=${await res.text()}`)
  }
}

async function dbSnapshot(prisma, id) {
  const row = await prisma.product.findUnique({
    where: { id },
    select: { id: true, title: true, slug: true, price: true, compareAtPrice: true, updatedAt: true },
  })
  if (!row) throw new Error(`product not found: ${id}`)
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    price: Number(row.price),
    compareAtPrice: row.compareAtPrice ? Number(row.compareAtPrice) : null,
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function run() {
  const prisma = new PrismaClient()
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  // Pick a real product from public API.
  const productsRes = await page.request.get(`${BASE_URL}/api/v1/public/products?limit=1`)
  const productsPayload = await productsRes.json()
  const product = productsPayload.products?.[0]
  if (!product?.id) throw new Error("No products returned from public API")
  const productId = product.id

  await apiLogin(page, "admin")

  const before = await dbSnapshot(prisma, productId)

  const firstTitle = `Persist 1 ${Date.now()}`
  const firstPrice = "1111.11"

  // Navigate from products list (reopen path under real UX).
  await page.goto(`${BASE_URL}/dashboard/products`, { waitUntil: "domcontentloaded" })
  await page.locator(`a[href="/dashboard/products/${productId}"]`).first().waitFor({ timeout: 20000 })
  await page.locator(`a[href="/dashboard/products/${productId}"]`).first().click()
  await page.locator("#title").waitFor({ timeout: 20000 })
  const slug = await page.locator('input[name="slug"]').inputValue().catch(() => "")

  await page.locator("#title").fill(firstTitle)
  await page.getByRole("button", { name: /^General$|^Genel$/i }).first().click()
  await page.locator('input[name="price"]').fill(firstPrice)
  if (slug) await page.locator('input[name="slug"]').fill(slug)

  const submit = page.locator('form button[type="submit"]').first()
  await submit.scrollIntoViewIfNeeded()
  await submit.click()
  await Promise.race([
    page.waitForURL(/\/dashboard\/products(?:\?.*)?$/, { timeout: 25000 }).catch(() => {}),
    page.locator("[data-sonner-toast]").first().waitFor({ timeout: 25000 }).catch(() => {}),
    page.waitForTimeout(25000),
  ])
  const toasts1 = await page
    .locator("[data-sonner-toast]")
    .evaluateAll((nodes) => nodes.map((n) => (n.textContent || "").trim()).filter(Boolean))
    .catch(() => [])

  const after1 = await dbSnapshot(prisma, productId)

  await page.goto(`${BASE_URL}/dashboard/products`, { waitUntil: "domcontentloaded" })
  await page.locator(`a[href="/dashboard/products/${productId}"]`).first().waitFor({ timeout: 20000 })
  await page.locator(`a[href="/dashboard/products/${productId}"]`).first().click()
  await page.locator("#title").waitFor({ timeout: 20000 })
  await page
    .waitForFunction(() => {
      const el = document.querySelector("#title")
      return el && "value" in el && String(el.value || "").trim().length > 0
    }, { timeout: 20000 })
    .catch(() => {})
  const reopenedTitle1 = await page.locator("#title").inputValue()
  await page.getByRole("button", { name: /^General$|^Genel$/i }).first().click()
  const reopenedPrice1 = await page.locator('input[name="price"]').inputValue()

  const secondTitle = `Persist 2 ${Date.now()}`
  const secondPrice = "2222.22"

  await page.locator("#title").fill(secondTitle)
  await page.locator('input[name="price"]').fill(secondPrice)
  if (slug) await page.locator('input[name="slug"]').fill(slug)

  const submit2 = page.locator('form button[type="submit"]').first()
  await submit2.scrollIntoViewIfNeeded()
  await submit2.click()
  await Promise.race([
    page.waitForURL(/\/dashboard\/products(?:\?.*)?$/, { timeout: 25000 }).catch(() => {}),
    page.locator("[data-sonner-toast]").first().waitFor({ timeout: 25000 }).catch(() => {}),
    page.waitForTimeout(25000),
  ])
  const toasts2 = await page
    .locator("[data-sonner-toast]")
    .evaluateAll((nodes) => nodes.map((n) => (n.textContent || "").trim()).filter(Boolean))
    .catch(() => [])

  const after2 = await dbSnapshot(prisma, productId)

  await page.goto(`${BASE_URL}/dashboard/products`, { waitUntil: "domcontentloaded" })
  await page.locator(`a[href="/dashboard/products/${productId}"]`).first().waitFor({ timeout: 20000 })
  await page.locator(`a[href="/dashboard/products/${productId}"]`).first().click()
  await page.locator("#title").waitFor({ timeout: 20000 })
  await page
    .waitForFunction(() => {
      const el = document.querySelector("#title")
      return el && "value" in el && String(el.value || "").trim().length > 0
    }, { timeout: 20000 })
    .catch(() => {})
  const reopenedTitle2 = await page.locator("#title").inputValue()
  await page.getByRole("button", { name: /^General$|^Genel$/i }).first().click()
  const reopenedPrice2 = await page.locator('input[name="price"]').inputValue()

  console.log(
    JSON.stringify(
      {
        productId,
        before,
        after1,
        reopened1: { title: reopenedTitle1, price: reopenedPrice1 },
        after2,
        reopened2: { title: reopenedTitle2, price: reopenedPrice2 },
        toasts1,
        toasts2,
      },
      null,
      2
    )
  )

  await browser.close()
  await prisma.$disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})

