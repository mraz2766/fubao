import { describe, it, expect } from 'vitest';
import {
  dayKey,
  weekBeginning,
  streaks,
  fitnessSummary,
  workoutVolume,
  estimated1RM,
  personalRecords,
  travelDays,
  toKg,
  toDisplayWeight,
  toMeters,
  toDisplayDistance,
  muscleDistribution,
} from '../src/lib/analytics';
import { defaultPreferences, type Workout } from '../src/types/domain';
const workout = (patch: Partial<Workout> = {}): Workout => ({
  id: 'w1',
  user_id: 'u1',
  title: 'Workout',
  mode: 'quick',
  status: 'completed',
  body_parts: [],
  start_at: '2026-09-09T10:00:00Z',
  end_at: '2026-09-09T11:00:00Z',
  timezone: 'Asia/Shanghai',
  note: '',
  visibility: 'private',
  updated_at: '',
  exercises: [],
  ...patch,
});
const detailed = (): Workout =>
  workout({
    mode: 'detailed',
    exercises: [
      {
        id: 'e1',
        exercise_id: '0032',
        name_en: 'Deadlift',
        name_zh: '硬拉',
        target: 'glutes',
        sets: [
          {
            id: 's1',
            weight: 100,
            reps: 8,
            duration: null,
            distance: null,
            rpe: 8,
            note: '',
            completed: true,
          },
          {
            id: 's2',
            weight: 110,
            reps: 6,
            duration: null,
            distance: null,
            rpe: null,
            note: '',
            completed: false,
          },
        ],
      },
    ],
  });
describe('calendar and streaks', () => {
  it('groups across UTC midnight in the selected timezone', () =>
    expect(dayKey('2026-09-09T17:00:00Z', 'Asia/Shanghai')).toBe('2026-09-10'));
  it('handles DST without changing calendar arithmetic', () => {
    expect(dayKey('2026-03-08T07:30:00Z', 'America/New_York')).toBe('2026-03-08');
    expect(weekBeginning('2026-03-08', 1)).toBe('2026-03-02');
  });
  it('supports Monday and Sunday starts across years', () => {
    expect(weekBeginning('2026-01-01', 1)).toBe('2025-12-29');
    expect(weekBeginning('2026-01-01', 0)).toBe('2025-12-28');
  });
  it('deduplicates training days and preserves yesterday streak', () =>
    expect(streaks(['2026-09-08', '2026-09-09', '2026-09-09'], '2026-09-10')).toEqual({
      current: 2,
      longest: 2,
    }));
  it('does not count future workouts toward a streak', () =>
    expect(streaks(['2026-09-11'], '2026-09-10')).toEqual({ current: 0, longest: 0 }));
  it('breaks current streak after a missed day', () =>
    expect(streaks(['2026-09-07', '2026-09-08'], '2026-09-10')).toEqual({
      current: 0,
      longest: 2,
    }));
  it('counts two sessions on one day but only one streak day', () => {
    const s = fitnessSummary(
      [workout(), workout({ id: 'w2' })],
      defaultPreferences,
      new Date('2026-09-10T08:00:00Z'),
    );
    expect(s.weekCount).toBe(2);
    expect(s.current).toBe(1);
    expect(s.weekSeconds).toBe(7200);
  });
  it('excludes active and draft sessions from completed statistics', () => {
    const s = fitnessSummary(
      [workout({ status: 'active' }), workout({ status: 'draft' })],
      defaultPreferences,
    );
    expect(s.totalVolume).toBe(0);
    expect(s.totalSeconds).toBe(0);
  });
});
describe('volume and personal records', () => {
  it('only includes completed weight × reps', () => expect(workoutVolume(detailed())).toBe(800));
  it('does not estimate bodyweight', () => {
    const w = detailed();
    w.exercises[0].sets[0].weight = null;
    expect(workoutVolume(w)).toBe(0);
  });
  it('estimates 1RM only for eligible sets', () => {
    expect(estimated1RM(100, 1)).toBe(100);
    expect(estimated1RM(100, 6)).toBe(120);
    expect(estimated1RM(100, 11)).toBeNull();
    expect(estimated1RM(100, 0)).toBeNull();
  });
  it('identifies PR increase chronologically despite input order', () => {
    const a = detailed(),
      b = detailed();
    b.id = 'w2';
    b.start_at = '2026-09-10T10:00:00Z';
    b.exercises[0].sets[0].weight = 120;
    const p = personalRecords([b, a])[0];
    expect(p.weight).toBe(120);
    expect(p.increase).toBe(20);
  });
  it('recomputes after removal', () => {
    expect(personalRecords([])).toEqual([]);
    expect(personalRecords([detailed()])[0].weight).toBe(100);
  });
  it('counts only completed primary-muscle sets in range', () =>
    expect(
      muscleDistribution(
        [detailed(), workout()],
        defaultPreferences.timezone,
        7,
        new Date('2026-09-10T10:00:00Z'),
      ),
    ).toEqual([{ muscle: 'glutes', sets: 1 }]));
});
describe('travel day unions', () => {
  it('counts an undated entry as zero days', () =>
    expect(travelDays([{ start_date: null, end_date: null }], 2026)).toBe(0));
  it('counts a single date as one day', () =>
    expect(travelDays([{ start_date: '2026-09-10', end_date: null }], 2026)).toBe(1));
  it('deduplicates overlapping trips', () =>
    expect(
      travelDays(
        [
          { start_date: '2026-09-01', end_date: '2026-09-05' },
          { start_date: '2026-09-04', end_date: '2026-09-07' },
        ],
        2026,
      ),
    ).toBe(7));
  it('clips cross-year visits', () =>
    expect(
      travelDays(
        [
          { start_date: '2025-12-29', end_date: '2026-01-03' },
          { start_date: '2026-12-30', end_date: '2027-01-05' },
        ],
        2026,
      ),
    ).toBe(5));
  it('handles leap days', () =>
    expect(travelDays([{ start_date: '2024-02-28', end_date: '2024-03-01' }], 2024)).toBe(3));
});
it('round-trips imperial units without mutating stored values', () => {
  expect(toKg(toDisplayWeight(100, 'lb'), 'lb')).toBeCloseTo(100, 8);
  expect(toMeters(toDisplayDistance(5000, 'mile'), 'mile')).toBeCloseTo(5000, 8);
});

describe('optional measurements', () => {
  it('keeps date-only check-ins stable across timezones and contributes no invented duration', async () => {
    const { workoutDay, knownWorkoutSeconds } = await import('../src/lib/analytics');
    const w = workout({
      time_precision: 'date',
      workout_date: '2026-09-09',
      start_at: '2026-09-09T04:00:00Z',
      end_at: null,
      duration_seconds: null,
      body_parts: ['back'],
    });
    expect(workoutDay(w, 'America/Los_Angeles')).toBe('2026-09-09');
    expect(knownWorkoutSeconds(w)).toBeNull();
    const summary = fitnessSummary([w], defaultPreferences, new Date('2026-09-10T08:00:00Z'));
    expect(summary.weekCount).toBe(1);
    expect(summary.current).toBe(1);
    expect(summary.weekSeconds).toBe(0);
    expect(summary.durationKnown).toBe(false);
    expect(knownWorkoutSeconds({ ...w, duration_seconds: 2700 })).toBe(2700);
  });
  it('recognizes weight-only PR without fabricating volume or estimated 1RM', () => {
    const w = detailed();
    w.exercises[0].sets[0].reps = null;
    expect(workoutVolume(w)).toBe(0);
    expect(personalRecords([w])[0].weight).toBe(100);
    expect(personalRecords([w])[0].estimated).toBe(0);
    w.exercises[0].sets[0].weight = null;
    expect(personalRecords([w])).toEqual([]);
  });
});
