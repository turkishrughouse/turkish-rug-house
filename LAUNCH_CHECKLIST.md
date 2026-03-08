# Production Launch Checklist

## Preflight
- [ ] `npm install` completed without errors
- [ ] `.env` values verified against `.env.example`
- [ ] Required env set (`DATABASE_URL`, `AUTH_SECRET/NEXTAUTH_SECRET`, `NEXT_PUBLIC_APP_URL`)
- [ ] Build passes: `npm run build`
- [ ] DB backup taken: `./scripts/backup-db.sh`
- [ ] Uploads backup taken: `./scripts/backup-uploads.sh`

## Database / Migrations
- [ ] Prisma schema changes reviewed
- [ ] Migration/sync strategy confirmed for target environment
- [ ] DB connectivity verified from running app

## Functional Smoke Tests
- [ ] Homepage test (`/`)
- [ ] Collection/category test (`/category/[slug]` and `/shop`)
- [ ] Product detail test (`/product/[slug]`)
- [ ] Cart test (`/basket`)
- [ ] Contact form test (`/info/contact` and message API flow)
- [ ] Admin login test (`/admin/login`)
- [ ] Admin product/media pages open without runtime error
- [ ] API health test (`/api/health`)
- [ ] 404 page test (`/not-a-real-page`)
- [ ] Error page fallback test

## Image System
- [ ] Admin upload accepts valid files only
- [ ] Oversized/invalid format upload is rejected with clear message
- [ ] Uploaded image variants generated (`thumb`, `large`, `master`)
- [ ] Product image rendered correctly on list/detail pages
- [ ] Cache headers for `/uploads/*` verified

## CDN / Edge
- [ ] `UPLOAD_PUBLIC_BASE_URL` set if CDN is used
- [ ] CDN path mapping tested for `/uploads/*`
- [ ] Cloudflare/CDN cache policy validated for immutable assets

## Rollback Readiness
- [ ] Rollback commit/tag identified
- [ ] Latest DB and uploads backup verified
- [ ] Rollback steps reviewed in `OPERATIONS.md`

