import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Locale } from '../../types/domain';
import { translator } from '../../lib/i18n';
import { shiftDay, weekBeginning } from '../../lib/analytics';
import { Button } from '../../components/ui/button';
export default function HistoryCalendar({
  locale,
  weekStart,
  today,
  days,
  selected,
}: {
  locale: Locale;
  weekStart: number;
  today: string;
  days: Record<
    string,
    {
      count: number;
      minutes: number;
      durationKnown?: boolean;
      volume: number;
      sets: number;
      exercises: number;
    }
  >;
  selected?: string;
}) {
  const t = translator(locale),
    [view, setView] = useState<'week' | 'month' | 'year'>('month'),
    [cursor, setCursor] = useState((selected ?? today).slice(0, 7) + '-01');
  const year = Number(cursor.slice(0, 4)),
    month = Number(cursor.slice(5, 7));
  const first = weekBeginning(view === 'week' ? (selected ?? today) : cursor, weekStart),
    count = view === 'week' ? 7 : 42;
  const label = (date: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options }).format(
      new Date(date + 'T12:00:00Z'),
    );
  function move(direction: number) {
    if (view === 'year') setCursor(`${year + direction}-01-01`);
    else if (view === 'week') setCursor(shiftDay(cursor, direction * 7));
    else {
      const d = new Date(Date.UTC(year, month - 1 + direction, 1, 12));
      setCursor(d.toISOString().slice(0, 10));
    }
  }
  const actualFirst = view === 'week' ? weekBeginning(cursor, weekStart) : first;
  return (
    <section className="calendar card">
      <div className="calendar-controls">
        <div className="segmented">
          {(['week', 'month', 'year'] as const).map((v) => (
            <button
              type="button"
              key={v}
              className={view === v ? 'active' : ''}
              onClick={() => {
                setView(v);
                if (v === 'week') setCursor(selected ?? today);
                else if (v === 'month') setCursor(cursor.slice(0, 7) + '-01');
              }}
            >
              {t(`fitness.${v}`)}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('common.previous')}
            onClick={() => move(-1)}
          >
            <ChevronLeft size={17} />
          </Button>
          <span className="small mono">
            {view === 'year' ? year : label(cursor, { year: 'numeric', month: 'long' })}
          </span>
          <Button variant="ghost" size="icon" aria-label={t('common.next')} onClick={() => move(1)}>
            <ChevronRight size={17} />
          </Button>
        </div>
      </div>
      {view === 'year' ? (
        <div className="year-grid">
          {Array.from({ length: 12 }, (_, i) => {
            const prefix = `${year}-${String(i + 1).padStart(2, '0')}`,
              total = Object.entries(days)
                .filter(([d]) => d.startsWith(prefix))
                .reduce((n, [, v]) => n + v.count, 0);
            return (
              <button
                type="button"
                className="year-month"
                key={prefix}
                onClick={() => {
                  setCursor(prefix + '-01');
                  setView('month');
                }}
              >
                <span>{label(prefix + '-01', { month: 'short' })}</span>
                <small>
                  {total} {t('common.times')}
                </small>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="calendar-grid">
          {Array.from({ length: 7 }, (_, i) => (
            <span className="calendar-weekday" key={i}>
              {label(shiftDay(actualFirst, i), { weekday: 'short' })}
            </span>
          ))}
          {Array.from({ length: count }, (_, i) => {
            const day = shiftDay(actualFirst, i),
              data = days[day];
            return (
              <a
                key={day}
                className={`calendar-day ${data ? 'trained' : ''} ${selected === day ? 'selected' : ''}`}
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  color:
                    view === 'month' && day.slice(0, 7) !== cursor.slice(0, 7)
                      ? 'var(--muted)'
                      : undefined,
                  background: data
                    ? `color-mix(in srgb, var(--accent) ${Math.min(35, 12 + data.minutes / 5)}%, var(--surface))`
                    : undefined,
                }}
                href={`/fitness?day=${day}`}
                aria-label={`${day}: ${data ? `${data.count} ${t('common.times')}, ${data.durationKnown ? `${Math.round(data.minutes)} ${t('common.minutes')}` : t('simple.notRecorded')}, ${data.exercises} ${t('fitness.library')}, ${data.sets} ${t('fitness.set')}` : t('dashboard.rest')}`}
                title={
                  data
                    ? `${data.durationKnown ? `${Math.round(data.minutes)} ${t('common.minutes')}` : t('simple.notRecorded')} · ${data.sets} ${t('fitness.set')}`
                    : day
                }
              >
                {Number(day.slice(8))}
                {data && <span className="tiny-dot" />}
              </a>
            );
          })}
        </div>
      )}
    </section>
  );
}
