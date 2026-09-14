import { useEffect, useState, lazy, Suspense } from 'react';
import type { Locale, Trip, Wish } from '../../types/domain';
import { api, errorText } from '../../lib/api';
import { translator } from '../../lib/i18n';
import { chinaPlaces } from './china-places';
import geometry from '../../data/china-map.json';
const Wishlist = lazy(() => import('./Wishlist'));
export default function TravelExtras({
  locale,
  owner,
  kind,
}: {
  locale: Locale;
  owner: boolean;
  kind: 'map' | 'wishlist';
}) {
  const t = translator(locale),
    [trips, setTrips] = useState<Trip[]>([]),
    [wishes, setWishes] = useState<Wish[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    void (async () => {
      try {
        const wish = await api<{ items: Wish[] }>('/api/travel/wishlist');
        if (cancelled) return;
        setWishes(wish.items);
        if (kind === 'map') {
          const all: Trip[] = [];
          let page = 0;
          while (true) {
            const result = await api<{ items: Trip[]; hasMore: boolean }>(
              `/api/travel/entries?page=${page++}`,
            );
            if (cancelled) return;
            all.push(...result.items);
            if (!result.hasMore) break;
          }
          setTrips(all);
        }
      } catch (e) {
        if (!cancelled) setError(errorText(e, locale));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, attempt]);
  if (loading) return <p role="status">{t('common.loading')}</p>;
  if (error)
    return (
      <p role="alert">
        {error} <button onClick={() => setAttempt((n) => n + 1)}>{t('common.retry')}</button>
      </p>
    );
  if (kind === 'wishlist')
    return (
      <Suspense fallback={<p>{t('common.loading')}</p>}>
        <Wishlist locale={locale} owner={owner} initial={wishes} />
      </Suspense>
    );
  const places = chinaPlaces(trips, wishes, locale);
  return (
    <div className="china-map">
      <svg viewBox="0 0 780 520" role="group" aria-label={t('travel.chinaMap')}>
        <path d={geometry.path} fill="var(--surface-soft)" stroke="var(--map-land)" />
        {places
          .filter((p) => p.point)
          .map((p, i) => (
            <a key={i} href={p.href} aria-label={p.name}>
              <circle cx={p.point![0]} cy={p.point![1]} r={22} fill="transparent" />
              <circle
                cx={p.point![0]}
                cy={p.point![1]}
                r={6}
                fill={p.visited ? 'var(--accent)' : 'var(--surface)'}
                stroke="var(--accent)"
                strokeWidth={2}
              />
            </a>
          ))}
      </svg>
      <nav className="map-place-list">
        {places.map((p, i) => (
          <a key={i} href={p.href}>
            {p.name} · {t(p.visited ? 'travel.visited' : 'travel.want')}
          </a>
        ))}
      </nav>
      <a className="text-link" href="/travel?view=map&scope=world">
        {t('travel.worldMap')}
      </a>
    </div>
  );
}
