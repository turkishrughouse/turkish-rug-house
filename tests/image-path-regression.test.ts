const assert = require("node:assert/strict")
const {
  getProductImageUrl,
  normalizeProductImageRecords,
  parseProductImages,
  parseProductImageRecords,
} = require("../src/lib/product-images")
const { shouldPreservePersistedProductImagePaths } = require("../src/lib/media-folders")

type ProductCategory = {
  id: string
  title: string
  slug: string
}

type GalleryImage = {
  src: string
  zoomSrc: string
  thumbSrc: string
}

const SKU = "TRHAH33302"
const HISTORICAL_FOLDER = `/uploads/oushak-rugs/vintage-oushak-rugs/${SKU}`
const WRONG_CURRENT_CATEGORY_FOLDER = `/uploads/oushak-rugs/large-oushak/${SKU}`

const categoryA: ProductCategory = {
  id: "cat-a",
  title: "Large Oushak",
  slug: "large-oushak",
}

const persistedImages = [
  {
    image_url: `${HISTORICAL_FOLDER}/image1-large.webp`,
    variants: {
      thumb: `${HISTORICAL_FOLDER}/image1-thumb.webp`,
      large: `${HISTORICAL_FOLDER}/image1-large.webp`,
      master: `${HISTORICAL_FOLDER}/image1-master.webp`,
    },
    alt: "Vintage Oushak Rug",
    sort_order: 0,
    is_primary: true,
  },
  {
    image_url: `${HISTORICAL_FOLDER}/image2-large.webp`,
    variants: {
      thumb: `${HISTORICAL_FOLDER}/image2-thumb.webp`,
      large: `${HISTORICAL_FOLDER}/image2-large.webp`,
      master: `${HISTORICAL_FOLDER}/image2-master.webp`,
    },
    alt: "Vintage Oushak Rug detail",
    sort_order: 1,
    is_primary: false,
  },
]

const persistedJson = JSON.stringify(persistedImages)
const inferredMasterOnlyJson = JSON.stringify([
  {
    image_url: `${HISTORICAL_FOLDER}/image3-master.webp`,
    alt: "Vintage Oushak Rug close-up",
    sort_order: 0,
    is_primary: true,
  },
])
const inferredMasterOnlyStringJson = JSON.stringify([
  `${HISTORICAL_FOLDER}/image4-master.webp`,
])

function test(name: string, fn: () => void) {
  try {
    fn()
    process.stdout.write(`PASS ${name}\n`)
  } catch (error) {
    process.stderr.write(`FAIL ${name}\n`)
    throw error
  }
}

function buildDetailGallery(images: string, _categories: ProductCategory[]): GalleryImage[] {
  const records = parseProductImageRecords(images)
  return records.map((image: { image_url: string; variants?: { thumb?: string; large?: string; master?: string } }) => ({
    src: getProductImageUrl(image, "large") || "/placeholder.jpg",
    zoomSrc: getProductImageUrl(image, "master") || getProductImageUrl(image, "large") || "/placeholder.jpg",
    thumbSrc: getProductImageUrl(image, "thumb") || getProductImageUrl(image, "large") || "/placeholder.jpg",
  }))
}

function buildSeoImages(images: string) {
  return parseProductImageRecords(images)
    .map((image: { image_url: string; variants?: { thumb?: string; large?: string; master?: string } }) => getProductImageUrl(image, "master") || getProductImageUrl(image, "large"))
    .filter(Boolean)
}

function replaceManagedUrlFolder(url: string | undefined, newFolder: string) {
  if (!url) return ""
  const fileName = url.split("/").pop() || ""
  return `${newFolder}/${fileName}`
}

function brokenCategoryRewrite(images: typeof persistedImages, targetFolder: string) {
  return images.map((image) => ({
    ...image,
    image_url: image.image_url,
    variants: {
      thumb: replaceManagedUrlFolder(image.variants?.thumb || image.image_url, targetFolder),
      large: replaceManagedUrlFolder(image.variants?.large || image.image_url, targetFolder),
      master: replaceManagedUrlFolder(image.variants?.master || image.image_url, targetFolder),
    },
  }))
}

test("normalization preserves persisted historical paths exactly", () => {
  const normalized = normalizeProductImageRecords(persistedJson)

  assert.equal(normalized[0]?.image_url, `${HISTORICAL_FOLDER}/image1-large.webp`)
  assert.equal(normalized[0]?.variants?.thumb, `${HISTORICAL_FOLDER}/image1-thumb.webp`)
  assert.equal(normalized[0]?.variants?.large, `${HISTORICAL_FOLDER}/image1-large.webp`)
  assert.equal(normalized[0]?.variants?.master, `${HISTORICAL_FOLDER}/image1-master.webp`)
  assert.ok(!normalized[0]?.variants?.large?.includes("/large-oushak/"))
})

test("product detail gallery uses persisted historical folder for main, thumb, and zoom images", () => {
  const gallery = buildDetailGallery(persistedJson, [categoryA])

  assert.equal(gallery[0]?.src, `${HISTORICAL_FOLDER}/image1-large.webp`)
  assert.equal(gallery[0]?.thumbSrc, `${HISTORICAL_FOLDER}/image1-thumb.webp`)
  assert.equal(gallery[0]?.zoomSrc, `${HISTORICAL_FOLDER}/image1-master.webp`)
  assert.equal(gallery[1]?.src, `${HISTORICAL_FOLDER}/image2-large.webp`)
  assert.ok(gallery.every((image) => !image.src.includes("/large-oushak/")))
})

test("product cards and list consumers use persisted large variant without category rewrite", () => {
  const storefrontImages = parseProductImages(persistedJson)

  assert.deepEqual(storefrontImages, [
    `${HISTORICAL_FOLDER}/image1-large.webp`,
    `${HISTORICAL_FOLDER}/image2-large.webp`,
  ])
  assert.ok(storefrontImages.every((url: string) => !url.includes("/large-oushak/")))
})

test("variant selection infers thumb and large siblings from persisted master paths without rewriting folders", () => {
  const inferredGallery = buildDetailGallery(inferredMasterOnlyJson, [categoryA])
  const thumbImages = parseProductImages(inferredMasterOnlyJson, "thumb")
  const largeImages = parseProductImages(inferredMasterOnlyJson, "large")

  assert.equal(inferredGallery[0]?.src, `${HISTORICAL_FOLDER}/image3-large.webp`)
  assert.equal(inferredGallery[0]?.thumbSrc, `${HISTORICAL_FOLDER}/image3-thumb.webp`)
  assert.equal(inferredGallery[0]?.zoomSrc, `${HISTORICAL_FOLDER}/image3-master.webp`)
  assert.deepEqual(thumbImages, [`${HISTORICAL_FOLDER}/image3-thumb.webp`])
  assert.deepEqual(largeImages, [`${HISTORICAL_FOLDER}/image3-large.webp`])
  assert.ok(thumbImages.every((url: string) => !url.endsWith("-master.webp")))
  assert.ok(largeImages.every((url: string) => !url.endsWith("-master.webp")))
})

test("string-based persisted master paths also resolve to storefront thumb and large variants", () => {
  assert.deepEqual(parseProductImages(inferredMasterOnlyStringJson, "thumb"), [
    `${HISTORICAL_FOLDER}/image4-thumb.webp`,
  ])
  assert.deepEqual(parseProductImages(inferredMasterOnlyStringJson, "large"), [
    `${HISTORICAL_FOLDER}/image4-large.webp`,
  ])
  assert.equal(
    getProductImageUrl(`${HISTORICAL_FOLDER}/image4-master.webp`, "large"),
    `${HISTORICAL_FOLDER}/image4-large.webp`
  )
})

test("seo and structured data image output uses persisted master paths", () => {
  const seoImages = buildSeoImages(persistedJson)

  assert.deepEqual(seoImages, [
    `${HISTORICAL_FOLDER}/image1-master.webp`,
    `${HISTORICAL_FOLDER}/image2-master.webp`,
  ])
  assert.ok(seoImages.every((url: string) => !url.includes("/large-oushak/")))
})

test("legacy migration is blocked when persisted upload paths already exist", () => {
  assert.equal(
    shouldPreservePersistedProductImagePaths([
      `${HISTORICAL_FOLDER}/image1-large.webp`,
      `${HISTORICAL_FOLDER}/image2-large.webp`,
    ]),
    true
  )
})

test("broken category-based rewrite would have produced the wrong folder", () => {
  const broken = brokenCategoryRewrite(persistedImages, WRONG_CURRENT_CATEGORY_FOLDER)

  assert.equal(
    broken[0]?.variants?.large,
    `${WRONG_CURRENT_CATEGORY_FOLDER}/image1-large.webp`
  )
  assert.notEqual(
    broken[0]?.variants?.large,
    `${HISTORICAL_FOLDER}/image1-large.webp`
  )
})

console.log(`Verified regression coverage for SKU ${SKU}`)
