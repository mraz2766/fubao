import { describe, it, expect } from 'vitest';
import {
  blankSet,
  recordingType,
  validCompletedSet,
  zonedISO,
  zonedInput,
} from '../src/lib/fitness-recording';
import { setSchema } from '../src/lib/schemas';
import { muscleMapping } from '../src/features/fitness/MuscleFigure';
describe('fitness recording', () => {
  it('persists a partially entered weight until the set is completed', () => {
    const s = { ...blankSet(), weight: 100 };
    expect(setSchema.safeParse(s).success).toBe(true);
    expect(setSchema.safeParse({ ...s, completed: true }).success).toBe(true);
    expect(validCompletedSet({ ...s, reps: 8 }, 'weight')).toBe(true);
  });
  it('allows omitted measurements for every recording type', () => {
    expect(validCompletedSet({ ...blankSet(), reps: 10 }, 'reps')).toBe(true);
    expect(validCompletedSet({ ...blankSet(), duration: 60 }, 'duration')).toBe(true);
    expect(validCompletedSet({ ...blankSet(), duration: 600 }, 'cardio')).toBe(true);
    expect(validCompletedSet({ ...blankSet(), duration: 600, distance: 1000 }, 'cardio')).toBe(
      true,
    );
    expect(recordingType({ name_en: 'push-up', equipment: 'body weight' })).toBe('reps');
    expect(recordingType({ name_en: 'plank', equipment: 'body weight' })).toBe('duration');
  });
  it('converts configured local time independently of device time, across midnight', () => {
    const start = zonedISO('2026-09-09T23:30', 'Asia/Shanghai');
    const end = zonedISO('2026-09-10T00:30', 'Asia/Shanghai');
    expect(Date.parse(end) - Date.parse(start)).toBe(3600000);
    expect(zonedInput(start, 'Asia/Shanghai')).toBe('2026-09-09T23:30');
    expect(zonedISO('2026-07-10T18:00', 'America/New_York')).toBe('2026-07-10T22:00:00.000Z');
    expect(() => zonedISO('2026-03-08T02:30', 'America/New_York')).toThrow();
  });
  it('maps posterior muscles to posterior anatomy', () => {
    expect(muscleMapping.lats).toEqual(['upper-back']);
    expect(muscleMapping.hamstrings).toEqual(['hamstring']);
    expect(muscleMapping.pectorals).toEqual(['chest']);
  });
});
