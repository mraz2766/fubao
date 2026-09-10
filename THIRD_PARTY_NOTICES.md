# Third-party notices

## Exercise metadata

- Source: https://github.com/hasaneyldrm/exercises-dataset
- Copyright (c) 2026 Hasan Emir Yıldırım.
- MIT covers code, dataset structure and instruction text/translations; a copy is retained in `data/licenses/exercises-MIT.txt`.
- Source commits are pinned in `data/sources.lock.json`; D1 records the checksum and imported version.
- Chinese titles are maintained in `data/exercise-names.zh-CN.json`, using terminology mappings and per-ID corrections. Original English names remain available.
- **Gym visual images and GIFs are excluded.** Cloning the source does not grant their media license. See https://github.com/hasaneyldrm/exercises-dataset/blob/main/LICENSE and https://gymvisual.com/content/3-terms-and-conditions-of-use .

## Location data

- Data by Countries States Cities Database: https://github.com/dr5hn/countries-states-cities-database
- Open Database License (ODbL) 1.0, retained in `data/licenses/locations-ODbL.txt`.
- The transformation is distributed in `scripts/import-locations.ts`; local translations and aliases are in `data/location-names.zh-CN.json` and `scripts/import-location-aliases.ts`.
- Derived location data remains under ODbL and is available through `/api/locations/export` and generated NDJSON. It contains no personal visits, photos or workout records.
- mledoze/countries was reviewed as an optional reference; this implementation does not import it.

## Map

- Natural Earth 1:110m country boundaries: https://www.naturalearthdata.com/
- Pinned mirror: https://github.com/nvkelso/natural-earth-vector
- Public domain: https://www.naturalearthdata.com/about/terms-of-use/
- The reduced GeoJSON contains country codes, names and boundaries. `data/map-manifest.json` records the source checksum.

## UX reference

Workout.cool (https://github.com/Snouzy/workout-cool, MIT) informed search and template workflows. Its application code, assets and UI were not copied.

## Software

Astro, React, Tailwind CSS, shadcn/ui, Radix UI, Lucide, Zod, D3, exifr and noble-hashes retain their upstream package licenses. Their exact versions are in `pnpm-lock.yaml`; installed packages contain their license texts. Cloudflare tooling and development dependencies retain their own notices.

## UI adaptations

- tweakcn Graphite theme: https://github.com/jnsahaj/tweakcn (Apache-2.0). Modified semantic colors, spacing and contrast; retained license at `public/licenses/tweakcn.txt`.
- Tremor ProgressBar: https://github.com/tremorlabs/tremor (Apache-2.0). Adapted to SSR and local theme tokens, with bounded accessible values; retained license at `public/licenses/tremor.txt`.
- BoardUI Chip: https://github.com/BoardUI/boardui (MIT). Adapted caption variant to local CSS; retained license at `public/licenses/boardui.txt`.
- Fluid Functionalism, ThreeUI and Turistar are design/workflow references; their source and assets are not redistributed. See `docs/DESIGN.md` for exact boundaries.

## Scenic photography

Photographs from Wikimedia Commons are included under their individual CC BY, CC BY-SA, CC0 or public-domain terms. `src/data/scenic-spots.json` records each author, original file page, license link and source checksum. WebP images in `public/scenery` are resized/re-encoded adaptations, retaining the source image license; attribution is visible in each destination detail and on About. `pnpm data:sync:scenery` explicitly rebuilds these images. They represent destination information, not the owner's personal travel photos.

## Fitness illustration assets

- `react-body-highlighter` (GV79), commit `d03fcd8740033721a51f5a2682de02ec31df92ba`, MIT. Anterior/posterior SVG polygon data adapted into `body-polygons.ts`. License retained at `public/licenses/react-body-highlighter.txt`.
- `yuhonas/free-exercise-db`, commit `a859101d633a01c4a1a920d6a8ce41dabba0705f`, Unlicense. Explicitly mapped pose images resized and converted to WebP. Source IDs, source SHA-256 values and attribution recorded in the media manifest. License retained at `public/licenses/free-exercise-db.txt`. Gymvisual media from the primary metadata dataset is not included.
