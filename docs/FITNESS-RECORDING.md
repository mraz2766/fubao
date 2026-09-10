# Fitness recording update — 2026-09-10

## Delivered

- Separate start-now, backfill, and quick-entry paths. Draft and active sessions open directly in a resumable workspace; completed quick entries can gain exercises.
- Multi-select exercise picker, inline detail navigation, retained selection across search, existing-exercise positioning, and library-to-session adding.
- Recording-type-specific inputs, next-set inheritance, copying, ordering, completion validation, summaries and explicit handling of unfinished sets.
- Debounced serialized saves, partial planned sets, changed-row D1 writes, atomic revision guards, idempotent mutation retries, and protection against stale saves recreating deleted workouts.
- Configured-timezone editing; cross-midnight backfill. Total volume and PR exclude explicit non-weight recording types.
- Eighteen reviewed common-exercise image mappings, 36 static pose images, 18 thumbnails, and licensed anterior/posterior SVG anatomy. All 1,324 exercise metadata records remain searchable; unmapped exercises have anatomy and instructions.

## Verification

- Astro strict check and production build passed.
- 44 Vitest tests passed, including partial-set validation, recording metrics, configured timezone conversion, DST gaps and posterior muscle mapping.
- Full 12-scenario Playwright suite passed after restarting the production preview; subsequent focused seven-scenario pass covers the final recording changes plus a new discard/restore scenario (13 distinct E2E scenarios overall).
- Desktop/mobile at 320, 390, 768 and 1440 px, Chinese/English, light/dark, axe accessibility, privacy, template copies, JSON restoration, conflict and duplicate completion checked.
- Fresh SQLite database accepted all migrations; local and remote D1 accepted migration 0005. Production exercise-media associations imported explicitly.

## Boundaries

Only acknowledged server saves survive refresh. Save failures retain inputs in the open page and provide retry; there is no offline write queue. No rest timer or pause accounting is included. Visual QA uses browser emulation; a physical-device keyboard/PWA check remains useful after release.

Deployment uses the existing GitHub main → Cloudflare Workers Builds pipeline. No paid plan or additional cloud service was enabled for this change.
