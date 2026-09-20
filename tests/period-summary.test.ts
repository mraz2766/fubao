import { describe, it, expect } from 'vitest';
import { periodBounds, summarizePeriod } from '../src/lib/period-summary';
import { defaultPreferences as prefs, type Workout } from '../src/types/domain';
const workout = (id: string, date: string, patch: Partial<Workout> = {}): Workout => ({
  id,
  user_id: 'u',
  title: '背部',
  mode: 'quick',
  status: 'completed',
  body_parts: ['back'],
  start_at: date + 'T12:00:00Z',
  end_at: null,
  timezone: 'Asia/Shanghai',
  note: '',
  visibility: 'private',
  updated_at: '',
  exercises: [],
  time_precision: 'date',
  workout_date: date,
  ...patch,
});
describe('period summary', () => {
  it('uses configured week starts across year boundaries', () => {
    expect(periodBounds('week', '2027-01-01', 1)).toEqual({
      start: '2026-12-28',
      end: '2027-01-04',
    });
    expect(periodBounds('week', '2027-01-01', 0)).toEqual({
      start: '2026-12-27',
      end: '2027-01-03',
    });
  });
  it('uses leap month length and rounds the monthly goal upward', () => {
    const summary = summarizePeriod([], prefs, 'month', '2028-02-14');
    expect(summary.days).toHaveLength(29);
    expect(summary.goal).toBe(13);
    expect(summary.end).toBe('2028-03-01');
    expect(summarizePeriod([], prefs, 'month', '2027-02-14').days).toHaveLength(28);
    expect(summarizePeriod([], prefs, 'month', '2026-09-20').goal).toBe(13);
  });
  it('counts sessions, not unique days, and excludes unfinished and outside records', () => {
    const summary = summarizePeriod(
      [
        workout('a', '2026-09-16'),
        workout('b', '2026-09-16'),
        workout('c', '2026-09-17', { status: 'draft' }),
        workout('d', '2026-09-18', { status: 'active' }),
        workout('e', '2026-09-21'),
      ],
      prefs,
      'week',
      '2026-09-20',
    );
    expect(summary.count).toBe(2);
    expect(summary.days.find((d) => d.date === '2026-09-16')?.count).toBe(2);
    expect(summary.days.flatMap((d) => d.sessions.map((s) => s.id))).toEqual(['a', 'b']);
  });
  it('uses viewer timezone for timestamps but preserves date-only records', () => {
    const records = [
      workout('a', '2026-09-20', {
        time_precision: 'exact',
        workout_date: null,
        start_at: '2026-09-20T23:30:00Z',
      }),
      workout('b', '2026-09-20'),
    ];
    expect(summarizePeriod(records, prefs, 'week', '2026-09-20').count).toBe(1);
    expect(
      summarizePeriod(records, { ...prefs, timezone: 'UTC' }, 'week', '2026-09-20').count,
    ).toBe(2);
  });
  it('keeps actual counts above the goal and current preference targets', () => {
    const records = Array.from({ length: 5 }, (_, i) => workout(String(i), '2026-09-16'));
    expect(summarizePeriod(records, prefs, 'week', '2026-09-20')).toMatchObject({
      count: 5,
      goal: 3,
    });
    expect(summarizePeriod(records, { ...prefs, weeklyGoal: 4 }, 'week', '2026-09-20').goal).toBe(
      4,
    );
  });
  it('returns explicit empty days and a zero count', () => {
    const summary = summarizePeriod([], prefs, 'week', '2026-09-20');
    expect(summary.count).toBe(0);
    expect(summary.days).toHaveLength(7);
    expect(summary.days.every((d) => d.count === 0 && d.sessions.length === 0)).toBe(true);
  });
  it('covers a December month without spilling into January', () => {
    const summary = summarizePeriod(
      [workout('a', '2026-12-31'), workout('b', '2027-01-01')],
      prefs,
      'month',
      '2026-12-31',
    );
    expect(summary.end).toBe('2027-01-01');
    expect(summary.days).toHaveLength(31);
    expect(summary.count).toBe(1);
  });
});
