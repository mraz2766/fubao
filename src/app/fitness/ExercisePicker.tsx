import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Search, Star } from 'lucide-react';
import { Sheet, Press, spring, Skeleton } from '../core/ui';
import { useApp } from '../core/app-state';
import { t, zh, errorMessage, locale } from '../core/i18n';
import { partInfo, partLabel, type Part } from '../core/format';
import { api } from '../../lib/api';
import { taxonomyLabel } from '../../lib/i18n';
import { exerciseCategories } from '../../lib/exercise-categories';
import { trainingPart } from '../../lib/fitness-recording';
import { exerciseThumb, type Exercise } from './data';

interface Result {
  items: Exercise[];
  hasMore: boolean;
}

export function ExerciseThumb({
  id,
  image,
  target,
  size = 48,
}: {
  id: string;
  image?: string | null;
  target: string;
  size?: number;
}) {
  const src = exerciseThumb(id, image);
  const part = trainingPart(target) as Part;
  return src ? (
    <img
      className="ex-thumb"
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="ex-thumb ex-thumb-fallback"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(140deg, ${partInfo[part]?.color ?? '#999'}, ${partInfo[part]?.color ?? '#999'}aa)`,
      }}
    >
      {partLabel(part).slice(0, zh() ? 1 : 2)}
    </span>
  );
}

export function ExercisePicker({
  open,
  onClose,
  onPick,
  hint,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (list: Exercise[]) => void | Promise<void>;
  hint?: Part[];
}) {
  const { toast, owner } = useApp();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<Part | 'all' | 'fav'>('all');
  const [items, setItems] = useState<Exercise[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Exercise[]>([]);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setPicked([]);
      setQ('');
      setCategory(hint?.length === 1 && hint[0] !== 'other' ? hint[0]! : 'all');
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Keep the active category chip visible in the horizontal scroller.
    if (!open) return;
    const timer = setTimeout(
      () =>
        document
          .querySelector('.picker-top .chip.on')
          ?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }),
      60,
    );
    return () => clearTimeout(timer);
  }, [open, category]);

  const fetchPage = async (n: number) => {
    const id = ++seq.current;
    setLoading(true);
    const params = new URLSearchParams({ page: String(n), limit: '30', mode: 'recommended' });
    if (q.trim()) params.set('q', q.trim());
    if (category === 'fav') params.set('favorites', '1');
    else if (category !== 'all') params.set('category', category);
    try {
      const result = await api<Result>(`/api/fitness/exercises?${params}`);
      if (id !== seq.current) return;
      setItems((list) => (n === 0 ? result.items : [...list, ...result.items]));
      setHasMore(result.hasMore);
      setPage(n);
    } catch (error) {
      if (id === seq.current) toast(errorMessage(error), 'error');
    } finally {
      if (id === seq.current) setLoading(false);
    }
  };
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => fetchPage(0), q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [open, q, category]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !loading) void fetchPage(page + 1);
    });
    io.observe(el);
    return () => io.disconnect();
  }); // re-bind with fresh closure

  const toggle = (ex: Exercise) =>
    setPicked((list) =>
      list.some((x) => x.id === ex.id) ? list.filter((x) => x.id !== ex.id) : [...list, ex],
    );
  const favorite = async (ex: Exercise) => {
    const next = !ex.favorite;
    setItems((list) => list.map((x) => (x.id === ex.id ? { ...x, favorite: next } : x)));
    try {
      await api(`/api/fitness/exercises/${ex.id}/favorite`, {
        method: 'POST',
        body: { favorite: next },
      });
    } catch (error) {
      toast(errorMessage(error), 'error');
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      full
      title={t('添加动作', 'Add exercises')}
      footer={
        <Press
          className="btn btn-primary block lg"
          disabled={!picked.length || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onPick(picked);
              onClose();
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? (
            <span className="spinner" />
          ) : picked.length ? (
            t(`添加 ${picked.length} 个动作`, `Add ${picked.length}`)
          ) : (
            t('选择动作', 'Pick exercises')
          )}
        </Press>
      }
    >
      <div className="picker-top">
        <label className="search">
          <Search />
          <input
            className="input"
            type="search"
            enterKeyHint="search"
            placeholder={t('搜索动作，如 卧推、深蹲', 'Search e.g. bench, squat')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <div className="chips scroll" style={{ marginTop: 10 }}>
          <button
            className={`chip ${category === 'all' ? 'on' : ''}`}
            onClick={() => setCategory('all')}
          >
            {t('推荐', 'For you')}
          </button>
          {owner && (
            <button
              className={`chip ${category === 'fav' ? 'on' : ''}`}
              onClick={() => setCategory('fav')}
            >
              <Star />
              {t('收藏', 'Saved')}
            </button>
          )}
          {exerciseCategories.map((c) => (
            <button
              key={c}
              className={`chip ${category === c ? 'on' : ''}`}
              onClick={() => setCategory(c)}
            >
              <i className="dot" style={{ background: partInfo[c].color }} />
              {partLabel(c)}
            </button>
          ))}
        </div>
      </div>
      <div className="ex-list">
        {items.map((ex) => {
          const on = picked.some((x) => x.id === ex.id);
          return (
            <div key={ex.id} className={`ex-item ${on ? 'on' : ''}`}>
              <button className="ex-main" onClick={() => toggle(ex)}>
                <ExerciseThumb id={ex.id} image={ex.image} target={ex.target} />
                <span className="grow">
                  <span className="ex-name">{zh() ? ex.name_zh || ex.name_en : ex.name_en}</span>
                  <span className="ex-meta">
                    {taxonomyLabel(ex.target, locale())} · {taxonomyLabel(ex.equipment, locale())}
                    {ex.usage_count
                      ? ` · ${t(`练过 ${ex.usage_count} 次`, `${ex.usage_count}×`)}`
                      : ''}
                  </span>
                </span>
                <span className={`ex-check ${on ? 'on' : ''}`}>
                  <AnimatePresence>
                    {on && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={spring}
                      >
                        <Check strokeWidth={3} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
              </button>
              {owner && (
                <button
                  className={`ex-fav ${ex.favorite ? 'on' : ''}`}
                  onClick={() => favorite(ex)}
                  aria-label={t('收藏', 'Save')}
                  aria-pressed={!!ex.favorite}
                >
                  <Star />
                </button>
              )}
            </div>
          );
        })}
        {loading &&
          !items.length &&
          Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} h={64} r={16} style={{ marginBottom: 8 }} />
          ))}
        {!loading && !items.length && (
          <p className="empty small">
            {category === 'fav'
              ? t('点击星标收藏常用动作', 'Star exercises to save them')
              : t('没有找到相关动作', 'No matching exercises')}
          </p>
        )}
        <div ref={sentinel} style={{ height: 1 }} />
        {loading && !!items.length && (
          <div style={{ display: 'grid', placeItems: 'center', padding: 16 }}>
            <span className="spinner" />
          </div>
        )}
      </div>
    </Sheet>
  );
}
