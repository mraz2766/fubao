import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronRight } from 'lucide-react';
import { useApp } from '../core/app-state';
import { useRouter } from '../core/router';
import { useQuery } from '../core/query';
import { t } from '../core/i18n';
import { clock } from '../core/format';
import { keys, type Page, type Workout } from './data';

export function useTicker(active = true) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

export function LiveBanner() {
  const { owner } = useApp();
  const { navigate } = useRouter();
  const { data } = useQuery<Page<Workout>>(owner ? keys.active : null);
  const live = data?.items[0];
  const now = useTicker(!!live);
  if (!live) return null;
  return (
    <motion.button
      className="live-banner"
      onClick={() => navigate(`/fitness/${live.id}`)}
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileTap={{ scale: 0.98 }}
    >
      <span className="live-pulse" />
      <span className="grow">
        <span className="live-label">{t('训练进行中', 'Workout in progress')}</span>
        <span className="live-title ellipsis">{live.title}</span>
      </span>
      <span className="live-clock num">{clock((now - Date.parse(live.start_at)) / 1000)}</span>
      <ChevronRight />
    </motion.button>
  );
}
