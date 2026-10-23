import { motion } from 'motion/react';
import { useState } from 'react';
import { ChevronRight, Dumbbell, Plane } from 'lucide-react';
import { Screen, Press, Reveal, Skeleton, Empty } from '../core/ui';
import { useApp } from '../core/app-state';
import { useRouter } from '../core/router';
import { useQuery } from '../core/query';
import { t, zh, locale } from '../core/i18n';
import { FitnessHero } from '../fitness/FitnessHome';
import { UnfinishedBanner } from '../fitness/UnfinishedBanner';
import { CheckinSheet } from '../fitness/CheckinSheet';
import { TripEditor } from '../travel/TripEditor';
import { TripCard } from '../travel/TravelHome';
import { keys as travelKeys, type Trip } from '../travel/data';

interface Dashboard {
  travel: { countries: number; cities: number; trips: number; days: number; recent: Trip | null };
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return t('夜深了', 'Late night');
  if (h < 11) return t('早上好', 'Good morning');
  if (h < 14) return t('中午好', 'Good afternoon');
  if (h < 18) return t('下午好', 'Good afternoon');
  return t('晚上好', 'Good evening');
}

export function Today() {
  const { user } = useApp();
  const [checkin, setCheckin] = useState(false);
  const [trip, setTrip] = useState(false);
  const { navigate } = useRouter();
  const { data: dash, loading } = useQuery<Dashboard>(travelKeys.dashboard);
  const date = new Intl.DateTimeFormat(locale(), {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date());
  const travel = dash?.travel;
  return (
    <Screen title={greeting()} subtitle={date}>
      <Reveal className="quick-actions">
        <motion.button
          className="quick-tile fit"
          whileTap={{ scale: 0.96 }}
          onClick={() => setCheckin(true)}
        >
          <span className="quick-icon">
            <Dumbbell />
          </span>
          <b>{t('记录训练', 'Log training')}</b>
          <span>{t('选部位即可', 'Pick body parts')}</span>
        </motion.button>
        <motion.button
          className="quick-tile trav"
          whileTap={{ scale: 0.96 }}
          onClick={() => setTrip(true)}
        >
          <span className="quick-icon">
            <Plane />
          </span>
          <b>{t('记录旅行', 'Log a trip')}</b>
          <span>{t('地点 + 照片', 'Place + photos')}</span>
        </motion.button>
      </Reveal>
      <UnfinishedBanner />
      <div className="grid-2">
        <Reveal>
          <div className="section-head">
            <h2>{t('训练', 'Training')}</h2>
            <Press className="link" onClick={() => navigate('/fitness', { root: true })}>
              {t('详情', 'More')}
              <ChevronRight />
            </Press>
          </div>
          <FitnessHero compact actions={false} />
        </Reveal>
        <Reveal delay={0.08}>
          <div className="section-head">
            <h2>{t('最近的旅程', 'Latest trip')}</h2>
            <Press className="link" onClick={() => navigate('/travel', { root: true })}>
              {t('足迹', 'Trips')}
              <ChevronRight />
            </Press>
          </div>
          {loading ? (
            <Skeleton h={300} r={24} />
          ) : travel?.recent ? (
            <div className="today-trip">
              <TripCard trip={travel.recent} large />
              <div className="today-trip-stats">
                {[
                  [travel.countries, t('国家', 'Countries')],
                  [travel.cities, t('城市', 'Cities')],
                  [travel.days, t('今年天数', 'Days this year')],
                ].map(([n, label], i) => (
                  <motion.div
                    key={String(label)}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.06 }}
                  >
                    <b className="num">{n}</b>
                    <span>{label}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card">
              <Empty
                tone="trav"
                icon={<Plane />}
                title={t('还没有旅程', 'No trips yet')}
                text={t(
                  '点上方「记录旅行」，选个地点就能开始。',
                  'Tap “Log a trip” above and pick a place.',
                )}
              />
            </div>
          )}
        </Reveal>
      </div>

      {user && (
        <p className="faint small" style={{ textAlign: 'center', marginTop: 28 }}>
          {t('今天也是好好生活的一天', 'Make today count')} · {user.username}
        </p>
      )}
      <CheckinSheet open={checkin} onClose={() => setCheckin(false)} />
      <TripEditor
        open={trip}
        onClose={() => setTrip(false)}
        onSaved={(saved) => navigate(`/travel/${saved.id}`)}
      />
    </Screen>
  );
}
