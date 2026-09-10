# Color and performance update — 2026-09-10

## Interface

Animata MIT components are adapted locally, pinned to commit `de9aabb0eed14e0db944bb07720961ddc450c672`. See `src/components/animata/README.md`, About, and `/licenses/animata.txt`.

Slide Arrow links provide a clear primary action. Tilted Cover frames travel photography without hiding it behind hover. Coral, teal, violet and ink-blue surfaces distinguish the four dashboard modules; related colors are reused on training choices, completed sets, travel statistics and navigation. Text/background colors switch together during theme changes to preserve contrast. Motion is CSS-based, keyboard/touch-compatible, with reduced-motion overrides. No animation runtime or new React island is added to the homepage.

## Performance changes

- Discovery cards request only their 640 px thumbnails; large scenic images load in the detail dialog.
- Dashboard travel uses a thumbnail instead of a large personal photo.
- World geometry is generated from local Natural Earth data by `pnpm exec tsx scripts/render-world-map.ts` (also run explicitly after map-data sync). Generated paths use one decimal of precision and a content-hashed static SVG.
- The closed homepage map does not request geometry; expanding it loads the shared SVG. No private country/visit data is in the static resource.
- Related workout/travel rows are read with D1 batches, giving one round trip and a consistent snapshot per collection. Owner resolution moves into the SQL; unnecessary settings reads are skipped on APIs that do not use preferences. Authentication remains uncached.
- Static geometry receives immutable caching; approved exercise/scenery assets have bounded caching. Personal HTML, API responses, exports and photos retain private/no-store behavior.

## Measurements

Local Workers production preview, Chromium, 1440×1024, same page-navigation sequence before/after:

| Measure                                                 |      Before |     After |
| ------------------------------------------------------- | ----------: | --------: |
| Homepage HTML, gzip                                     |    63,698 B |   4,528 B |
| Travel first-load subresource transfer (excluding HTML) | 2,484,334 B | 503,822 B |

The image savings are about 80%; moving/defer-loading map geometry cuts initial HTML by about 93%. Source measurements/screenshots are under ignored `output/playwright/`. These are controlled local measurements, not field INP or a guarantee of workers.dev latency from every network. The E2E performance test also records mobile LCP/CLS and enforces a 150 KB gzip JavaScript budget.

Interaction QA also removed the stretched-card-link hit area from above the expandable map and photo cover, so their click/tap targets work independently.

Final validation: 46 Vitest tests; 17 distinct E2E scenarios verified, with focused reruns after contrast/hit-area and recording-type fixes. Astro strict check/build passed without diagnostics. Controlled mobile home measurement: LCP 860 ms, CLS 0, initial JavaScript 503 B gzip (390×844, 4× CPU throttle, 150 ms latency, 200 KB/s). All six migrations were also applied successfully to a fresh SQLite database; migration 0006 was applied to local D1.
