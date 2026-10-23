import { motion } from 'motion/react';
import { ChevronRight, PencilLine } from 'lucide-react';
import { useRouter } from '../core/router';
import { useQuery } from '../core/query';
import { t } from '../core/i18n';
import { keys, type Page, type Workout } from './data';

/** Records left open by the earlier live-workout flow; finishing them is now a plain save. */
export function UnfinishedBanner() {
  const { navigate } = useRouter();
  const { data } = useQuery<Page<Workout>>(keys.active);
  const open = data?.items[0];
  if (!open) return null;
  return (
    <motion.button
      className="unfinished"
      onClick={() => navigate(`/fitness/${open.id}`)}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.98 }}
    >
      <PencilLine />
      <span className="grow ellipsis">
        {t('有一条训练记录还没保存：', 'Unsaved training record: ')}
        <b>{open.title}</b>
      </span>
      <ChevronRight />
    </motion.button>
  );
}
