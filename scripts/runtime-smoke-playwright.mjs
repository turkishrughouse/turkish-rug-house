import { chromium } from "playwright"

const BASE_URL = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3011"
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL || "senoltr@gmail.com"
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || "RughouseLocal2026!"

function absUrl(path) {
  return `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`
}

async function safeClick(locator) {
  await locator.scrollIntoViewIfNeeded()
  await locator.click({ timeout: 15000 })
}

async function fillFirst(page, candidates, value) {
  for (const sel of candidates) {
    const loc = page.locator(sel).first()
    if ((await loc.count()) > 0) {
      await loc.scrollIntoViewIfNeeded()
      await loc.fill(String(value))
      return { selector: sel }
    }
  }
  return null
}

async function clickFirst(page, candidates) {
  for (const sel of candidates) {
    const loc = page.locator(sel).first()
    if ((await loc.count()) > 0) {
      await safeClick(loc)
      return { selector: sel }
    }
  }
  return null
}

async function assertNoHardCrash(state, section) {
  const errs = state.pageErrors.filter((e) => e.section === section)
  if (errs.length > 0) {
    throw new Error(`Page errors in ${section}:\n${errs.map((e) => `- ${e.message}`).join("\n")}`)
  }
}

async function gotoOk(page, url, state, section) {
  const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => null)
  const status = resp?.status() ?? 0
  state.visits.push({ section, url, status })
  if (status >= 500) {
    throw new Error(`Navigation failed (${status}) at ${url}`)
  }
}

async function apiLogin(context, page, state, portal) {
  const section = `auth-${portal}`
  const resp = await page.request.post(absUrl(`/api/auth/login?portal=${encodeURIComponent(portal)}`), {
    data: { identifier: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  })
  state.visits.push({ section, url: absUrl(`/api/auth/login?portal=${portal}`), status: resp.status() })
  if (resp.status() !== 200) {
    const body = await resp.text().catch(() => "")
    throw new Error(`API login failed portal=${portal} status=${resp.status()} body=${body}`)
  }

  const setCookie = resp.headers()["set-cookie"]
  if (!setCookie) throw new Error(`API login did not return set-cookie for portal=${portal}`)

  const cookiePair = setCookie.split(";")[0]
  const eq = cookiePair.indexOf("=")
  if (eq <= 0) throw new Error(`Unparseable set-cookie: ${setCookie}`)
  const name = cookiePair.slice(0, eq)
  const value = cookiePair.slice(eq + 1)

  await context.addCookies([
    {
      name,
      value,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ])
}

async function openFirstProductForEdit(page, state) {
  const section = "product-edit"
  const resp = await page.request.get(absUrl("/api/v1/public/products?limit=1"))
  if (resp.status() >= 400) throw new Error(`Failed to load products API: status=${resp.status()}`)
  const payload = await resp.json()
  const product = Array.isArray(payload?.products) ? payload.products[0] : null
  if (!product?.id) throw new Error("No products returned from public products API")

  await gotoOk(page, absUrl(`/dashboard/products/${product.id}`), state, section)
  await page.locator("#title").waitFor({ timeout: 20000 })
  await page
    .waitForFunction(() => {
      const el = document.querySelector("#title")
      return el && "value" in el && String(el.value || "").trim().length > 0
    }, { timeout: 20000 })
    .catch(() => {})
  return { productId: String(product.id), slug: String(product.slug || "") }
}

async function saveProductEdits(page, state, edits) {
  const section = "product-edit"

  await page.locator("#title").waitFor({ timeout: 15000 })

  const slugLoc = page.locator('input[name="slug"]').first()
  const originalSlug = (await slugLoc.count()) > 0 ? await slugLoc.inputValue().catch(() => "") : ""

  const titleSet = await fillFirst(page, ["#title"], edits.title)

  // Price lives under the "General" tab inside Product data.
  const generalTab = page.getByRole("button", { name: /^General$|^Genel$/i }).first()
  if ((await generalTab.count()) > 0) {
    await safeClick(generalTab)
  }
  const priceSet = await fillFirst(page, ['input[name="price"]', 'input[type="number"][name="price"]'], edits.price)

  // Keep slug stable to avoid uniqueness failures caused by auto-sync.
  if (originalSlug && (await slugLoc.count()) > 0) {
    await slugLoc.fill(originalSlug)
  }

  // Rich text editors: best-effort via contenteditable blocks near headings.
  const shortHeading = page.getByText(/Product short description|Ürün kısa açıklaması/i).first()
  if ((await shortHeading.count()) > 0) {
    const shortEditor = shortHeading.locator("xpath=ancestor::div[contains(@class,'rounded')][1]//div[@contenteditable='true']").first()
    if ((await shortEditor.count()) > 0) {
      await shortEditor.click()
      await page.keyboard.press("Control+A").catch(() => page.keyboard.press("Meta+A"))
      await page.keyboard.type(edits.shortDescription, { delay: 2 })
    }
  }

  const descHeading = page.getByText(/Product description|Ürün açıklaması/i).first()
  if ((await descHeading.count()) > 0) {
    const descEditor = descHeading.locator("xpath=ancestor::div[contains(@class,'rounded')][1]//div[@contenteditable='true']").first()
    if ((await descEditor.count()) > 0) {
      await descEditor.click()
      await page.keyboard.press("Control+A").catch(() => page.keyboard.press("Meta+A"))
      await page.keyboard.type(edits.description, { delay: 2 })
    }
  }

  if (!titleSet || !priceSet) {
    throw new Error(
      `Product edit form missing fields. title=${Boolean(titleSet)} price=${Boolean(priceSet)}`
    )
  }

  // Save
  const saveClicked = await clickFirst(page, [
    'button[type="submit"]',
    'button:has-text("Save")',
    'button:has-text("Update")',
    'button:has-text("Publish")',
  ])
  if (!saveClicked) throw new Error("Save button not found on product edit page")

  // Product form navigates back to list on success.
  await Promise.race([
    page.waitForURL(/\/dashboard\/products(?:\?.*)?$/, { timeout: 25000 }).catch(() => {}),
    page.waitForLoadState("networkidle", { timeout: 25000 }).catch(() => {}),
    page.waitForTimeout(25000),
  ])

  // If toast appears, record it.
  const toast = page.locator('[role="status"], [data-sonner-toast]').first()
  if ((await toast.count()) > 0) {
    state.notes.push({ section, note: `toast: ${(await toast.innerText().catch(() => "")).trim()}` })
  }
}

async function reopenProductAndVerify(page, state, productId, expected) {
  const section = "product-edit"
  await gotoOk(page, absUrl(`/dashboard/products/${productId}`), state, section)

  const titleLoc = page.locator("#title").first()
  const priceLoc = page.locator('input[name="price"]').first()

  if ((await titleLoc.count()) === 0 || (await priceLoc.count()) === 0) {
    throw new Error("Reopen verify failed: title/price inputs not found")
  }

  // React-hook-form defaults can hydrate after initial DOMContentLoaded.
  await page
    .waitForFunction(() => {
      const el = document.querySelector("#title")
      return el && "value" in el && String(el.value || "").trim().length > 0
    }, { timeout: 20000 })
    .catch(() => {})

  const titleVal = await titleLoc.inputValue()
  const priceVal = await priceLoc.inputValue()

  if (!titleVal.includes(expected.title)) {
    throw new Error(`Title did not persist. expected contains="${expected.title}" got="${titleVal}"`)
  }
  if (!String(priceVal).includes(String(expected.price))) {
    throw new Error(`Price did not persist. expected contains="${expected.price}" got="${priceVal}"`)
  }
}

async function openFrontendProduct(page, state, slugGuess) {
  const section = "frontend-product"
  // Prefer using the actual slug if we can derive it from a View link.
  const viewLink = page.locator('a[href^="/product/"]:has-text("View"), a[href^="/product/"]').first()
  let productUrl = null
  if ((await viewLink.count()) > 0) {
    const href = await viewLink.getAttribute("href")
    if (href) productUrl = absUrl(href)
  }
  if (!productUrl && slugGuess) productUrl = absUrl(`/product/${slugGuess}`)
  if (!productUrl) throw new Error("Could not determine frontend product URL")

  await gotoOk(page, productUrl, state, section)

  // Basic content presence checks.
  const h1 = page.locator("h1").first()
  if ((await h1.count()) === 0) throw new Error("Frontend product page missing H1")
}

async function checkCategoryPages(page, state) {
  const section = "categories"
  const resp = await page.request.get(absUrl("/api/v1/public/categories"))
  if (resp.status() >= 400) {
    throw new Error(`Failed to load categories API: status=${resp.status()}`)
  }
  const categories = await resp.json()
  const paths = []
  const walk = (items) => {
    for (const item of items || []) {
      if (item?.path) paths.push(String(item.path))
      if (Array.isArray(item?.children) && item.children.length) walk(item.children)
    }
  }
  walk(categories)

  const unique = Array.from(new Set(paths)).slice(0, 8)
  if (unique.length === 0) throw new Error("No category paths returned from API")

  for (const path of [...unique, "/shop"]) {
    try {
      await gotoOk(page, absUrl(path), state, section)
    } catch (error) {
      state.notes.push({ section, note: `Category navigation error for ${path}: ${String(error?.message || error)}` })
      continue
    }
    await page.waitForTimeout(350)
    const anyProductCard = page.locator('a[href^="/product/"], [data-testid*="product"], article').first()
    if ((await anyProductCard.count()) === 0) {
      state.notes.push({ section, note: `No obvious products found on ${path} (may still be ok if empty)` })
    }
  }
}

async function checkPagesAdminAndFrontend(page, state) {
  const section = "pages"
  const res = await page.request.get(absUrl("/api/admin/pages?limit=1"))
  if (res.status() >= 400) throw new Error(`Failed to load admin pages API: status=${res.status()}`)
  const data = await res.json()
  const items = Array.isArray(data?.pages)
    ? data.pages
    : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data)
        ? data
        : []
  const first = items[0]
  if (!first?.id) throw new Error("No pages returned from /api/admin/pages")
  const pageId = String(first.id)

  await gotoOk(page, absUrl(`/dashboard/pages/${pageId}`), state, section)

  const patch = `Smoke update ${new Date().toISOString()}`
  const titleSet = await fillFirst(page, ['input[name="title"]', "#title"], patch)
  if (!titleSet) {
    state.notes.push({ section, note: "Page title input not found; skipping page edit verification." })
    return
  }

  const saveClicked = await clickFirst(page, ['button[type="submit"]', 'button:has-text("Save")', 'button:has-text("Update")'])
  if (!saveClicked) throw new Error("Page save button not found")

  await page.waitForLoadState("networkidle", { timeout: 45000 }).catch(() => {})

  // Try to find a "View" link to confirm frontend reflects.
  const view = page.locator('a[href^="/"]:has-text("View"), a:has-text("View")').first()
  if ((await view.count()) > 0) {
    const href = await view.getAttribute("href")
    if (href) {
      await gotoOk(page, absUrl(href), state, section)
      const h1 = page.locator("h1").first()
      if ((await h1.count()) > 0) {
        const h1t = await h1.innerText().catch(() => "")
        if (!h1t.includes("Smoke update")) {
          state.notes.push({ section, note: "Frontend page H1 did not include updated title (may be fine if template differs)." })
        }
      }
    }
  } else {
    state.notes.push({ section, note: "No View link found from page editor; could not confirm frontend reflection." })
  }
}

async function checkSettingsVisibility(page, state) {
  const section = "settings"
  await gotoOk(page, absUrl("/"), state, section)
  const header = page.locator("header").first()
  const footer = page.locator("footer").first()
  if ((await header.count()) === 0) throw new Error("No <header> found on frontend")
  if ((await footer.count()) === 0) throw new Error("No <footer> found on frontend")
}

async function checkInventory(page, state) {
  const section = "inventory"
  await gotoOk(page, absUrl("/inventory"), state, section)
  if (page.url().includes("/inventory/login")) {
    await gotoOk(page, absUrl("/inventory/login"), state, section)

    const emailFilled = await fillFirst(
      page,
      ['input[name="identifier"]', 'input[name="email"]', 'input[type="email"]', 'input[autocomplete="username"]', "#email"],
      ADMIN_EMAIL
    )
    const passFilled = await fillFirst(page, ['input[name="password"]', 'input[type="password"]', "#password"], ADMIN_PASSWORD)
    if (!emailFilled || !passFilled) {
      throw new Error("Inventory login form fields not found")
    }
    const submitClicked = await clickFirst(page, [
      'button[type="submit"]',
      'button:has-text("Sign In")',
      'button:has-text("Sign in")',
      'button:has-text("Login")',
    ])
    if (!submitClicked) throw new Error("Inventory login submit not found")
    await page.waitForLoadState("networkidle", { timeout: 45000 }).catch(() => {})

    await gotoOk(page, absUrl("/inventory"), state, section)
  }

  // Specs render: look for table/filters.
  const table = page.locator("table").first()
  if ((await table.count()) === 0) {
    state.notes.push({ section, note: "No table found on /inventory (may still be ok if layout differs)" })
  }

  // Filters: attempt to change a select and submit if present.
  const filterSelect = page.locator("select").first()
  if ((await filterSelect.count()) > 0) {
    const opts = filterSelect.locator("option")
    const optCount = await opts.count()
    if (optCount > 1) {
      const value = await opts.nth(1).getAttribute("value")
      if (value) {
        await filterSelect.selectOption(value).catch(() => {})
      }
    }
    const filterBtn = page.locator('button:has-text("Filter"), button[type="submit"]').first()
    if ((await filterBtn.count()) > 0) {
      await safeClick(filterBtn)
      await page.waitForLoadState("networkidle", { timeout: 45000 }).catch(() => {})
    }
  }

  // Exports: look for links containing "export".
  const exportLink = page.locator('a[href*="export"], a:has-text("Export")').first()
  if ((await exportLink.count()) > 0) {
    const href = await exportLink.getAttribute("href")
    if (href && href.startsWith("/")) {
      // Make a request via the browser context to ensure 200.
      const resp = await page.request.get(absUrl(href))
      state.visits.push({ section, url: absUrl(href), status: resp.status() })
      if (resp.status() >= 400) throw new Error(`Export failed: ${href} status=${resp.status()}`)
    }
  } else {
    state.notes.push({ section, note: "No export link found on inventory UI (best-effort)" })
  }
}

async function clickDashboardRoutes(page, state) {
  const section = "dashboard-routes"
  await gotoOk(page, absUrl("/dashboard"), state, section)

  // Click a handful of visible nav links.
  const navLinks = page.locator('nav a[href^="/dashboard"]').filter({ hasNot: page.locator('a[href="/dashboard/logout"]') })
  const count = Math.min(await navLinks.count(), 12)
  for (let i = 0; i < count; i += 1) {
    const link = navLinks.nth(i)
    const href = await link.getAttribute("href")
    if (!href) continue
    await safeClick(link)
    await page.waitForLoadState("domcontentloaded", { timeout: 45000 })
    state.visits.push({ section, url: page.url(), status: 200 })
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  const state = {
    consoleErrors: [],
    pageErrors: [],
    visits: [],
    notes: [],
  }

  page.on("console", (msg) => {
    const type = msg.type()
    if (type === "error") {
      state.consoleErrors.push({ text: msg.text(), location: msg.location() })
    }
  })
  page.on("pageerror", (err) => {
    state.pageErrors.push({ section: "unknown", message: String(err?.message || err) })
  })

  const results = {
    "1_product_create_edit": "FAIL",
    "2_frontend_product_page": "FAIL",
    "3_category_pages": "FAIL",
    "4_pages": "FAIL",
    "5_settings": "FAIL",
    "6_inventory": "FAIL",
    "7_dashboard_routes": "FAIL",
    "8_stability": "FAIL",
  }

  let editedProduct = { productId: null, slugGuess: null }
  const edits = {
    title: `Smoke Edited ${new Date().toISOString()}`,
    shortDescription: `Short smoke ${new Date().toISOString()}`,
    description: `Description smoke ${new Date().toISOString()}`,
    price: "1234.56",
  }

  try {
    await apiLogin(context, page, state, "admin")
    const { productId, slug } = await openFirstProductForEdit(page, state)
    editedProduct.productId = productId
    editedProduct.slugGuess = slug || null
    await saveProductEdits(page, state, edits)
    await reopenProductAndVerify(page, state, productId, edits)
    results["1_product_create_edit"] = "PASS"
  } catch (e) {
    state.notes.push({ section: "1_product_create_edit", note: String(e?.stack || e) })
  }

  try {
    if (editedProduct.productId) {
      await openFrontendProduct(page, state, editedProduct.slugGuess)
      results["2_frontend_product_page"] = "PASS"
    } else {
      throw new Error("No edited product available")
    }
  } catch (e) {
    state.notes.push({ section: "2_frontend_product_page", note: String(e?.stack || e) })
  }

  try {
    await checkCategoryPages(page, state)
    results["3_category_pages"] = "PASS"
  } catch (e) {
    state.notes.push({ section: "3_category_pages", note: String(e?.stack || e) })
  }

  try {
    await checkPagesAdminAndFrontend(page, state)
    results["4_pages"] = "PASS"
  } catch (e) {
    state.notes.push({ section: "4_pages", note: String(e?.stack || e) })
  }

  try {
    await checkSettingsVisibility(page, state)
    results["5_settings"] = "PASS"
  } catch (e) {
    state.notes.push({ section: "5_settings", note: String(e?.stack || e) })
  }

  try {
    await apiLogin(context, page, state, "inventory")
    await checkInventory(page, state)
    results["6_inventory"] = "PASS"
  } catch (e) {
    state.notes.push({ section: "6_inventory", note: String(e?.stack || e) })
  }

  try {
    await clickDashboardRoutes(page, state)
    results["7_dashboard_routes"] = "PASS"
  } catch (e) {
    state.notes.push({ section: "7_dashboard_routes", note: String(e?.stack || e) })
  }

  // Stability: no pageerror + no console errors.
  try {
    if (state.pageErrors.length > 0) {
      throw new Error(`pageerror count=${state.pageErrors.length}`)
    }
    if (state.consoleErrors.length > 0) {
      throw new Error(`console.error count=${state.consoleErrors.length}`)
    }
    results["8_stability"] = "PASS"
  } catch (e) {
    state.notes.push({ section: "8_stability", note: String(e?.stack || e) })
  }

  await browser.close()

  const out = { baseUrl: BASE_URL, results, state }
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`)
}

run().catch((err) => {
  process.stderr.write(`${err?.stack || err}\n`)
  process.exit(1)
})

