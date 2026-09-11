# Direct recording iteration

The primary flow is a persistent selection, not a form wizard. Fitness keeps four frequent items visible and restores the selected day's most recently updated completed session. A second item patches that session; only “Record another” starts a new one. Ongoing workouts remain separate.

## Fitness state and APIs

- `GET /api/fitness/day?date=YYYY-MM-DD` is owner-only and returns lightweight session headers, the current record, the current week's count and five recent receipts. Exercise graphs load only in the workspace. Both SSR and date changes select the most recently updated record for that day.
- `PATCH /api/fitness/sessions/:id` accepts `revision`, `mutation_id`, optional `body_parts` and optional nullable `duration_seconds`. At least one change is required. Unknown fields are rejected. Duration presets apply only to date-precision records; exact start/end timestamps are edited in the workspace.
- A conditional D1 update protects revisions and leaves exercises, sets, custom names, timestamps and notes untouched. Automatic titles follow selected training items. Retry receipts reuse the mutation ID.
- Requests run serially. Pending selections merge; a failed request retains both its retry payload and later choices. A conflict preserves local input until the user explicitly reloads. Unsaved changes alone trigger leave warnings.
- Completing a set collapses it and opens the next pending group, inheriting weight/reps only when a new group is needed. Optional fields may stay empty. The new pending group and template plans do not count until explicitly confirmed.

## Photos first

“Record trip” opens the native file picker during the button gesture. Canceling creates no entry. Links with `?new=1` open the composer with a photo input because browsers require a fresh user gesture to launch a native picker. Existing trips open directly for editing.

The composer foregrounds photos, collapses a selected location and keeps dates optional. Photo organization controls appear only in arrange mode. EXIF suggestions use the first available date/location and never overwrite a manually selected value. Suggestions still require confirmation. Existing 80 MB input limits, 1–6 photos, HEIC conversion, output validation and private R2 authorization remain unchanged.

## Layout and data access

Bencho's checklist, progress ticks and inline notifications informed the interactions; code is independently implemented with the existing CSS, SVG and Lucide stack. No Bencho assets, code or runtime dependencies are bundled.

The homepage remains SSR with its existing greeting and entrance motion. Seven compact bars represent actual daily completed-session counts and link to the matching history day. Widget sizes remain automatic. Home and Today use lightweight header queries; session API lists, travel timelines and photo walls paginate in SQL. Date-only records retain calendar dates; exact timestamps respect the configured timezone, including midnight DST gaps.

No D1 migration, backup schema change or new service is required. Release through GitHub main and the existing Cloudflare Workers Builds connection. Regression evidence and loading measurements are recorded in `UI-PERFORMANCE.md`.
