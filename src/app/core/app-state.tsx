import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Locale, Preferences, User } from '../../types/domain';
import { api } from '../../lib/api';
import { setLocale } from './i18n';
import { clearQueries, invalidate } from './query';

export interface Boot {
  user: User | null;
  locale: Locale;
  preferences: Preferences;
}
export interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'error' | 'info';
}
interface AppState {
  user: User | null;
  owner: boolean;
  prefs: Preferences;
  setUser: (user: User | null) => void;
  replacePrefs: (prefs: Preferences) => void;
  updatePrefs: (patch: Partial<Preferences>) => Promise<void>;
  toast: (text: string, tone?: Toast['tone']) => void;
  toasts: Toast[];
  /** Number of open sheets; the stage recedes like iOS card presentation. */
  sheetDepth: number;
  setSheetDepth: (fn: (n: number) => number) => void;
}
const Ctx = createContext<AppState | null>(null);
export const useApp = () => useContext(Ctx)!;

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
}
export function applyTheme(theme: Preferences['theme']) {
  document.documentElement.dataset.preferredTheme = theme;
  (window as unknown as { __applyTheme?: () => void }).__applyTheme?.();
}

export function AppProvider({ boot, children }: { boot: Boot; children: ReactNode }) {
  const [user, setUserState] = useState(boot.user);
  const [prefs, setPrefs] = useState<Preferences>({ ...boot.preferences, language: boot.locale });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sheetDepth, setSheetDepth] = useState(0);
  const seq = useRef(0);
  setLocale(prefs.language);

  const toast = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = ++seq.current;
    setToasts((list) => [...list.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 2600);
  }, []);

  const updatePrefs = useCallback(
    async (patch: Partial<Preferences>) => {
      const next = { ...prefs, ...patch };
      setPrefs(next);
      if (patch.theme) applyTheme(patch.theme);
      if (patch.language) writeCookie('fubao.locale', patch.language);
      if (user) {
        const { mapStyle: _ignored, ...preferences } = patch;
        await api('/api/settings', { method: 'PATCH', body: { preferences } });
      } else {
        const { theme, weightUnit, distanceUnit, weekStart } = next;
        writeCookie(
          'fubao.display',
          JSON.stringify({ theme, weightUnit, distanceUnit, weekStart }),
        );
      }
      if (patch.weekStart !== undefined || patch.weeklyGoal || patch.timezone || patch.language)
        invalidate('/api/');
    },
    [prefs, user],
  );

  const setUser = useCallback((next: User | null) => {
    clearQueries();
    setUserState(next);
  }, []);

  const replacePrefs = useCallback((next: Preferences) => {
    setPrefs(next);
    applyTheme(next.theme);
    writeCookie('fubao.locale', next.language);
  }, []);

  const value = useMemo<AppState>(
    () => ({
      user,
      owner: !!user,
      prefs,
      setUser,
      replacePrefs,
      updatePrefs,
      toast,
      toasts,
      sheetDepth,
      setSheetDepth,
    }),
    [user, prefs, setUser, replacePrefs, updatePrefs, toast, toasts, sheetDepth],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
