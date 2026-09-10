# Cloudflare deployment and operations

## Current production

- URL: https://fubao.mraz2766.workers.dev
- Worker: `fubao`; D1: `fubao` (`485b0dc5-48ac-4a37-8ffb-db1d51984d37`); R2: private `fubao`, APAC, Standard.
- Workers Free confirmed in dashboard on 2026-09-10. R2 public access disabled, no bucket custom domains.
- Migrations 0001-0004 applied; 1,324 exercises, 4,421 country/China-region/city locations, 12 scenic spots.
- Initial deployment used local build + Wrangler. GitHub integration is now connected to `mraz2766/fubao`, production branch `main`; preview builds disabled. Owner completed the GitHub app and Cloudflare build-token authorization.
- Build `bb9d4d5b-43a1-4634-80ae-03c57d715a16` was automatically triggered by push of `804d6fd` and succeeded, deploying version `8710de1b-ba71-4b3e-9a37-c46a012f3ff3`. GitHub Actions provides an independent check workflow; Cloudflare performs deployment.

## Provision once (new account or fork)

1. Create/sign in to Cloudflare, enable R2, and run `pnpm exec wrangler login`.
2. Run `pnpm exec wrangler d1 create fubao`. Replace the placeholder database ID in `wrangler.jsonc`.
3. Run `pnpm exec wrangler r2 bucket create fubao`. Keep the bucket private, with no public `r2.dev` access or bucket domain.
4. Set `APP_ENV` to `production`. There is no authentication bypass based on this flag.
5. Run `pnpm db:migrate:remote` and `pnpm db:init --remote`. Initialization uses the documented defaults or the `FUBAO_USERNAME` / `FUBAO_PASSWORD` environment variables; it never resets an existing account.
6. Explicitly run `pnpm data:sync:fitness --remote` and `pnpm data:sync:locations --country=CN --remote` and `pnpm data:sync:scenic --remote`.
7. Run `pnpm build` and `pnpm exec wrangler deploy`.

The adapter generates the final deployment configuration. Build and deploy from the same checkout/environment; do not reuse a build across environments.

## GitHub → Workers Builds

Connect the Worker to `mraz2766/fubao`. Use Workers, not Pages.

| Setting           | Value                                                       |
| ----------------- | ----------------------------------------------------------- |
| Production branch | `main`                                                      |
| Root directory    | `/`                                                         |
| Build command     | `pnpm install --frozen-lockfile && pnpm test && pnpm build` |
| Deploy command    | `pnpm deploy:ci`                                            |
| Node              | `24`                                                        |

`deploy:ci` applies D1 migrations then deploys the built Worker. Give the build integration the required Worker and D1 permissions. Runtime access uses native D1/R2 bindings, not credentials in React.

Use additive, backward-compatible migrations. Failed migrations stop deployment. Database synchronization and owner initialization are never part of automatic builds.

## Preview isolation

Create a second database and bucket, such as `fubao-preview` and `fubao-travel-preview`. Use a separate build configuration and Worker name. Never bind preview builds to production D1/R2. Keep branch auto-deployment disabled until isolation is configured; preview URLs should be private or contain synthetic data only.

## Domain and smoke checks

The requested workers.dev address is active and needs no DNS zone. For an additional custom domain, add the user's actual domain through Worker Settings → Domains & Routes → Custom Domain. The domain must be managed in the Cloudflare account.

- Verify login, logout, password changes, limiting and session revocation.
- Confirm private records and direct photo URLs return 404 anonymously.
- Publish a record and verify anonymous summaries; make it private again and verify access is revoked.
- Test image encoding, upload, ordering and lightbox on a physical mobile device.
- Download/import a JSON backup against the same storage.
- Verify scheduled cleanup and PWA installation.

Password hashing consumes CPU intentionally. Verify deployed request CPU usage and configure an appropriate Workers limit/plan; local response latency alone does not validate production CPU limits.

## Storage cleanup

The custom Worker runs `15 19 * * *` UTC daily. Deletion first hides the record, then queues R2 object deletions in D1. Failures retain attempts and errors for retry. Unattached uploads expire after 24 hours. Owner-only `POST /api/travel/cleanup` processes one batch manually with the same-origin CSRF header.

## Backup and restore

Settings JSON excludes password hashes and sessions. It includes records, templates, favorites, wishlist, widgets, preferences, data-source versions and R2 references.

Import is resumable and atomic per record. Existing IDs are skipped; failures remain in the result. Import required exercise/location catalogs first. Missing photo objects reject the affected trip.

For full deployment migration, use `pnpm exec wrangler d1 export fubao --remote --output <backup.sql>` and back up R2 independently through supported R2/S3 tooling. Preserve user IDs and object keys. The in-app JSON is not a photo archive.

## Logs and rollback

Use `pnpm exec wrangler tail` and Workers observability. Inspect request failures, CPU duration, D1 errors and `storage_cleanup_jobs`. Application logs do not print passwords or raw EXIF.

Rollback code through deployment history. Code rollback does not reverse D1 migrations. Keep schema changes compatible and take a database backup before destructive changes.

No VPS or persistent Node server is required. Node is only used for development, build, tests and explicit maintenance scripts.

## Free allowance

Workers Free is $0. R2 Standard includes 10 GB-month storage, 1 million Class A and 10 million Class B operations monthly; it is metered, not a hard zero-cost cap. D1 Free has 100,000 written rows/day, including index writes. Avoid full global imports on production in one day. See https://developers.cloudflare.com/r2/pricing/ and https://developers.cloudflare.com/d1/platform/pricing/.

## Fitness recording upgrade

Migration `0005_fitness_recording.sql` adds revisions and recording types without rewriting previous training data. Workout updates use atomic revision guards plus changed-row writes; empty planned sets are allowed, completed sets require valid metrics. Automatic saves wait 800 ms after input and serialize requests. Draft/active workouts stay excluded from visitor queries and statistics. There is no offline write queue: only server-confirmed saves survive a refresh.

Run `pnpm data:sync:fitness-media --dry-run` to validate the pinned image mappings; run without the flag for local D1 or add `--remote` for production. The script builds static WebP assets and approved D1 media associations. Source images are fetched only by this explicit command, never during builds or page requests. Keep `data/exercise-media-mapping.json`, `src/data/exercise-media.json`, static assets, and license notices together. Unmapped exercises remain available with body diagrams and instructions.

The first release maps 18 common exercises (36 pose images + 18 thumbnails, approximately 1 MB). It does not claim image coverage for all 1,324 metadata records. Similar names with different grip/equipment were excluded. Add new mappings only after comparing movement and equipment.
