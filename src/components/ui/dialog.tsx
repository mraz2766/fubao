import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useEffect, useState, useRef, type ReactNode, type CSSProperties } from 'react';
import type { Locale } from '../../types/domain';
import { translator } from '../../lib/i18n';
export function Dialog({
  open,
  onOpenChange,
  title,
  children,
  locale,
  wide = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  locale: Locale;
  wide?: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [viewport, setViewport] = useState<CSSProperties>({});
  useEffect(() => {
    if (!open || !window.visualViewport) return;
    const visual = window.visualViewport;
    const update = () =>
      setViewport({
        '--sheet-height': `${visual.height}px`,
        '--sheet-bottom': `${Math.max(0, window.innerHeight - visual.height - visual.offsetTop)}px`,
      } as CSSProperties);
    update();
    visual.addEventListener('resize', update);
    visual.addEventListener('scroll', update);
    return () => {
      visual.removeEventListener('resize', update);
      visual.removeEventListener('scroll', update);
    };
  }, [open]);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay" />
        <DialogPrimitive.Content
          className={`dialog-content ${wide ? 'dialog-wide' : ''}`}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            heading.current?.focus({ preventScroll: true });
          }}
          aria-describedby={undefined}
          style={viewport}
        >
          <div className="dialog-heading">
            <DialogPrimitive.Title ref={heading} tabIndex={-1}>
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              className="button button-ghost button-icon"
              aria-label={translator(locale)('common.close')}
            >
              <X size={20} />
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
