import { useEffect, useRef, useState } from 'react';
import { Dumbbell } from 'lucide-react';
import { Screen, Empty, Skeleton } from '../core/ui';
import { useApp } from '../core/app-state';
import { useQuery } from '../core/query';
import { api } from '../../lib/api';
import { t, locale } from '../core/i18n';
import { workoutDay } from '../../lib/analytics';
import { SessionRow } from './parts';
import { keys, type Page, type Workout } from './data';

export function FitnessHistory() {
  const { prefs } = useApp();
  const { data: first, loading } = useQuery<Page<Workout>>(keys.sessions(0));
  const [more, setMore] = useState<Workout[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setMore([]);
    setPage(0);
    setHasMore(!!first?.hasMore);
  }, [first]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(async (entries) => {
      if (!entries[0]?.isIntersecting || busy) return;
      setBusy(true);
      try {
        const next = await api<Page<Workout>>(keys.sessions(page + 1));
        setMore((list) => [...list, ...next.items]);
        setPage(page + 1);
        setHasMore(next.hasMore);
      } finally {
        setBusy(false);
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, page, busy]);

  const all = [...(first?.items ?? []), ...more].filter((w) => w.status === 'completed');
  const groups = new Map<string, Workout[]>();
  for (const w of all) {
    const month = workoutDay(w, prefs.timezone).slice(0, 7);
    groups.set(month, [...(groups.get(month) ?? []), w]);
  }
  return (
    <Screen title={t('全部训练', 'All workouts')} tabbar={false} narrow>
      {loading && <Skeleton h={300} r={20} />}
      {!loading && !all.length && (
        <Empty icon={<Dumbbell />} title={t('还没有训练记录', 'No workouts yet')} />
      )}
      {[...groups].map(([month, list]) => (
        <section key={month} className="section" style={{ marginTop: 18 }}>
          <div className="list-label">
            {new Intl.DateTimeFormat(locale(), {
              year: 'numeric',
              month: 'long',
              timeZone: 'UTC',
            }).format(new Date(`${month}-15T12:00:00Z`))}
            <span style={{ float: 'right' }}>{t(`${list.length} 次`, `${list.length}`)}</span>
          </div>
          <div className="list">
            {list.map((w, i) => (
              <SessionRow key={w.id} w={w} index={i} />
            ))}
          </div>
        </section>
      ))}
      <div ref={sentinel} style={{ height: 1 }} />
      {busy && (
        <div style={{ display: 'grid', placeItems: 'center', padding: 20 }}>
          <span className="spinner" />
        </div>
      )}
    </Screen>
  );
}
