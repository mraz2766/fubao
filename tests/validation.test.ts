import { describe, it, expect } from 'vitest';
import {
  workoutSchema,
  tripSchema,
  setSchema,
  widgetsSchema,
  preferencesSchema,
} from '../src/lib/schemas';
import { defaultWidgets, defaultPreferences } from '../src/types/domain';
import zh from '../src/locales/zh-CN.json';
import en from '../src/locales/en-US.json';
import names from '../data/exercise-names.zh-CN.json';
const trip = {
  id: 'trip1',
  location_id: 'city-1',
  start_date: null,
  end_date: null,
  description: '',
  tags: [],
  rating: null,
  visibility: 'private',
  photo_ids: ['photo1'],
};
describe('travel invariants', () => {
  it('accepts an undated visit with a photo', () =>
    expect(tripSchema.safeParse(trip).success).toBe(true));
  it('rejects zero photos and over six photos', () => {
    expect(tripSchema.safeParse({ ...trip, photo_ids: [] }).success).toBe(false);
    expect(
      tripSchema.safeParse({ ...trip, photo_ids: Array.from({ length: 7 }, (_, i) => `photo${i}`) })
        .success,
    ).toBe(false);
  });
  it('accepts exactly six distinct photos', () =>
    expect(
      tripSchema.safeParse({ ...trip, photo_ids: Array.from({ length: 6 }, (_, i) => `photo${i}`) })
        .success,
    ).toBe(true));
  it('rejects duplicate photo IDs', () =>
    expect(tripSchema.safeParse({ ...trip, photo_ids: ['photo1', 'photo1'] }).success).toBe(false));
  it('rejects reversed dates and an end without a start', () => {
    expect(
      tripSchema.safeParse({ ...trip, start_date: '2026-09-10', end_date: '2026-09-09' }).success,
    ).toBe(false);
    expect(tripSchema.safeParse({ ...trip, end_date: '2026-09-09' }).success).toBe(false);
  });
  it('rejects invalid dates', () =>
    expect(tripSchema.safeParse({ ...trip, start_date: '2026-02-30' }).success).toBe(false));
});
describe('fitness validation', () => {
  const w = {
    id: 'workout1',
    title: 'Workout',
    mode: 'quick',
    status: 'completed',
    start_at: '2026-09-10T08:00:00Z',
    end_at: '2026-09-10T09:00:00Z',
    timezone: 'Asia/Shanghai',
    body_parts: ['back'],
    note: '',
    visibility: 'private',
    exercises: [],
  };
  it('allows quick check-in without any exercises', () =>
    expect(workoutSchema.safeParse(w).success).toBe(true));
  it('allows completed workouts with unknown duration', () =>
    expect(workoutSchema.safeParse({ ...w, end_at: null }).success).toBe(true));
  it('rejects reversed timestamps', () =>
    expect(workoutSchema.safeParse({ ...w, end_at: '2026-09-10T07:00:00Z' }).success).toBe(false));
  it('requires a training item but no measurements', () => {
    expect(workoutSchema.safeParse({ ...w, mode: 'detailed' }).success).toBe(true);
    expect(workoutSchema.safeParse({ ...w, body_parts: [] }).success).toBe(false);
  });
  it('validates RPE and weight/rep relationship', () => {
    const s = {
      id: 'set1',
      reps: null,
      weight: 100,
      duration: null,
      distance: null,
      rpe: 11,
      note: '',
      completed: true,
    };
    expect(setSchema.safeParse(s).success).toBe(false);
    expect(setSchema.safeParse({ ...s, reps: 8, rpe: 8 }).success).toBe(true);
  });
});
it('validates widget identity and order uniqueness', () => {
  expect(widgetsSchema.safeParse(defaultWidgets).success).toBe(true);
  expect(widgetsSchema.safeParse(defaultWidgets.map((w) => ({ ...w, order: 0 }))).success).toBe(
    false,
  );
});
it('validates IANA timezone preferences', () => {
  expect(preferencesSchema.safeParse(defaultPreferences).success).toBe(true);
  expect(
    preferencesSchema.safeParse({ ...defaultPreferences, timezone: 'Fake/Nowhere' }).success,
  ).toBe(false);
});
it('has matching Chinese and English UI keys', () =>
  expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort()));
it('ships complete nonempty exercise title translations', () => {
  expect(Object.keys(names)).toHaveLength(1324);
  for (const name of Object.values(names)) expect(name).toMatch(/[\u3400-\u9fff]/);
});
