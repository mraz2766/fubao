import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { Locale } from '../../types/domain';
import type { PeriodSummary, SummaryPeriod } from '../../lib/period-summary';
import { periodBounds } from '../../lib/period-summary';
import { shiftDay, weekBeginning } from '../../lib/analytics';
import { api, errorText } from '../../lib/api';
export default function FitnessSummary({
  initial,
  today,
  weekStart,
  locale,
  owner,
}: {
  initial: PeriodSummary;
  today: string;
  weekStart: number;
  locale: Locale;
  owner: boolean;
}) {
  const zh = locale === 'zh-CN';
  const [selection, setSelection] = useState({ period: initial.period, date: today });
  const [data, setData] = useState(initial);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  const first = useRef(true);
  const bounds = periodBounds(selection.period, selection.date, weekStart);
  const current = periodBounds(selection.period, today, weekStart);
  const isCurrent = bounds.start === current.start;
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setSelectedDay(null);
    api<PeriodSummary>(`/api/fitness/summary?period=${selection.period}&date=${selection.date}`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorText(e, locale));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [selection.period, selection.date, retry, locale]);
  function change(period: SummaryPeriod, date: string) {
    setLoading(true);
    setError('');
    setSelectedDay(null);
    setSelection({ period, date });
  }
  function move(direction: number) {
    const date =
      selection.period === 'week'
        ? shiftDay(bounds.start, 7 * direction)
        : new Date(
            Date.UTC(
              Number(bounds.start.slice(0, 4)),
              Number(bounds.start.slice(5, 7)) - 1 + direction,
              1,
              12,
            ),
          )
            .toISOString()
            .slice(0, 10);
    change(selection.period, date);
  }
  const format = (date: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options }).format(
      new Date(date + 'T12:00:00Z'),
    );
  const selected = data.days.find((day) => day.date === selectedDay);
  const circumference = 2 * Math.PI * 65;
  const maximum = Math.max(1, ...data.days.map((day) => day.count));
  const offset = (new Date(data.start + 'T12:00:00Z').getUTCDay() - weekStart + 7) % 7;
  return (
    <section className="fitness-summary" aria-labelledby="fitness-summary-title">
      <div className="section-heading">
        <h2 id="fitness-summary-title">{zh ? '训练汇总' : 'Training'}</h2>
        <div className="segmented summary-tabs" aria-label={zh ? '统计周期' : 'Period'}>
          {(['week', 'month'] as const).map((period) => (
            <button
              key={period}
              type="button"
              aria-pressed={selection.period === period}
              onClick={() => {
                if (selection.period !== period) change(period, selection.date);
              }}
            >
              {period === 'week' ? (zh ? '周' : 'Week') : zh ? '月' : 'Month'}
            </button>
          ))}
        </div>
      </div>
      <div className="summary-period">
        <button
          type="button"
          className="button button-ghost button-icon"
          aria-label={zh ? '上一个周期' : 'Previous period'}
          onClick={() => move(-1)}
        >
          <ChevronLeft size={18} />
        </button>
        <span>
          {selection.period === 'month'
            ? format(bounds.start, { year: 'numeric', month: 'long' })
            : `${format(bounds.start, { year: 'numeric', month: 'short', day: 'numeric' })} – ${format(shiftDay(bounds.end, -1), { month: 'short', day: 'numeric' })}`}
        </span>
        <button
          type="button"
          className="button button-ghost button-icon"
          disabled={isCurrent}
          aria-label={zh ? '下一个周期' : 'Next period'}
          onClick={() => move(1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      {!isCurrent && (
        <button
          type="button"
          className="summary-return text-link"
          onClick={() => change(selection.period, today)}
        >
          {zh ? '返回当前周期' : 'Back to current period'}
        </button>
      )}
      <div className="summary-content" aria-busy={loading}>
        {loading ? (
          <div className="summary-placeholder" role="status">
            {zh ? '加载中…' : 'Loading…'}
          </div>
        ) : error ? (
          <div className="summary-placeholder" role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setRetry((v) => v + 1)}
            >
              {zh ? '重试' : 'Retry'}
            </button>
          </div>
        ) : (
          <>
            <div
              className="summary-ring"
              role="img"
              aria-label={
                zh
                  ? `已训练 ${data.count} 次，目标 ${data.goal} 次`
                  : `${data.count} workouts, goal ${data.goal}`
              }
            >
              <svg viewBox="0 0 160 160" aria-hidden="true">
                <circle cx="80" cy="80" r="65" className="ring-track" />
                <circle
                  cx="80"
                  cy="80"
                  r="65"
                  className="ring-progress"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - Math.min(data.count / data.goal, 1))}
                />
              </svg>
              <div>
                <strong>
                  {data.count}
                  <small>{zh ? '次' : 'sessions'}</small>
                </strong>
                <span>{zh ? `目标 ${data.goal} 次` : `Goal ${data.goal}`}</span>
              </div>
            </div>
            {selection.period === 'week' ? (
              <div className="summary-week">
                {data.days.map((day) => (
                  <button
                    type="button"
                    key={day.date}
                    disabled={day.date > today}
                    aria-pressed={selectedDay === day.date}
                    aria-label={`${day.date} · ${day.count} ${zh ? '次' : 'workouts'}`}
                    onClick={() => setSelectedDay(day.date)}
                  >
                    <span className="week-bar-space">
                      <span
                        className="week-bar"
                        style={{
                          height: `${day.count ? Math.max(12, (day.count / maximum) * 60) : 3}px`,
                        }}
                      />
                      <small>{day.count || '–'}</small>
                    </span>
                    <span>{format(day.date, { weekday: 'narrow' })}</span>
                    <span className="summary-day-number">{Number(day.date.slice(-2))}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="summary-month">
                {Array.from({ length: 7 }, (_, i) => (
                  <span className="summary-weekday" key={`label-${i}`}>
                    {format(shiftDay(weekBeginning(data.start, weekStart), i), {
                      weekday: 'narrow',
                    })}
                  </span>
                ))}
                {Array.from({ length: offset }, (_, i) => (
                  <span key={`blank-${i}`} aria-hidden="true" />
                ))}
                {data.days.map((day) => (
                  <button
                    type="button"
                    key={day.date}
                    disabled={day.date > today}
                    aria-pressed={selectedDay === day.date}
                    aria-label={`${day.date} · ${day.count} ${zh ? '次' : 'workouts'}`}
                    className={day.count ? 'trained' : ''}
                    onClick={() => setSelectedDay(day.date)}
                  >
                    <span>{Number(day.date.slice(-2))}</span>
                    <small>{day.count ? `${day.count}${zh ? '次' : ''}` : '·'}</small>
                  </button>
                ))}
              </div>
            )}
            {selected && (
              <div className="summary-day-records" aria-live="polite">
                <h3>
                  {format(selected.date, { month: 'long', day: 'numeric' })}{' '}
                  <span className="muted">
                    · {selected.count} {zh ? '次' : 'sessions'}
                  </span>
                </h3>
                {selected.sessions.length ? (
                  selected.sessions.map((session) => (
                    <a key={session.id} href={`/fitness/${session.id}`}>
                      {session.title}
                      <ChevronRight size={16} />
                    </a>
                  ))
                ) : (
                  <p className="muted small">
                    {zh ? '当天没有训练记录' : 'No workouts on this day'}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
      <a className="button summary-record" href={owner ? '/fitness/new' : '/login'}>
        <Plus size={17} />
        {zh ? '记录训练' : 'Record workout'}
      </a>
    </section>
  );
}
