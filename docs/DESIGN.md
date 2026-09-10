# Fubao design implementation

## Direction

Graphite surfaces, muted violet action color, precise numerical typography and real destination photography. The page hierarchy is working context → controls → records, with no marketing hero. Fitness prioritizes fast lookup and logging; Travel connects destination discovery, wishlist, recorded visits and maps.

Motion uses three CSS durations (150/180/260ms), faster dismissal, native view transitions and a subtle perspective lift on destination photos. Tap opens the same detail as desktop; reduced-motion disables spatial effects. No WebGL runtime is downloaded for decorative effects.

## Sources and adaptations

| Project                                                                                                  | Implementation                                                                                                                                                 | License                                                      |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| [tweakcn](https://github.com/jnsahaj/tweakcn)                                                            | Graphite preset adapted in `src/styles/themes/graphite.css`; semantic primary, secondary, foreground, sidebar and surface tokens; adjusted violet and contrast | Apache-2.0; copy in `public/licenses/tweakcn.txt`            |
| [BoardUI](https://github.com/BoardUI/boardui)                                                            | Caption Chip adapted as `src/components/ui/chip.tsx`, used for destination categories; local semantic tokens replace its full token dependency                 | MIT; copy in `public/licenses/boardui.txt`                   |
| [Tremor](https://github.com/tremorlabs/tremor)                                                           | ProgressBar adapted as `src/components/ui/progress-bar.tsx`, used in weekly target and muscle distribution; bounded accessible values, SSR, no chart runtime   | Apache-2.0; copy in `public/licenses/tremor.txt`             |
| [Fluid Functionalism](https://github.com/mickadesign/fluid-functionalism/blob/main/motion-guidelines.md) | Reference for consistent motion tiers, large surfaces moving slower, quicker exits; original CSS implementation                                                | Design reference; no source copied                           |
| [ThreeUI](https://github.com/MengTo/threeui)                                                             | Reference for restrained depth in photographic surfaces; CSS perspective rather than a continuous 3D scene                                                     | No source or catalog assets copied; Pro/Beta assets excluded |
| [Turistar](https://github.com/andre-lmarinho/turistar)                                                   | Reference for place-first organization and map/visit association; independent implementation with D1/R2 and private-by-default records                         | AGPL-3.0 upstream; no source or assets copied                |

The full upstream applications are not dependencies. Fubao retains Astro/Workers and React Islands. No Supabase, Firebase, Vercel server or paid UI package is required.

## Scenic catalog

Twelve domestic destinations carry genuine Wikimedia Commons photographs. Every photo has author, file page, license URL, source checksum and locally generated large/thumbnail variants in `src/data/scenic-spots.json`. Discover can filter province, landscape type and personal visited/wishlist state. A catalog destination is not a personal trip and never contributes to personal statistics. Other attractions can be recorded with a custom place name and user photos.
