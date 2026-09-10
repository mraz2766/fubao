import type { Locale } from '../../types/domain';
import { taxonomyLabel, translator } from '../../lib/i18n';
import { anteriorData, posteriorData } from './body-polygons';
export const muscleMapping: Record<string, string[]> = {
  abs: ['abs'],
  spine: ['lower-back'],
  pectorals: ['chest'],
  lats: ['upper-back'],
  'upper back': ['upper-back'],
  traps: ['trapezius'],
  'levator scapulae': ['neck'],
  delts: ['front-deltoids', 'back-deltoids'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  forearms: ['forearm'],
  glutes: ['gluteal'],
  quads: ['quadriceps'],
  hamstrings: ['hamstring'],
  adductors: ['adductor'],
  abductors: ['abductors'],
  calves: ['calves'],
};
export default function MuscleFigure({
  target,
  secondary = [],
  locale,
}: {
  target: string;
  secondary?: string[];
  locale: Locale;
}) {
  const primary = muscleMapping[target] ?? [],
    other = secondary.flatMap((x) => muscleMapping[x] ?? []),
    back = [
      'lats',
      'upper back',
      'traps',
      'spine',
      'glutes',
      'hamstrings',
      'calves',
      'triceps',
    ].includes(target);
  const views = secondary.length ? [false, true] : [back];
  return (
    <figure className="muscle-figure">
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {views.map((rear) => (
          <svg
            key={String(rear)}
            viewBox="0 0 1000 2000"
            width="100"
            height="180"
            role="img"
            aria-label={`${taxonomyLabel(target, locale)} · ${translator(locale)(rear ? 'fitness.back' : 'fitness.front')}`}
          >
            {(rear ? posteriorData : anteriorData).flatMap((part) =>
              part.svgPoints.map((points, i) => (
                <polygon
                  key={part.muscle + i}
                  points={points}
                  fill={
                    primary.includes(part.muscle)
                      ? 'var(--accent)'
                      : other.includes(part.muscle)
                        ? 'var(--muted)'
                        : 'var(--line)'
                  }
                  opacity={other.includes(part.muscle) && !primary.includes(part.muscle) ? 0.6 : 1}
                />
              )),
            )}
          </svg>
        ))}
      </div>
      <figcaption>
        {taxonomyLabel(target, locale)}
        <small>{translator(locale)(back ? 'fitness.back' : 'fitness.front')}</small>
      </figcaption>
    </figure>
  );
}
