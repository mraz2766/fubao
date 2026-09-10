// Adapted from Tremor ProgressBar v0.0.3, Apache-2.0.
// Uses semantic theme tokens, no runtime styling dependency; renders with Astro SSR.
// Original: https://github.com/tremorlabs/tremor/blob/main/src/components/ProgressBar/ProgressBar.tsx
import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

export function ProgressBar({
  value = 0,
  max = 100,
  className,
  ...props
}: Omit<ComponentProps<'div'>, 'children'> & { value?: number; max?: number }) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 1;
  const safeValue = Number.isFinite(value) ? Math.min(safeMax, Math.max(value, 0)) : 0;
  return (
    <div
      {...props}
      className={cn('metric-progress', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuenow={safeValue}
      aria-valuemax={safeMax}
    >
      <div className="metric-progress-fill" style={{ width: `${(safeValue / safeMax) * 100}%` }} />
    </div>
  );
}
