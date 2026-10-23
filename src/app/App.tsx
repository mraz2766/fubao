import { useEffect, type ReactNode } from 'react';
import { MotionConfig, motion } from 'motion/react';
import { Dumbbell, House, Plane, UserRound } from 'lucide-react';
import '../styles/fitness.css';
import '../styles/travel.css';
import { AppProvider, useApp, type Boot } from './core/app-state';
import { Router, useRouter } from './core/router';
import { Toasts, iosEase, spring } from './core/ui';
import { t } from './core/i18n';
import { haptic } from './core/haptics';
import { Today } from './home/Today';
import { FitnessHome } from './fitness/FitnessHome';
import { NewRecordScreen, WorkoutScreen } from './fitness/WorkoutScreen';
import { FitnessHistory } from './fitness/FitnessHistory';
import { TravelHome } from './travel/TravelHome';
import { TripScreen } from './travel/TripScreen';
import { Settings, About } from './settings/Settings';
import { Welcome } from './settings/Welcome';

const tabs = [
  { path: '/', icon: House, zh: '今天', en: 'Today' },
  { path: '/fitness', icon: Dumbbell, zh: '健身', en: 'Fitness' },
  { path: '/travel', icon: Plane, zh: '旅行', en: 'Travel' },
  { path: '/settings', icon: UserRound, zh: '我的', en: 'Me' },
] as const;
const roots = new Set<string>(tabs.map((tab) => tab.path));
const isRoot = (path: string) => roots.has(path.split('?')[0]!);
const parentOf = (path: string) => {
  if (path.startsWith('/fitness')) return '/fitness';
  if (path.startsWith('/travel')) return '/travel';
  if (path.startsWith('/settings')) return '/settings';
  return '/';
};

function route(path: string): ReactNode {
  const [pathname, query = ''] = path.split('?');
  const seg = pathname!.split('/').filter(Boolean);
  const params = new URLSearchParams(query);
  if (seg.length === 0) return <Today />;
  if (seg[0] === 'fitness') {
    if (!seg[1]) return <FitnessHome />;
    if (seg[1] === 'history') return <FitnessHistory />;
    if (seg[1] === 'new') return <NewRecordScreen params={params} />;
    return <WorkoutScreen id={seg[1]!} />;
  }
  if (seg[0] === 'travel') {
    if (!seg[1])
      return <TravelHome initialView={params.get('view') === 'wishlist' ? 'wishlist' : 'trips'} />;
    return <TripScreen id={seg[1]!} />;
  }
  if (seg[0] === 'settings') return seg[1] === 'about' ? <About /> : <Settings />;
  return <Today />;
}

function activeTab(path: string) {
  const p = path.split('?')[0]!;
  return tabs.find((tab) => tab.path !== '/' && p.startsWith(tab.path))?.path ?? '/';
}

function TabBar() {
  const { path, navigate } = useRouter();
  const current = activeTab(path);
  const hidden = !isRoot(path);
  return (
    <motion.nav
      className="tabbar"
      aria-label={t('主导航', 'Main')}
      initial={false}
      animate={{ y: hidden ? 140 : 0, x: '-50%', opacity: hidden ? 0 : 1 }}
      transition={{ duration: 0.45, ease: iosEase }}
      inert={hidden || undefined}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const on = current === tab.path;
        return (
          <motion.button
            key={tab.path}
            className={`tab ${on ? 'active' : ''}`}
            whileTap={{ scale: 0.9 }}
            transition={spring}
            aria-current={on ? 'page' : undefined}
            onClick={() => {
              haptic();
              if (on) scrollTop();
              else navigate(tab.path, { root: true });
            }}
          >
            {on && <motion.i className="tab-pill" layoutId="tab-pill" transition={spring} />}
            <motion.span
              className="tab-icon"
              animate={on ? { scale: [1, 0.82, 1.12, 1], y: [0, 1, -2, 0] } : { scale: 1, y: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            >
              <Icon strokeWidth={on ? 2.4 : 2} />
            </motion.span>
            <span>{t(tab.zh, tab.en)}</span>
          </motion.button>
        );
      })}
    </motion.nav>
  );
}
function scrollTop() {
  const screens = document.querySelectorAll<HTMLElement>('.screen-host:not([aria-hidden]) .screen');
  screens[screens.length - 1]?.scrollTo({ top: 0, behavior: 'smooth' });
}

function Sidebar() {
  const { path, navigate } = useRouter();
  const current = activeTab(path);
  return (
    <aside className="sidebar">
      <div className="brand">
        <img src="/icon.svg" alt="" />
        Fubao
      </div>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const on = current === tab.path;
        return (
          <button
            key={tab.path}
            className={`side-link ${on ? 'active' : ''}`}
            onClick={() => (on ? scrollTop() : navigate(tab.path, { root: true }))}
            aria-current={on ? 'page' : undefined}
          >
            {on && <motion.i className="side-pill" layoutId="side-pill" transition={spring} />}
            <Icon strokeWidth={on ? 2.3 : 2} />
            <span>{t(tab.zh, tab.en)}</span>
          </button>
        );
      })}
      <div className="spacer" />
      <p className="faint small" style={{ padding: '0 12px' }}>
        {t('记录训练，收藏旅行。', 'Train. Travel. Remember.')}
      </p>
    </aside>
  );
}

function Shell() {
  const { sheetDepth, owner } = useApp();
  const desktop = typeof matchMedia !== 'undefined' && matchMedia('(min-width: 900px)').matches;
  useEffect(() => {
    const splash = document.getElementById('splash');
    splash?.classList.add('gone');
    const timer = setTimeout(() => splash?.remove(), 500);
    return () => clearTimeout(timer);
  }, []);
  const recede = sheetDepth > 0 && !desktop;
  if (!owner)
    return (
      <>
        <Welcome />
        <Toasts />
      </>
    );
  return (
    <Router
      render={route}
      parentOf={parentOf}
      isRoot={isRoot}
      shell={(outlet) => (
        <div className="app">
          <Sidebar />
          <motion.main
            className="stage"
            animate={
              recede
                ? { scale: 0.92, y: 10, borderRadius: 22 }
                : { scale: 1, y: 0, borderRadius: 0 }
            }
            transition={{ duration: 0.5, ease: iosEase }}
          >
            {outlet}
          </motion.main>
          <TabBar />
          <Toasts />
        </div>
      )}
    />
  );
}

export default function App({ boot }: { boot: Boot }) {
  return (
    <AppProvider boot={boot}>
      <MotionConfig reducedMotion="user">
        <Shell />
      </MotionConfig>
    </AppProvider>
  );
}
