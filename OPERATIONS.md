# Turkish Rug House - Operations Guide

## 1) Environment
Required in production:
- `DATABASE_URL`
- `AUTH_SECRET` (or `NEXTAUTH_SECRET`)
- `NEXT_PUBLIC_APP_URL`

Image/storage related:
- `STORAGE_PROVIDER=local` (current)
- `UPLOAD_PUBLIC_BASE_URL` (optional CDN/domain)
- `UPLOAD_MAX_FILE_SIZE_MB`
- `UPLOAD_MIN_WIDTH`
- `UPLOAD_MIN_HEIGHT`
- `UPLOAD_ENABLE_AVIF`

The app validates environment on startup in [`src/lib/env.ts`](/Users/senolsevim/Documents/Siteler/RugHouse/src/lib/env.ts). Missing required values fail fast.

## 2) Backup Before Deploy
Run from repo root:

```bash
./scripts/backup-db.sh
./scripts/backup-uploads.sh
```

Artifacts:
- `backups/db/db-YYYYMMDD-HHMMSS.sqlite`
- `backups/uploads/uploads-YYYYMMDD-HHMMSS.tar.gz`

## 3) Deploy Sequence
1. Pull latest code.
2. Install deps: `npm install`
3. Run build: `npm run build`
4. Start app: `npm run start`
5. Run smoke tests from `LAUNCH_CHECKLIST.md`.

## 4) Rollback (Basic)
1. Stop app process.
2. Checkout previous stable release/commit.
3. Restore DB backup (replace sqlite file referenced by `DATABASE_URL`).
4. Restore uploads backup:
   - extract `.tar.gz` to `public/uploads`.
5. Install deps and restart.

## 5) Image Architecture Notes
- App stores only image references (URLs/paths), never binary/blob/base64 in DB.
- Upload pipeline generates `thumb`, `large`, `master` variants.
- Media registry table (`MediaAsset`) stores normalized fields:
  - `image_url`, `width`, `height`, `alt`, `sort_order`, `is_primary`
- Storage provider abstraction is under `src/lib/storage/*` for future S3/R2/Bunny adapters.

