import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check } from 'lucide-react';
import { Sheet, Press, spring } from '../core/ui';
import { useApp } from '../core/app-state';
import { t, errorMessage } from '../core/i18n';
import { partInfo, parts, partLabel, partsTitle, today, fmtDate, type Part } from '../core/format';
import { shiftDay } from '../../lib/analytics';
import { zonedISO } from '../../lib/fitness-recording';
import { createWorkout, putWorkout, refreshFitness, uid, type Workout } from './data';

const durations = [0, 30, 45, 60, 90];

export function CheckinSheet({
  open,
  onClose,
  editing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Workout | null;
  onSaved?: (w: Workout) => void;
}) {
  const { prefs, toast } = useApp();
  const todayKey = today(prefs);
  const [selected, setSelected] = useState<Part[]>([]);
  const [date, setDate] = useState(todayKey);
  const [minutes, setMinutes] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDone(false);
    setBusy(false);
    if (editing) {
      setSelected(
        editing.body_parts.filter((p): p is Part => (parts as readonly string[]).includes(p)),
      );
      setDate(editing.workout_date ?? editing.start_at.slice(0, 10));
      setMinutes(Math.round((editing.duration_seconds ?? 0) / 60));
    } else {
      setSelected([]);
      setDate(todayKey);
      setMinutes(0);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (p: Part) =>
    setSelected((list) => (list.includes(p) ? list.filter((x) => x !== p) : [...list, p]));

  async function save() {
    if (!selected.length) return;
    setBusy(true);
    try {
      const ordered = parts.filter((p) => selected.includes(p));
      const base: Workout = editing ?? {
        id: uid(),
        user_id: '',
        title: '',
        mode: 'quick',
        status: 'completed',
        body_parts: [],
        start_at: '',
        end_at: null,
        timezone: prefs.timezone,
        note: '',
        visibility: 'private',
        exercises: [],
        updated_at: '',
      };
      const autoTitle = !editing || editing.title === partsTitle(editing.body_parts);
      const w: Workout = {
        ...base,
        title: autoTitle ? partsTitle(ordered) : base.title,
        body_parts: ordered,
        time_precision: 'date',
        workout_date: date,
        start_at: zonedISO(`${date}T12:00`, prefs.timezone),
        end_at: null,
        duration_seconds: minutes ? minutes * 60 : null,
      };
      const saved = editing ? await putWorkout(w) : await createWorkout(w);
      refreshFitness();
      setDone(true);
      onSaved?.(saved);
      setTimeout(() => {
        onClose();
        toast(editing ? t('已更新', 'Updated') : t('打卡成功', 'Checked in'));
      }, 950);
    } catch (error) {
      toast(errorMessage(error), 'error');
      setBusy(false);
    }
  }

  const dateChips = [todayKey, shiftDay(todayKey, -1), shiftDay(todayKey, -2)];
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? t('编辑打卡', 'Edit check-in') : t('今天练了什么？', 'What did you train?')}
      footer={
        !done && (
          <Press
            className="btn btn-fit block lg"
            disabled={!selected.length || busy}
            onClick={save}
          >
            {busy ? (
              <span className="spinner" />
            ) : editing ? (
              t('保存', 'Save')
            ) : (
              t('完成打卡', 'Check in')
            )}
          </Press>
        )
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {done ? (
          <SuccessBurst key="done" />
        ) : (
          <motion.div key="form" exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.15 }}>
            <div className="part-grid">
              {parts.map((p, i) => {
                const on = selected.includes(p);
                return (
                  <motion.button
                    key={p}
                    type="button"
                    className={`part-tile ${on ? 'on' : ''}`}
                    style={{ '--c': partInfo[p].color } as React.CSSProperties}
                    onClick={() => toggle(p)}
                    whileTap={{ scale: 0.92 }}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...spring, delay: i * 0.025 }}
                    aria-pressed={on}
                  >
                    <span className="part-dot" />
                    <span className="part-name">{partLabel(p)}</span>
                    <AnimatePresence>
                      {on && (
                        <motion.span
                          className="part-check"
                          initial={{ scale: 0, rotate: -45 }}
                          animate={{ scale: 1, rotate: 0 }}
                          exit={{ scale: 0 }}
                          transition={spring}
                        >
                          <Check strokeWidth={3.2} />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>

            <div className="form-label">{t('日期', 'Date')}</div>
            <div className="chips">
              {dateChips.map((d, i) => (
                <button
                  key={d}
                  className={`chip ${date === d ? 'on' : ''}`}
                  onClick={() => setDate(d)}
                >
                  {i === 0 ? t('今天', 'Today') : i === 1 ? t('昨天', 'Yesterday') : fmtDate(d)}
                </button>
              ))}
              <label
                className={`chip ${dateChips.includes(date) ? '' : 'on'}`}
                style={{ position: 'relative' }}
              >
                {dateChips.includes(date) ? t('其他日期', 'Other') : fmtDate(date)}
                <input
                  type="date"
                  className="overlay-input"
                  max={todayKey}
                  value={date}
                  onChange={(e) => e.target.value && setDate(e.target.value)}
                />
              </label>
            </div>

            <div className="form-label">
              {t('时长', 'Duration')} <span className="faint">· {t('可选', 'optional')}</span>
            </div>
            <div className="chips">
              {durations.map((m) => (
                <button
                  key={m}
                  className={`chip ${minutes === m ? 'on' : ''}`}
                  onClick={() => setMinutes(m)}
                >
                  {m ? t(`${m} 分钟`, `${m} min`) : t('不记录', 'Skip')}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  );
}

export function SuccessBurst({ label }: { label?: string }) {
  return (
    <motion.div
      className="success-burst"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={spring}
    >
      <div className="burst">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className="ray" style={{ transform: `rotate(${i * 36}deg)` }}>
            <motion.i
              initial={{ scaleY: 0, opacity: 0, y: 14 }}
              animate={{ scaleY: [0, 1, 0.6], opacity: [0, 1, 0], y: [14, 0, -10] }}
              transition={{ duration: 0.75, delay: 0.22, ease: 'easeOut' }}
            />
          </span>
        ))}
        <svg viewBox="0 0 80 80" width="96" height="96">
          <motion.circle
            cx="40"
            cy="40"
            r="36"
            fill="url(#burst-g)"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
          />
          <defs>
            <linearGradient id="burst-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ff8a3d" />
              <stop offset="1" stopColor="#ff2d6f" />
            </linearGradient>
          </defs>
          <motion.path
            d="M24 41 L35 52 L57 29"
            fill="none"
            stroke="#fff"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.4, delay: 0.18, ease: 'easeOut' }}
          />
        </svg>
      </div>
      <p>{label ?? t('又进步了一点', 'One step stronger')}</p>
    </motion.div>
  );
}
