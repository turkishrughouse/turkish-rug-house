Product recovery from uploaded media

Dry run:

```bash
npm run recover:products -- --sku=TRHAH36064
npm run recover:products
```

Write to the database:

```bash
npm run recover:products -- --write
```

Notes:

- The script scans `public/uploads` for SKU-style folders that contain product image variants.
- It rebuilds `Product` rows without deleting existing data.
- Existing products are only enriched with missing images, missing SKU/description/title, and inferred category links.
- The first recovered image group becomes the primary image and uses the first `master`/`large` variant group as the lead image.
