import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Camera, Compass, Heart, MapPin, Plus, Star, Trash2, ImageOff } from 'lucide-react';
import { Screen, Press, Segmented, CountUp, Reveal, Empty, Skeleton, spring } from '../core/ui';
import { useApp } from '../core/app-state';
import { useRouter } from '../core/router';
import { prefetch, seedQuery, useQuery } from '../core/query';
import { api } from '../../lib/api';
import { t, errorMessage } from '../core/i18n';
import { flag, photoUrl, placeContext, placeName, tripDates } from '../core/format';
import { WorldMap } from './WorldMap';
import { TripEditor } from './TripEditor';
import { PlacePicker } from './PlacePicker';
import {
  addWish,
  keys,
  removeWish,
  spots,
  type AtlasItem,
  type Page,
  type Trip,
  type Wish,
} from './data';

interface Dashboard {
  travel: { countries: number; cities: number; trips: number; days: number };
}

export function TravelHero() {
  const { owner } = useApp();
  const { navigate } = useRouter();
  const { data: atlas } = useQuery<{ items: AtlasItem[] }>(keys.atlas);
  const { data: dash } = useQuery<Dashboard>(keys.dashboard);
  const [focus, setFocus] = useState(false);
  const [editor, setEditor] = useState(false);
  const stats = dash?.travel;
  return (
    <div className="trav-hero">
      <div className="map-card">
        <div className="map-top">
          <div>
            <div className="map-eyebrow">{t('我的足迹', 'My footprints')}</div>
            <div className="map-headline">
              {stats ? (
                <>
                  <CountUp value={stats.countries} />{' '}
                  {t('个国家', stats.countries === 1 ? 'country' : 'countries')} ·{' '}
                  <CountUp value={stats.cities} />{' '}
                  {t('座城市', stats.cities === 1 ? 'city' : 'cities')}
                </>
              ) : (
                ' '
              )}
            </div>
          </div>
          {!!atlas?.items.length && (
            <Segmented
              className="map-seg"
              value={focus ? 'focus' : 'world'}
              options={[
                { value: 'world', label: t('全球', 'World') },
                { value: 'focus', label: t('聚焦', 'Focus') },
              ]}
              onChange={(v) => setFocus(v === 'focus')}
            />
          )}
        </div>
        <WorldMap
          items={atlas?.items ?? []}
          focus={focus}
          onPoint={(id) => {
            prefetch(keys.entry(id));
            navigate(`/travel/${id}`);
          }}
        />
        <div className="map-stats">
          <div>
            <b className="num">
              <CountUp value={stats?.trips ?? 0} />
            </b>
            <span>{t('段旅程', 'trips')}</span>
          </div>
          <div>
            <b className="num">
              <CountUp value={stats?.days ?? 0} />
            </b>
            <span>{t('今年在路上（天）', 'days on the road')}</span>
          </div>
          {owner && (
            <Press className="btn btn-trav map-cta" onClick={() => setEditor(true)}>
              <Plus strokeWidth={2.6} />
              {t('记录旅行', 'Add trip')}
            </Press>
          )}
        </div>
      </div>
      <TripEditor
        open={editor}
        onClose={() => setEditor(false)}
        onSaved={(trip) => navigate(`/travel/${trip.id}`)}
      />
    </div>
  );
}

export function TripCard({
  trip,
  index = 0,
  large = false,
}: {
  trip: Trip;
  index?: number;
  large?: boolean;
}) {
  const { navigate } = useRouter();
  const cover = trip.photos[0];
  const [loaded, setLoaded] = useState(false);
  return (
    <motion.button
      className={`trip-card ${large ? 'large' : ''}`}
      onClick={() => {
        seedQuery(keys.entry(trip.id), trip);
        navigate(`/travel/${trip.id}`);
      }}
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: Math.min(index, 6) * 0.05 }}
    >
      {cover ? (
        <motion.img
          src={photoUrl(cover.id, large ? 'large' : 'thumbnail')}
          alt=""
          loading="lazy"
          onLoad={() => setLoaded(true)}
          initial={false}
          animate={{ opacity: loaded ? 1 : 0, scale: loaded ? 1 : 1.06 }}
          transition={{ duration: 0.6 }}
        />
      ) : (
        <div className="trip-card-blank">
          <ImageOff />
        </div>
      )}
      <div className="trip-card-shade" />
      <div className="trip-card-info">
        <div className="trip-card-title ellipsis">{placeName(trip.location, trip)}</div>
        <div className="trip-card-meta ellipsis">
          {flag(trip.location.country_code)} {tripDates(trip)}
        </div>
      </div>
      {trip.photos.length > 1 && (
        <span className="trip-card-count">
          <Camera />
          {trip.photos.length}
        </span>
      )}
      {!!trip.rating && (
        <span className="trip-card-rating">
          <Star />
          {trip.rating}
        </span>
      )}
    </motion.button>
  );
}

function TripsView() {
  const { owner } = useApp();
  const { data: first, loading } = useQuery<Page<Trip>>(keys.entries(0));
  const [more, setMore] = useState<Trip[]>([]);
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
    const io = new IntersectionObserver(
      async (entries) => {
        if (!entries[0]?.isIntersecting || busy) return;
        setBusy(true);
        try {
          const next = await api<Page<Trip>>(keys.entries(page + 1));
          setMore((list) => [...list, ...next.items]);
          setPage(page + 1);
          setHasMore(next.hasMore);
        } finally {
          setBusy(false);
        }
      },
      { rootMargin: '400px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, page, busy]);
  const trips = [...(first?.items ?? []), ...more];
  const years = new Map<string, Trip[]>();
  for (const trip of trips) {
    const y = trip.start_date?.slice(0, 4) ?? t('未标注日期', 'Undated');
    years.set(y, [...(years.get(y) ?? []), trip]);
  }
  if (loading)
    return (
      <div className="trip-grid">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} h={240} r={24} />
        ))}
      </div>
    );
  if (!trips.length)
    return (
      <div className="card">
        <Empty
          tone="trav"
          icon={<Compass />}
          title={t('第一段旅程从这里开始', 'Your first trip starts here')}
          text={
            owner
              ? t(
                  '选个地点就能记下一段旅程，照片可以之后再加。',
                  'Pick a place to log a trip; photos are optional.',
                )
              : undefined
          }
        />
      </div>
    );
  let index = 0;
  return (
    <>
      {[...years].map(([year, list]) => (
        <section key={year} className="year-block">
          <div className="year-head">
            <span className="year num">{year}</span>
            <span className="faint small">
              {t(`${list.length} 段旅程`, `${list.length} trips`)}
            </span>
          </div>
          <div className="trip-grid">
            {list.map((trip) => (
              <TripCard key={trip.id} trip={trip} index={index++} />
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
    </>
  );
}

function WishView() {
  const { owner, toast } = useApp();
  const { data: wishes } = useQuery<{ items: Wish[] }>(keys.wishlist);
  const [picker, setPicker] = useState(false);
  const spotImage = (id?: string | null) => spots.find((s) => s.id === id)?.image.thumbnail;
  return (
    <>
      <section>
        <div className="section-head">
          <h2>{t('想去的地方', 'Wishlist')}</h2>
          {owner && (
            <Press className="btn sm" onClick={() => setPicker(true)}>
              <Plus />
              {t('添加', 'Add')}
            </Press>
          )}
        </div>
        {wishes?.items.length ? (
          <div className="wish-list">
            <AnimatePresence initial={false}>
              {wishes.items.map((w, i) => {
                const img = spotImage(w.spot_id);
                return (
                  <motion.div
                    key={w.id}
                    layout
                    className="wish-item card"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ ...spring, delay: i * 0.03 }}
                  >
                    {img ? (
                      <img src={img} alt="" />
                    ) : (
                      <span className="wish-flag">
                        {flag(w.location.country_code) || <MapPin />}
                      </span>
                    )}
                    <div className="grow">
                      <div className="wish-name ellipsis">{placeName(w.location)}</div>
                      <div className="faint small ellipsis">{placeContext(w.location)}</div>
                    </div>
                    {owner && (
                      <Press
                        className="icon-btn sm"
                        aria-label={t('移除', 'Remove')}
                        onClick={async () => {
                          try {
                            await removeWish(w.id);
                          } catch (error) {
                            toast(errorMessage(error), 'error');
                          }
                        }}
                      >
                        <Trash2 />
                      </Press>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div className="card">
            <Empty
              tone="trav"
              icon={<Heart />}
              title={t('还没有想去的地方', 'Nothing saved yet')}
              text={
                owner
                  ? t('点「添加」收藏下一个目的地。', 'Tap “Add” to save your next destination.')
                  : undefined
              }
            />
          </div>
        )}
      </section>
      <PlacePicker
        open={picker}
        onClose={() => setPicker(false)}
        title={t('添加想去的地方', 'Add to wishlist')}
        allowManual={false}
        onPick={async (loc) => {
          try {
            await addWish(loc);
            toast(t('已加入想去', 'Added to wishlist'));
          } catch (error) {
            toast(errorMessage(error), 'error');
          }
        }}
      />
    </>
  );
}

export function TravelHome({ initialView }: { initialView: 'trips' | 'wishlist' }) {
  const [view, setView] = useState(initialView);
  return (
    <Screen
      title={t('旅行', 'Travel')}
      subtitle={t('把走过的路，收进地图里', 'Every road, on one map')}
    >
      <Reveal>
        <TravelHero />
      </Reveal>
      <div className="trav-switch">
        <Segmented
          value={view}
          options={[
            { value: 'trips', label: t('足迹', 'Trips') },
            { value: 'wishlist', label: t('想去', 'Wishlist') },
          ]}
          onChange={(v) => setView(v)}
        />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={view}
          initial={{ opacity: 0, x: view === 'trips' ? -24 : 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: view === 'trips' ? -24 : 24 }}
          transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
        >
          {view === 'trips' ? <TripsView /> : <WishView />}
        </motion.div>
      </AnimatePresence>
    </Screen>
  );
}
