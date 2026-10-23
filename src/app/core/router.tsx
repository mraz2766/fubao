import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  usePresence,
  usePresenceData,
  useTransform,
  type MotionValue,
} from 'motion/react';

/**
 * A small stack router modelled on UINavigationController:
 * pushes slide in from the right, pops slide out, tab roots cross-fade,
 * and an edge swipe drives the pop interactively on touch devices.
 */
export type Mode = 'push' | 'pop' | 'tab' | 'none';
export interface Entry {
  key: string;
  path: string;
  idx: number;
}
interface NavOptions {
  replace?: boolean;
  /** Reset the stack (tab switch). */
  root?: boolean;
  mode?: Mode;
}
/**
 * Screens with unsaved input register a guard. Returning true blocks leaving
 * (the guard shows its own confirmation, then calls `back(undefined, true)`).
 */
const guards = new Map<string, () => boolean>();
export function useLeaveGuard(guard: (() => boolean) | null) {
  const { entry } = useScreen();
  const ref = useRef(guard);
  ref.current = guard;
  useEffect(() => {
    guards.set(entry.key, () => ref.current?.() ?? false);
    return () => {
      guards.delete(entry.key);
    };
  }, [entry.key]);
}

interface RouterApi {
  path: string;
  navigate: (path: string, options?: NavOptions) => void;
  back: (fallback?: string, force?: boolean) => void;
  canGoBack: boolean;
}
const RouterCtx = createContext<RouterApi | null>(null);
export const useRouter = () => useContext(RouterCtx)!;

interface ScreenApi {
  entry: Entry;
  isTop: boolean;
  scroller: MotionValue<number>;
  scrollEl: React.RefObject<HTMLDivElement | null>;
}
const ScreenCtx = createContext<ScreenApi | null>(null);
export const useScreen = () => useContext(ScreenCtx)!;

let keySeq = 0;
const newKey = () => `${Date.now().toString(36)}-${++keySeq}`;
const desktopQuery = () => matchMedia('(min-width: 900px)').matches;
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const IOS_EASE = [0.32, 0.72, 0, 1] as const;

interface StackState {
  stack: Entry[];
  mode: Mode;
}

export function Router({
  render,
  parentOf,
  isRoot,
  shell,
}: {
  render: (path: string) => ReactNode;
  parentOf: (path: string) => string;
  isRoot: (path: string) => boolean;
  /** Chrome around the screen stack (tab bar, sidebar) that also needs the router. */
  shell: (outlet: ReactNode) => ReactNode;
}) {
  const [state, setState] = useState<StackState>(() => {
    const path = location.pathname + location.search;
    const existing = history.state as Partial<Entry> | null;
    const entry = { key: existing?.key ?? newKey(), path, idx: existing?.idx ?? 0 };
    history.replaceState(entry, '');
    return { stack: [entry], mode: 'none' };
  });
  const stateRef = useRef(state);
  stateRef.current = state;
  const pendingMode = useRef<Mode | null>(null);

  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const target = (event.state as Entry | null) ?? {
        key: newKey(),
        path: location.pathname + location.search,
        idx: 0,
      };
      const { stack } = stateRef.current;
      const at = stack.findIndex((e) => e.key === target.key);
      const forced = pendingMode.current;
      pendingMode.current = null;
      if (at >= 0) setState({ stack: stack.slice(0, at + 1), mode: forced ?? 'pop' });
      else if (target.idx > (stack.at(-1)?.idx ?? 0) && !isRoot(target.path))
        setState({ stack: [...stack, target], mode: 'push' });
      else setState({ stack: [target], mode: 'tab' });
    };
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, [isRoot]);

  const navigate = useCallback((path: string, options: NavOptions = {}) => {
    const { stack } = stateRef.current;
    const top = stack.at(-1)!;
    if (path === top.path && !options.replace) return;
    const entry: Entry = {
      key: newKey(),
      path,
      idx: options.replace ? top.idx : top.idx + 1,
    };
    if (options.replace) history.replaceState(entry, '', path);
    else history.pushState(entry, '', path);
    if (options.root) setState({ stack: [entry], mode: options.mode ?? 'tab' });
    else if (options.replace)
      setState({ stack: [...stack.slice(0, -1), entry], mode: options.mode ?? 'none' });
    else setState({ stack: [...stack, entry], mode: options.mode ?? 'push' });
  }, []);

  const back = useCallback(
    (fallback?: string, force = false) => {
      const { stack } = stateRef.current;
      if (!force && guards.get(stack.at(-1)!.key)?.()) return;
      if (stack.length > 1) history.back();
      else {
        const top = stack.at(-1)!;
        const parent = fallback ?? parentOf(top.path.split('?')[0]!);
        const entry: Entry = { key: newKey(), path: parent, idx: top.idx };
        history.replaceState(entry, '', parent);
        // Insert the parent beneath, then pop the current screen off it.
        setState({ stack: [entry, top], mode: 'none' });
        setTimeout(() => setState({ stack: [entry], mode: 'pop' }), 20);
      }
    },
    [parentOf],
  );

  const top = state.stack.at(-1)!;
  const canGoBack = state.stack.length > 1 || !isRoot(top.path.split('?')[0]!);
  const api = useMemo<RouterApi>(
    () => ({ path: top.path, navigate, back, canGoBack }),
    [top.path, navigate, back, canGoBack],
  );

  const registry = useRef(new Map<string, ScreenMotion>());
  const outlet = (
    <AnimatePresence initial={false} custom={state.mode}>
      {state.stack.map((entry, depth) => (
        <ScreenHost
          key={entry.key}
          entry={entry}
          depth={depth}
          topDepth={state.stack.length - 1}
          mode={state.mode}
          registry={registry.current}
          below={state.stack[depth - 1]?.key}
          canSwipe={depth > 0 || !isRoot(entry.path.split('?')[0]!)}
          onSwipeBack={() => back()}
        >
          {render(entry.path)}
        </ScreenHost>
      ))}
    </AnimatePresence>
  );
  return <RouterCtx.Provider value={api}>{shell(outlet)}</RouterCtx.Provider>;
}

interface ScreenMotion {
  x: MotionValue<number>;
  dim: MotionValue<number>;
  reveal: () => void;
}

function ScreenHost({
  entry,
  depth,
  topDepth,
  mode,
  registry,
  below,
  canSwipe,
  onSwipeBack,
  children,
}: {
  entry: Entry;
  depth: number;
  topDepth: number;
  mode: Mode;
  registry: Map<string, ScreenMotion>;
  below?: string;
  canSwipe: boolean;
  onSwipeBack: () => void;
  children: ReactNode;
}) {
  const [isPresent, safeToRemove] = usePresence();
  // Exiting screens keep their last props; the latest mode arrives through AnimatePresence `custom`.
  const presenceMode = (usePresenceData() as Mode | undefined) ?? mode;
  const desktop = useRef(desktopQuery()).current;
  const role = !isPresent
    ? 'leaving'
    : depth === topDepth
      ? 'top'
      : depth === topDepth - 1
        ? 'under'
        : 'buried';
  const enteringMode = useRef(mode).current;
  const startX = desktop
    ? 0
    : enteringMode === 'push' && depth > 0
      ? 100
      : depth < topDepth
        ? -28
        : 0;
  const x = useMotionValue(startX);
  const y = useMotionValue(desktop && enteringMode === 'push' ? 18 : 0);
  const opacity = useMotionValue(
    enteringMode === 'tab' || (desktop && enteringMode === 'push') ? 0 : 1,
  );
  const dim = useMotionValue(0);
  const scroller = useMotionValue(0);
  const scrollEl = useRef<HTMLDivElement>(null);
  const swiping = useRef(false);
  const xPct = useTransform(x, (v) => `${v}%`);
  const [hidden, setHidden] = useState(false);

  useLayoutEffect(() => {
    registry.set(entry.key, { x, dim, reveal: () => setHidden(false) });
    return () => {
      registry.delete(entry.key);
    };
  }, [entry.key, registry, x, dim]);

  useEffect(() => {
    const fast = reducedMotion();
    const tween = { duration: fast ? 0 : 0.5, ease: IOS_EASE };
    if (role === 'top') {
      setHidden(false);
      if (swiping.current) return;
      const controls = [
        animate(x, 0, tween),
        animate(dim, 0, tween),
        animate(y, 0, { duration: fast ? 0 : 0.42, ease: IOS_EASE }),
        animate(opacity, 1, { duration: fast ? 0 : enteringMode === 'tab' ? 0.28 : 0.36 }),
      ];
      return () => controls.forEach((c) => c.stop());
    }
    if (role === 'under') {
      if (desktop || mode === 'tab') {
        setHidden(true);
        return;
      }
      setHidden(false);
      const controls = [animate(x, -28, tween), animate(dim, 0.14, tween)];
      const done = setTimeout(() => setHidden(true), fast ? 0 : 520);
      return () => {
        controls.forEach((c) => c.stop());
        clearTimeout(done);
      };
    }
    if (role === 'buried') setHidden(true);
    if (role === 'leaving') {
      const exitMode = presenceMode;
      if (exitMode === 'pop' && !desktop) {
        const c = animate(x, 100, { ...tween, duration: fast ? 0 : swiping.current ? 0.3 : 0.45 });
        c.then(() => safeToRemove?.());
        return () => c.stop();
      }
      if (exitMode === 'none' && !swiping.current) {
        safeToRemove?.();
        return;
      }
      const c = animate(opacity, 0, { duration: fast ? 0 : 0.18 });
      if (desktop && exitMode === 'pop') animate(y, 12, { duration: 0.18 });
      c.then(() => safeToRemove?.());
      return () => c.stop();
    }
  }, [role]); // eslint-disable-line react-hooks/exhaustive-deps

  // Interactive edge-swipe back, as in native iOS navigation.
  useEffect(() => {
    const el = scrollEl.current;
    if (!el || role !== 'top' || !canSwipe || desktop) return;
    let start: { x: number; y: number; t: number } | null = null;
    let active = false;
    let lastX = 0,
      lastT = 0,
      velocity = 0;
    const width = () => el.clientWidth || innerWidth;
    const under = () => (below ? registry.get(below) : undefined);
    const onStart = (e: TouchEvent) => {
      const touch = e.touches[0]!;
      if (touch.clientX - el.getBoundingClientRect().left > 28 || e.touches.length > 1) return;
      start = { x: touch.clientX, y: touch.clientY, t: e.timeStamp };
      active = false;
      lastX = touch.clientX;
      lastT = e.timeStamp;
    };
    const onMove = (e: TouchEvent) => {
      if (!start) return;
      const touch = e.touches[0]!;
      const dx = touch.clientX - start.x,
        dy = touch.clientY - start.y;
      if (!active) {
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
          start = null;
          return;
        }
        if (dx < 8) return;
        active = true;
        swiping.current = true;
        under()?.reveal(); // Show the previous screen beneath.
      }
      e.preventDefault();
      const progress = Math.max(0, Math.min(1, dx / width()));
      x.set(progress * 100);
      const u = under();
      if (u) {
        u.x.set(-28 + 28 * progress);
        u.dim.set(0.14 * (1 - progress));
      }
      velocity = (touch.clientX - lastX) / Math.max(1, e.timeStamp - lastT);
      lastX = touch.clientX;
      lastT = e.timeStamp;
    };
    const onEnd = () => {
      if (!start) return;
      const wasActive = active;
      start = null;
      active = false;
      if (!wasActive) return;
      const progress = x.get() / 100;
      if ((progress > 0.4 || velocity > 0.45) && !guards.get(entry.key)?.()) onSwipeBack();
      else {
        const tween = { duration: 0.35, ease: IOS_EASE };
        animate(x, 0, tween).then(() => (swiping.current = false));
        const u = under();
        if (u) {
          animate(u.x, -28, tween);
          animate(u.dim, 0.14, tween);
        }
      }
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [role, canSwipe, desktop, below, registry, x, onSwipeBack]);

  const api = useMemo<ScreenApi>(
    () => ({ entry, isTop: role === 'top', scroller, scrollEl }),
    [entry, role, scroller],
  );
  const dimOpacity = dim;
  return (
    <ScreenCtx.Provider value={api}>
      <motion.div
        data-screen={entry.key}
        className="screen-host"
        style={{
          position: 'absolute',
          inset: 0,
          x: xPct,
          y,
          opacity,
          zIndex: depth + 1,
          visibility: hidden ? 'hidden' : 'visible',
          boxShadow: depth > 0 && !desktop ? '-12px 0 40px rgba(0,0,0,0.12)' : undefined,
        }}
        inert={role !== 'top' ? true : undefined}
        aria-hidden={role !== 'top' || undefined}
      >
        {children}
        <motion.div className="stage-dim" style={{ opacity: dimOpacity }} />
      </motion.div>
    </ScreenCtx.Provider>
  );
}
