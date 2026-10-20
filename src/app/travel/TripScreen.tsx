import { useState } from 'react';
import { AnimatePresence, motion, useTransform } from 'motion/react';
import { CalendarDays, Compass, Globe, Lock, Pencil, Star, Trash2, Sun } from 'lucide-react';
import { Screen, Press, Switch, ConfirmSheet, Skeleton, Empty } from '../core/ui';
import { useApp } from '../core/app-state';
import { useRouter, useScreen } from '../core/router';
import { useQuery, setQueryData } from '../core/query';
import { t, errorMessage } from '../core/i18n';
import { flag, photoUrl, placeContext, placeName, tripDates, tripDays } from '../core/format';
import { TripEditor } from './TripEditor';
import { Lightbox } from './Lightbox';
import { deleteTrip, keys, refreshTravel, saveTrip, type Trip } from './data';

function Hero({ trip }: { trip: Trip }) {
  const { scroller } = useScreen();
  const y = useTransform(scroller, [-200, 0, 400], [0, 0, 140]);
  const scale = useTransform(scroller, [-200, 0], [1.35, 1]);
  const textY = useTransform(scroller, [0, 300], [0, -40]);
  const fade = useTransform(scroller, [0, 260], [1, 0]);
  const cover = trip.photos[0];
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="trip-hero">
      {cover && (
        <motion.img
          src={photoUrl(cover.id, 'large')}
          alt=""
          style={{ y, scale, originY: 0 }}
          onLoad={() => setLoaded(true)}
          initial={{ opacity: 0 }}
          animate={{ opacity: loaded ? 1 : 0 }}
          transition={{ duration: 0.6 }}
        />
      )}
      {cover && !loaded && <img className="trip-hero-blur" src={photoUrl(cover.id)} alt="" />}
      <div className="trip-hero-shade" />
      <motion.div className="trip-hero-text" style={{ y: textY, opacity: fade }}>
        <motion.div
          className="trip-hero-place"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          {placeName(trip.location, trip)}
        </motion.div>
        <motion.div
          className="trip-hero-sub"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          {flag(trip.location.country_code)}{' '}
          {placeContext(trip.location) || (trip.place_name ? placeName(trip.location) : '')}
        </motion.div>
      </motion.div>
    </div>
  );
}

export function TripScreen({ id }: { id: string }) {
  const { owner, toast } = useApp();
  const { back } = useRouter();
  const { data: trip, error, loading } = useQuery<Trip>(keys.entry(id));
  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);

  if (loading)
    return (
      <Screen
        title=""
        large={false}
        tabbar={false}
        overlayNav
        hero={<div className="trip-hero skeleton" style={{ borderRadius: 0 }} />}
      >
        <Skeleton h={120} r={20} style={{ marginTop: 20 }} />
      </Screen>
    );
  if (error || !trip)
    return (
      <Screen title={t('旅程', 'Trip')} large={false} tabbar={false}>
        <Empty
          tone="trav"
          icon={<Compass />}
          title={t('记录不存在或不可访问', 'Not found')}
          text={errorMessage(error)}
        />
      </Screen>
    );

  const days = tripDays(trip);
  const toggleVisibility = async (pub: boolean) => {
    try {
      const saved = await saveTrip({
        id: trip.id,
        location_id: trip.location_id,
        spot_id: trip.spot_id ?? null,
        place_name: trip.place_name ?? '',
        start_date: trip.start_date,
        end_date: trip.end_date,
        description: trip.description,
        tags: trip.tags,
        rating: trip.rating,
        visibility: pub ? 'public' : 'private',
        photo_ids: trip.photos.map((p) => p.id),
        updated_at: trip.updated_at,
      });
      setQueryData(keys.entry(id), () => saved);
      toast(pub ? t('已公开', 'Now public') : t('已设为私密', 'Now private'));
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  return (
    <Screen
      title={placeName(trip.location, trip)}
      large={false}
      tabbar={false}
      overlayNav={trip.photos.length > 0}
      hero={trip.photos.length > 0 ? <Hero trip={trip} /> : undefined}
      narrow
      actions={
        owner && (
          <Press className="icon-btn" onClick={() => setEdit(true)} aria-label={t('编辑', 'Edit')}>
            <Pencil />
          </Press>
        )
      }
    >
      <motion.div
        className="trip-facts"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="fact">
          <CalendarDays />
          <span>{tripDates(trip)}</span>
        </div>
        {days > 1 && (
          <div className="fact">
            <Sun />
            <span>{t(`${days} 天`, `${days} days`)}</span>
          </div>
        )}
        {!!trip.rating && (
          <div className="fact stars-inline">
            {Array.from({ length: 5 }, (_, i) => (
              <Star key={i} className={i < trip.rating! ? 'on' : ''} />
            ))}
          </div>
        )}
        <div className="fact">
          {trip.visibility === 'public' ? <Globe /> : <Lock />}
          <span>{trip.visibility === 'public' ? t('公开', 'Public') : t('私密', 'Private')}</span>
        </div>
      </motion.div>

      {trip.description && (
        <motion.p
          className="trip-story"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.22 }}
        >
          {trip.description}
        </motion.p>
      )}
      {!!trip.tags.length && (
        <div className="chips" style={{ marginTop: 14 }}>
          {trip.tags.map((tag) => (
            <span key={tag} className="badge trav">
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className={`gallery n${Math.min(trip.photos.length, 6)}`}>
        {trip.photos.map((p, i) => (
          <motion.button
            key={p.id}
            data-photo={p.id}
            className="gallery-item"
            style={{
              aspectRatio: trip.photos.length === 1 ? `${p.width} / ${p.height}` : undefined,
            }}
            onClick={() => setLightbox(i)}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: lightbox === i ? 0 : 1, scale: 1 }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.45, delay: lightbox === null ? 0.25 + i * 0.05 : 0 }}
          >
            <img
              src={photoUrl(p.id, trip.photos.length === 1 || i === 0 ? 'large' : 'thumbnail')}
              alt=""
              loading="lazy"
            />
          </motion.button>
        ))}
      </div>

      {owner && (
        <div className="section">
          <div className="list">
            <div className="list-row">
              <span className="row-icon" style={{ background: 'var(--trav)' }}>
                <Globe />
              </span>
              <span className="grow">{t('公开展示', 'Public')}</span>
              <Switch
                on={trip.visibility === 'public'}
                onChange={toggleVisibility}
                label={t('公开展示', 'Public')}
              />
            </div>
            <button className="list-row tappable danger-text" onClick={() => setDel(true)}>
              <span className="row-icon" style={{ background: 'var(--danger)' }}>
                <Trash2 />
              </span>
              <span className="grow">{t('删除旅程', 'Delete trip')}</span>
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {lightbox !== null && (
          <Lightbox
            key="lb"
            photos={trip.photos}
            start={lightbox}
            onClose={() => setLightbox(null)}
          />
        )}
      </AnimatePresence>
      <TripEditor
        open={edit}
        trip={trip}
        onClose={() => setEdit(false)}
        onSaved={(saved) => {
          setQueryData(keys.entry(id), () => saved);
          refreshTravel();
        }}
      />
      <ConfirmSheet
        open={del}
        title={t('删除这段旅程？', 'Delete this trip?')}
        text={t(
          '照片也会一并删除，无法恢复。',
          'Photos will be deleted too. This cannot be undone.',
        )}
        confirm={t('删除', 'Delete')}
        danger
        onClose={() => setDel(false)}
        onConfirm={async () => {
          try {
            await deleteTrip(trip.id);
            setDel(false);
            back('/travel');
            toast(t('已删除', 'Deleted'), 'info');
          } catch (e) {
            toast(errorMessage(e), 'error');
          }
        }}
      />
    </Screen>
  );
}
