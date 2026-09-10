// Adapted from BoardUI Chip, MIT. Semantic caption variant with local tokens.
// https://github.com/BoardUI/boardui/blob/main/components/base/badges/chip.tsx
import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';
export function Chip({ className, ...props }: ComponentProps<'span'>) {
  return <span className={cn('label-chip', className)} {...props} />;
}
