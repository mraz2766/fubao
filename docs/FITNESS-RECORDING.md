# Fitness recording — 2026-09-10

## Daily use

Fitness opens on Today. Choose a common training item to create a completed, private check-in. Today/yesterday/calendar select the date. There is no required name, duration, start/end time, exercise, or measurement. Suggestions rank the owner's last 90 days by frequency and recency; initial ordering is cardio, back, chest, legs, shoulders, arms, core, other.

After saving, Add details updates the same record. Undo removes that new record. Log another explicitly starts another check-in. An in-memory idempotency receipt prevents double taps and ambiguous retry responses from creating duplicates.

Start workout opens a live workspace or offers to resume an existing session. Choose categories or exercises before completing. Every set measurement is optional; Log set explicitly acknowledges a completed set. Planned/untouched sets stay unfinished and remain available after completion. Valid measurement input does not silently complete a set. Number presets, weight increments, recent measurements, and previous-set inheritance reduce typing.

Add details contains duration presets, date, optional exact times, name and note. Exact times only persist after the user enters them; there is no fictional default duration. Public/private controls remain in completed-record details. Autosaves are serialized with an 800 ms debounce; structure changes submit immediately. Error/conflict states preserve input. Only server-confirmed saves survive refresh; no offline write queue is provided.

## Data and compatibility

Migration 0006 adds `workout_date`, `time_precision` (`date` or `exact`) and nullable `duration_seconds`. Existing records default to exact and retain all timestamps. Date-only check-ins store a noon timestamp in their recording timezone solely to satisfy the legacy non-null column and sort within the day. `workoutDay` uses the explicit date for these records; `knownWorkoutSeconds` never infers elapsed time from their anchor.

A completed session requires a training category or an exercise. Legacy JSON without the new fields is normalized on import; uncategorized old quick records become Other without renaming. Schema version remains 1 with optional additive fields. Export excludes credentials and sessions.

Frequency/streak include check-ins without measurements. Volume requires completed weight × reps. Maximum-weight PR permits weight alone; Epley 1RM still needs eligible reps. Missing metrics render as unknown, not as a measured zero. Only completed, explicitly public records enter visitor data; ongoing sessions remain private.

## Verification and release

`pnpm test`, `pnpm build`, and `pnpm exec playwright test` cover optional measurements, date precision/timezones, cross-midnight edits, live recovery, failed-save retries, revision conflicts, duplicate completion/check-in, private access, templates, old/new JSON and responsive accessibility.

Push main → existing Cloudflare Workers Builds → tests/build → explicit D1 migrations → Worker deployment. This update requires no new paid service. Browser-based mobile testing does not replace a physical-device keyboard/PWA check.
