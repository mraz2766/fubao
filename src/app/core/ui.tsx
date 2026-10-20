import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  AnimatePresence,
  animate,
  motion,
  useDragControls,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
  type PanInfo,
} from 'motion/react';
import { ArrowDown, ChevronLeft, CircleCheck, CircleAlert, X } from 'lucide-react';
import { useRouter, useScreen, reducedMotion } from './router';
import { useApp } from './app-state';
import { t } from './i18n';
import { invalidate } from './query';
import { haptic } from './haptics';

export const spring = { type: 'spring', stiffness: 520, damping: 40, mass: 0.9 } as const;
export const softSpring = { type: 'spring', stiffness: 260, damping: 30 } as const;
export const iosEase = [0.32, 0.72, 0, 1] as const;

/* ---------- Screen scaffold ---------- */
/** Root tabs remember where you were when you come back to them. */
const scrollMemory = new Map<string, number>();
const PULL = 72;

/** Pull down at the top to refresh — standalone iOS apps have no reload button. */
function usePullToRefresh(el: React.RefObject<HTMLDivElement | null>, enabled: boolean) {
  const pull = useMotionValue(0);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    const node = el.current;
    if (!node || !enabled) return;
    let start: { x: number; y: number } | null = null;
    let armed = false;
    const onStart = (e: TouchEvent) => {
      if (node.scrollTop > 0 || refreshing) return;
      start = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY };
      armed = false;
    };
    const onMove = (e: TouchEvent) => {
      if (!start) return;
      const dx = e.touches[0]!.clientX - start.x,
        dy = e.touches[0]!.clientY - start.y;
      if (dy <= 0 || Math.abs(dx) > dy || node.scrollTop > 0) {
        pull.set(0);
        return;
      }
      const value = Math.min(140, Math.max(-node.scrollTop, dy * 0.5));
      pull.set(value);
      if (value >= PULL && !armed) {
        armed = true;
        haptic();
      } else if (value < PULL) armed = false;
    };
    const onEnd = () => {
      if (!start) return;
      start = null;
      if (pull.get() >= PULL) {
        setRefreshing(true);
        animate(pull, PULL - 16, spring);
        invalidate('/api/');
        setTimeout(() => {
          setRefreshing(false);
          animate(pull, 0, spring);
        }, 800);
      } else animate(pull, 0, spring);
    };
    node.addEventListener('touchstart', onStart, { passive: true });
    node.addEventListener('touchmove', onMove, { passive: true });
    node.addEventListener('touchend', onEnd);
    node.addEventListener('touchcancel', onEnd);
    return () => {
      node.removeEventListener('touchstart', onStart);
      node.removeEventListener('touchmove', onMove);
      node.removeEventListener('touchend', onEnd);
      node.removeEventListener('touchcancel', onEnd);
    };
  }, [el, enabled, refreshing, pull]);
  return { pull, refreshing };
}
function PullIndicator({
  pull,
  refreshing,
}: {
  pull: ReturnType<typeof useMotionValue<number>>;
  refreshing: boolean;
}) {
  const opacity = useTransform(pull, [12, PULL], [0, 1]);
  const scale = useTransform(pull, [12, PULL], [0.6, 1]);
  const rotate = useTransform(pull, [0, PULL, 140], [0, 180, 180]);
  return (
    <motion.div className="ptr" style={{ opacity, scale }} aria-hidden>
      {refreshing ? (
        <span className="spinner" />
      ) : (
        <motion.span style={{ rotate, display: 'grid' }}>
          <ArrowDown />
        </motion.span>
      )}
    </motion.div>
  );
}
export function Screen({
  title,
  subtitle,
  large = true,
  actions,
  leading,
  children,
  tabbar = true,
  overlayNav = false,
  narrow = false,
  backFallback,
  className,
  hero,
}: {
  title: string;
  subtitle?: ReactNode;
  large?: boolean;
  actions?: ReactNode;
  leading?: ReactNode;
  children: ReactNode;
  tabbar?: boolean;
  /** Transparent bar floating over a hero image until scrolled. */
  overlayNav?: boolean;
  narrow?: boolean;
  backFallback?: string;
  className?: string;
  /** Full-bleed content above the title (e.g. a cover photo). */
  hero?: ReactNode;
}) {
  const { scrollEl, scroller } = useScreen();
  const [solid, setSolid] = useState(false);
  const router = useRouter();
  const root = !router.canGoBack;
  const threshold = overlayNav ? 220 : large ? 44 : 4;
  const barBg = useTransform(scroller, [threshold - 20, threshold], [0, 1]);
  const smallTitle = useTransform(scroller, [threshold - 8, threshold + 8], [0, 1]);
  const largeScale = useTransform(scroller, [-120, 0], [1.12, 1]);
  useMotionValueEvent(scroller, 'change', (v) => overlayNav && setSolid(v > threshold - 30));
  const { entry } = useScreen();
  const { pull, refreshing } = usePullToRefresh(scrollEl, root);
  useLayoutEffect(() => {
    const saved = root ? scrollMemory.get(entry.path) : undefined;
    if (saved && scrollEl.current) {
      scrollEl.current.scrollTop = saved;
      scroller.set(saved);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div
      ref={scrollEl}
      className={`screen ${tabbar ? '' : 'no-tabbar'} ${className ?? ''}`}
      onScroll={(e) => {
        scroller.set(e.currentTarget.scrollTop);
        if (root) scrollMemory.set(entry.path, e.currentTarget.scrollTop);
      }}
    >
      {root && <PullIndicator pull={pull} refreshing={refreshing} />}
      <header
        className={`navbar ${overlayNav ? 'overlay' : ''} ${overlayNav && !solid ? 'on-media' : ''} ${root && large ? 'root-nav' : ''}`}
      >
        <motion.div className="navbar-bg" style={{ opacity: barBg }} />
        <div className="navbar-row">
          <div className="navbar-side">
            {leading ??
              (!root && (
                <Press
                  className="back-btn"
                  onClick={() => router.back(backFallback)}
                  aria-label={t('返回', 'Back')}
                >
                  <ChevronLeft strokeWidth={2.4} />
                </Press>
              ))}
          </div>
          <motion.div
            className="navbar-title"
            style={{ opacity: large || overlayNav ? smallTitle : 1 }}
          >
            {title}
          </motion.div>
          <div className="navbar-side end">{actions}</div>
        </div>
      </header>
      {hero}
      {large && (
        <motion.div
          className={`large-title ${narrow ? 'narrow' : ''}`}
          style={{ scale: largeScale, originX: 0, originY: 1 }}
        >
          <div>
            <h1>{title}</h1>
            {subtitle && <div className="sub">{subtitle}</div>}
          </div>
        </motion.div>
      )}
      <div className={`screen-inner ${narrow ? 'narrow' : ''}`}>{children}</div>
    </div>
  );
}

/* ---------- Pressable ---------- */
type PressProps = ComponentProps<typeof motion.button> & { scale?: number };
export function Press({ scale = 0.96, ...props }: PressProps) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale }}
      transition={{ type: 'spring', stiffness: 700, damping: 35 }}
      {...props}
    />
  );
}

/* ---------- Segmented control ---------- */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={`seg ${className ?? ''}`} role="tablist">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className={o.value === value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.value === value && (
            <motion.i className="seg-pill" layoutId={`seg-${id}`} transition={spring} />
          )}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Switch({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`switch ${on ? 'on' : ''}`}
      onClick={() => onChange(!on)}
    >
      <i />
    </button>
  );
}

/* ---------- Sheet ---------- */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  full = false,
  wide = false,
  headerAction,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  full?: boolean;
  wide?: boolean;
  headerAction?: ReactNode;
  dismissible?: boolean;
}) {
  const { setSheetDepth } = useApp();
  useEffect(() => {
    if (!open) return;
    setSheetDepth((n) => n + 1);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dismissible && onClose();
    addEventListener('keydown', onKey);
    return () => {
      setSheetDepth((n) => n - 1);
      removeEventListener('keydown', onKey);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return createPortal(
    <AnimatePresence>
      {open && (
        <SheetPanel
          onClose={onClose}
          title={title}
          footer={footer}
          full={full}
          wide={wide}
          headerAction={headerAction}
          dismissible={dismissible}
        >
          {children}
        </SheetPanel>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function SheetPanel({
  onClose,
  title,
  children,
  footer,
  full,
  wide,
  headerAction,
  dismissible,
}: {
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  full: boolean;
  wide: boolean;
  headerAction?: ReactNode;
  dismissible: boolean;
}) {
  const desktop = matchMedia('(min-width: 900px)').matches;
  const controls = useDragControls();
  const y = useMotionValue(0);
  const backdrop = useTransform(y, [0, 400], [1, 0.2]);
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (dismissible && (info.offset.y > 140 || info.velocity.y > 600)) onClose();
    else animate(y, 0, spring);
  };
  const fast = reducedMotion();
  return (
    <div className="sheet-layer" role="dialog" aria-modal="true">
      <motion.div
        style={{ position: 'absolute', inset: 0 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: fast ? 0 : 0.3 }}
        onClick={() => dismissible && onClose()}
      >
        <motion.div className="sheet-backdrop" style={{ opacity: backdrop }} />
      </motion.div>
      <motion.div
        className={`sheet ${full ? 'full' : ''} ${wide ? 'wide' : ''}`}
        initial={desktop ? { opacity: 0, scale: 0.94, y: 20 } : { y: '100%' }}
        animate={desktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
        exit={desktop ? { opacity: 0, scale: 0.96, y: 10 } : { y: '100%' }}
        transition={
          fast
            ? { duration: 0 }
            : desktop
              ? { duration: 0.28, ease: iosEase }
              : { duration: 0.5, ease: iosEase }
        }
        style={desktop ? undefined : { y }}
        drag={desktop ? false : 'y'}
        dragListener={false}
        dragControls={controls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.05, bottom: 0.9 }}
        onDragEnd={onDragEnd}
      >
        <div className="sheet-grip" onPointerDown={(e) => controls.start(e)}>
          <i />
        </div>
        {(title || headerAction) && (
          <div className="sheet-head" onPointerDown={(e) => !desktop && controls.start(e)}>
            <h3>{title}</h3>
            <div className="hstack">
              {headerAction}
              {dismissible && (
                <Press
                  className="icon-btn sm filled"
                  onClick={onClose}
                  aria-label={t('关闭', 'Close')}
                >
                  <X strokeWidth={2.4} />
                </Press>
              )}
            </div>
          </div>
        )}
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </motion.div>
    </div>
  );
}

/* ---------- Toasts ---------- */
export function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="toast-wrap" aria-live="polite">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            className={`toast ${toast.tone === 'error' ? 'error' : ''}`}
            initial={{ opacity: 0, y: -24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={spring}
          >
            {toast.tone === 'error' ? <CircleAlert /> : <CircleCheck />}
            {toast.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ---------- Count-up number ---------- */
export function CountUp({
  value,
  decimals = 0,
  duration = 0.9,
}: {
  value: number;
  decimals?: number;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = prev.current;
    prev.current = value;
    if (reducedMotion()) {
      el.textContent = value.toFixed(decimals);
      return;
    }
    const c = animate(from, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => (el.textContent = v.toFixed(decimals)),
    });
    return () => c.stop();
  }, [value, decimals, duration]);
  return (
    <span ref={ref} className="num countup">
      {(0).toFixed(decimals)}
    </span>
  );
}

/* ---------- Progress ring ---------- */
export function Ring({
  value,
  size = 120,
  stroke = 14,
  gradient = ['#ff8a3d', '#ff2d6f'],
  track = 'var(--surface-2)',
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  gradient?: [string, string];
  track?: string;
  children?: ReactNode;
}) {
  const id = useId().replace(/:/g, '');
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }}
      >
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={gradient[0]} />
            <stop offset="100%" stopColor={gradient[1]} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#g${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - clamped) }}
          transition={{ duration: reducedMotion() ? 0 : 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        {children}
      </div>
    </div>
  );
}

/* ---------- Staggered reveal ---------- */
export function Reveal({
  children,
  delay = 0,
  className,
  y = 14,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion() ? 0 : 0.55, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

export function Empty({
  icon,
  title,
  text,
  tone = 'fit',
  action,
}: {
  icon: ReactNode;
  title: string;
  text?: string;
  tone?: 'fit' | 'trav' | 'ink';
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <motion.div
        className="art"
        style={{
          background:
            tone === 'fit'
              ? 'var(--fit-grad)'
              : tone === 'trav'
                ? 'var(--trav-grad)'
                : 'var(--ink)',
        }}
        initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={softSpring}
      >
        {icon}
      </motion.div>
      <h3>{title}</h3>
      {text && <p className="small">{text}</p>}
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
    </div>
  );
}

export function Skeleton({
  h = 80,
  r,
  style,
}: {
  h?: number;
  r?: number;
  style?: React.CSSProperties;
}) {
  return <div className="skeleton" style={{ height: h, borderRadius: r, ...style }} />;
}

/** Simple confirmation sheet; resolves through callbacks. */
export function ConfirmSheet({
  open,
  title,
  text,
  confirm,
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  text?: string;
  confirm: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {text && (
        <p className="muted" style={{ marginBottom: 20 }}>
          {text}
        </p>
      )}
      <div className="stack" style={{ gap: 10 }}>
        <Press
          className={`btn block lg ${danger ? 'btn-danger' : 'btn-primary'}`}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <span className="spinner" /> : confirm}
        </Press>
        <Press className="btn block btn-ghost" onClick={onClose}>
          {t('取消', 'Cancel')}
        </Press>
      </div>
    </Sheet>
  );
}
