import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Clock, Dumbbell, Zap } from 'lucide-react';
import { useRouter } from '../core/router';
import { useApp } from '../core/app-state';
import { prefetch, seedQuery, useQuery } from '../core/query';
import { Press, spring, Skeleton } from '../core/ui';
import { t, locale } from '../core/i18n';
import {
  fmtDate,
  fmtDuration,
  partInfo,
  partLabel,
  relativeDay,
  today,
  weekdayShort,
  type Part,
} from '../core/format';
import { shiftDay, workoutDay } from '../../lib/analytics';
import { keys, type PeriodSummary, type Workout } from './data';

/** Seven day dots; filled days pop in with a stagger. */
export function WeekStrip({ summary }: { summary?: PeriodSummary }) {
  const { prefs } = useApp();
  const todayKey = today(prefs);
  const days = summary?.days ?? [];
  return (
    <div className="week-strip">
      {days.map((d, i) => {
        const trained = d.count > 0;
        const color = partInfo[(d.sessions[0]?.body_parts[0] as Part) ?? 'other']?.color;
        return (
          <div
            key={d.date}
            className={`wday ${d.date === todayKey ? 'today' : ''} ${d.date > todayKey ? 'future' : ''}`}
          >
            <span className="wday-label">{weekdayShort(d.date)}</span>
            <motion.span
              className={`wday-dot ${trained ? 'on' : ''}`}
              style={
                trained
                  ? { background: `linear-gradient(135deg, ${color}, var(--fit-2))` }
                  : undefined
              }
              initial={trained ? { scale: 0 } : false}
              animate={{ scale: 1 }}
              transition={{ ...spring, delay: 0.25 + i * 0.05 }}
            >
              {trained && d.count > 1 ? d.count : ''}
            </motion.span>
          </div>
        );
      })}
      {!days.length && Array.from({ length: 7 }, (_, i) => <Skeleton key={i} h={44} r={12} />)}
    </div>
  );
}

export function MonthCalendar({
  onSelect,
  selected,
}: {
  onSelect: (date: string, s?: PeriodSummary['days'][number]) => void;
  selected: string | null;
}) {
  const { prefs } = useApp();
  const todayKey = today(prefs);
  const [month, setMonth] = useState(todayKey.slice(0, 7) + '-01');
  const [dir, setDir] = useState(0);
  const { data } = useQuery<PeriodSummary>(keys.month(month));
  const shift = (n: number) => {
    const d = new Date(`${month}T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + n);
    setDir(n);
    setMonth(d.toISOString().slice(0, 7) + '-01');
  };
  const cells = useMemo(() => {
    if (!data) return [];
    const first = new Date(`${data.start}T12:00:00Z`).getUTCDay();
    const pad = (first - prefs.weekStart + 7) % 7;
    return [...Array.from({ length: pad }, () => null), ...data.days];
  }, [data, prefs.weekStart]);
  const heads = Array.from({ length: 7 }, (_, i) =>
    weekdayShort(shiftDay('2024-01-07', prefs.weekStart + i)),
  );
  const isFuture = month > todayKey;
  return (
    <div className="card pad calendar">
      <div className="spread" style={{ marginBottom: 12 }}>
        <div>
          <div className="cal-title">
            {new Intl.DateTimeFormat(locale(), {
              year: 'numeric',
              month: 'long',
              timeZone: 'UTC',
            }).format(new Date(`${month}T12:00:00Z`))}
          </div>
          <div className="faint small">
            {data ? t(`${data.count} 次训练`, `${data.count} sessions`) : ' '}
          </div>
        </div>
        <div className="hstack" style={{ gap: 4 }}>
          <Press
            className="icon-btn sm filled"
            onClick={() => shift(-1)}
            aria-label={t('上个月', 'Previous month')}
          >
            <ChevronLeft />
          </Press>
          <Press
            className="icon-btn sm filled"
            onClick={() => shift(1)}
            disabled={month >= todayKey.slice(0, 7) + '-01'}
            aria-label={t('下个月', 'Next month')}
          >
            <ChevronRight />
          </Press>
        </div>
      </div>
      <div className="cal-grid cal-head">
        {heads.map((h, i) => (
          <span key={i}>{h}</span>
        ))}
      </div>
      <div className="cal-body">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={month}
            className="cal-grid"
            custom={dir}
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          >
            {cells.map((d, i) =>
              d ? (
                <button
                  key={d.date}
                  className={`cal-day ${d.count ? 'on' : ''} ${d.date === todayKey ? 'today' : ''} ${selected === d.date ? 'sel' : ''}`}
                  disabled={d.date > todayKey || isFuture}
                  onClick={() => onSelect(d.date, d)}
                  style={
                    d.count
                      ? ({
                          '--c': partInfo[(d.sessions[0]?.body_parts[0] as Part) ?? 'other']?.color,
                        } as React.CSSProperties)
                      : undefined
                  }
                >
                  <span>{Number(d.date.slice(8))}</span>
                </button>
              ) : (
                <span key={`pad-${i}`} />
              ),
            )}
            {!data &&
              Array.from({ length: 35 }, (_, i) => <span key={i} className="cal-day ghost" />)}
          </motion.div>
        </AnimatePresence>
      </div>
      {data && <PartBars summary={data} />}
    </div>
  );
}

export function PartBars({ summary }: { summary: PeriodSummary }) {
  const counts = new Map<string, number>();
  for (const d of summary.days)
    for (const s of d.sessions)
      for (const p of s.body_parts) counts.set(p, (counts.get(p) ?? 0) + 1);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  if (!total) return null;
  const list = [...counts].sort((a, b) => b[1] - a[1]);
  return (
    <div className="part-bars">
      <div className="part-stack">
        {list.map(([p, n], i) => (
          <motion.i
            key={p}
            style={{ background: partInfo[p as Part]?.color ?? '#999' }}
            initial={{ flexGrow: 0 }}
            animate={{ flexGrow: n }}
            transition={{ duration: 0.9, delay: 0.1 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
          />
        ))}
      </div>
      <div className="part-legend">
        {list.map(([p, n]) => (
          <span key={p}>
            <i style={{ background: partInfo[p as Part]?.color ?? '#999' }} />
            {partLabel(p)} <b className="num">{n}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

export function SessionRow({ w, index = 0 }: { w: Workout; index?: number }) {
  const { navigate } = useRouter();
  const { prefs } = useApp();
  const day = workoutDay(w, prefs.timezone);
  const color = partInfo[(w.body_parts[0] as Part) ?? 'other']?.color ?? '#999';
  const seconds =
    w.time_precision === 'date'
      ? w.duration_seconds
      : w.end_at
        ? (Date.parse(w.end_at) - Date.parse(w.start_at)) / 1000
        : null;
  const exercises = w.exercises?.length ?? 0;
  return (
    <motion.button
      className="session-row list-row tappable"
      onClick={() => {
        seedQuery(keys.session(w.id), w);
        navigate(`/fitness/${w.id}`);
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.035, ease: [0.16, 1, 0.3, 1] }}
    >
      <span
        className="session-icon"
        style={{ background: `linear-gradient(140deg, ${color}, ${color}cc)` }}
      >
        {w.mode === 'quick' ? <Zap /> : <Dumbbell />}
      </span>
      <span className="grow">
        <span className="session-title ellipsis">{w.title}</span>
        <span className="session-meta">
          {relativeDay(day, today(prefs))}
          {seconds ? (
            <>
              {' · '}
              <Clock className="inline-icon" />
              {fmtDuration(seconds)}
            </>
          ) : null}
          {exercises ? ` · ${t(`${exercises} 个动作`, `${exercises} exercises`)}` : ''}
        </span>
      </span>
      <span className="session-parts">
        {w.body_parts.slice(0, 3).map((p) => (
          <i key={p} style={{ background: partInfo[p as Part]?.color }} title={partLabel(p)} />
        ))}
      </span>
      <ChevronRight className="chev" />
    </motion.button>
  );
}

export function DaySessions({
  date,
  sessions,
}: {
  date: string;
  sessions: { id: string; title: string; body_parts: string[] }[];
}) {
  const { navigate } = useRouter();
  return (
    <motion.div
      className="day-sessions"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
    >
      <div className="list" style={{ marginTop: 12 }}>
        <div className="list-row">
          <span className="eyebrow">
            {fmtDate(date, { month: 'long', day: 'numeric', weekday: 'long' })}
          </span>
        </div>
        {sessions.length ? (
          sessions.map((s) => (
            <button
              key={s.id}
              className="list-row tappable"
              onPointerDown={() => prefetch(keys.session(s.id))}
              onClick={() => navigate(`/fitness/${s.id}`)}
            >
              <span className="session-parts">
                {s.body_parts.map((p) => (
                  <i key={p} style={{ background: partInfo[p as Part]?.color }} />
                ))}
              </span>
              <span className="grow ellipsis">{s.title}</span>
              <ChevronRight className="chev" />
            </button>
          ))
        ) : (
          <div className="list-row faint">{t('这天休息', 'Rest day')}</div>
        )}
      </div>
    </motion.div>
  );
}

const durationChoices = [0, 30, 45, 60, 90];
/** Shared "which day / how long" pickers: common values are one tap, anything else via the native picker. */
export function DateDurationFields({
  date,
  onDate,
  minutes,
  onMinutes,
}: {
  date: string;
  onDate: (d: string) => void;
  minutes: number;
  onMinutes: (m: number) => void;
}) {
  const { prefs } = useApp();
  const todayKey = today(prefs);
  const quick = [todayKey, shiftDay(todayKey, -1), shiftDay(todayKey, -2)];
  const durations = durationChoices.includes(minutes)
    ? durationChoices
    : [...durationChoices, minutes];
  return (
    <>
      <div className="form-label">{t('日期', 'Date')}</div>
      <div className="chips">
        {quick.map((d, i) => (
          <button key={d} className={`chip ${date === d ? 'on' : ''}`} onClick={() => onDate(d)}>
            {i === 0 ? t('今天', 'Today') : i === 1 ? t('昨天', 'Yesterday') : fmtDate(d)}
          </button>
        ))}
        <label
          className={`chip ${quick.includes(date) ? '' : 'on'}`}
          style={{ position: 'relative' }}
        >
          {quick.includes(date) ? t('其他日期', 'Other') : fmtDate(date)}
          <input
            type="date"
            className="overlay-input"
            max={todayKey}
            value={date}
            onChange={(e) => e.target.value && onDate(e.target.value)}
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
            onClick={() => onMinutes(m)}
          >
            {m ? t(`${m} 分钟`, `${m} min`) : t('不记录', 'Skip')}
          </button>
        ))}
      </div>
    </>
  );
}
