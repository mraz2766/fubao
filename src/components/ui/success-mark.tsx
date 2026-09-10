import { Check } from 'lucide-react';

export function SuccessMark({ animate = false }: { animate?: boolean }) {
  return (
    <span className="success-mark" data-celebrate={animate || undefined} aria-hidden="true">
      <Check size={16} strokeWidth={2} />
    </span>
  );
}
