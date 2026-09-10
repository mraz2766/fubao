import type { Locale } from '../../types/domain';
import { taxonomyLabel, translator } from '../../lib/i18n';
const group: Record<string, string> = {
  abs: 'core',
  spine: 'core',
  pectorals: 'chest',
  lats: 'chest',
  'upper back': 'chest',
  traps: 'shoulders',
  'levator scapulae': 'shoulders',
  delts: 'shoulders',
  biceps: 'arms',
  triceps: 'arms',
  forearms: 'forearms',
  glutes: 'hips',
  quads: 'thighs',
  hamstrings: 'thighs',
  adductors: 'thighs',
  abductors: 'hips',
  calves: 'calves',
};
export default function MuscleFigure({ target, locale }: { target: string; locale: Locale }) {
  const active = group[target];
  const back = ['lats', 'upper back', 'traps', 'spine', 'glutes', 'hamstrings', 'calves'].includes(
    target,
  );
  const fill = (part: string) => (part === active ? 'var(--accent)' : 'var(--line)');
  return (
    <figure className="muscle-figure">
      <svg
        viewBox="0 0 120 200"
        width="100"
        height="160"
        role="img"
        aria-label={taxonomyLabel(target, locale)}
      >
        <circle cx="60" cy="18" r="12" fill="var(--line)" />
        <path d="M51 32h18l7 17-3 53H47l-3-53z" fill="var(--line)" />
        <path d="M45 39q15-7 30 0v23H45z" fill={fill('chest')} />
        <path d="M48 65h24v32H48z" fill={fill('core')} />
        <path d="M45 99h30l4 20H41z" fill={fill('hips')} />
        <path d="M36 38h8l-3 24H29zM76 38h8l7 24H79z" fill={fill('shoulders')} />
        <path d="M29 65h11l-5 30H24zM80 65h11l5 30H85z" fill={fill('arms')} />
        <path d="M23 98h11l-5 30H19zM86 98h11l4 30H91z" fill={fill('forearms')} />
        <path d="M41 122h17l-3 34H37zM62 122h17l4 34H65z" fill={fill('thighs')} />
        <path d="M38 159h16l-3 32H35zM66 159h16l3 32H69z" fill={fill('calves')} />
      </svg>
      <figcaption>
        {taxonomyLabel(target, locale)}
        <small>{translator(locale)(back ? 'fitness.back' : 'fitness.front')}</small>
      </figcaption>
    </figure>
  );
}
