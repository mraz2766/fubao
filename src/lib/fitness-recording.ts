import type { FitnessSet, RecordingType, SessionExercise } from '../types/domain';
export function recordingType(
  e: Pick<SessionExercise, 'recording_type' | 'equipment' | 'name_en'>,
): Exclude<RecordingType, 'auto'> {
  if (e.recording_type && e.recording_type !== 'auto') return e.recording_type;
  if (/plank|stretch|hold/i.test(e.name_en)) return 'duration';
  if (/run|treadmill|bicycl|elliptical|rowing machine/i.test(e.name_en)) return 'cardio';
  return e.equipment === 'body weight' ? 'reps' : 'weight';
}
export function validCompletedSet(s: FitnessSet, type: RecordingType) {
  if (type === 'weight') return s.weight !== null && s.weight >= 0 && s.reps !== null && s.reps > 0;
  if (type === 'reps') return s.reps !== null && s.reps > 0;
  if (type === 'duration') return s.duration !== null && s.duration > 0;
  if (type === 'cardio')
    return s.duration !== null && s.duration > 0 && s.distance !== null && s.distance > 0;
  return (
    (s.reps !== null || s.duration !== null || s.distance !== null) &&
    (s.weight === null || s.reps !== null)
  );
}
export const blankSet = (): FitnessSet => ({
  id: crypto.randomUUID(),
  reps: null,
  weight: null,
  duration: null,
  distance: null,
  rpe: null,
  note: '',
  completed: false,
});
export function zonedInput(iso: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function zonedISO(value: string, timezone: string): string {
  const target = Date.parse(value + ':00Z');
  let candidate = target;
  for (let i = 0; i < 4; i++) {
    const represented = Date.parse(
      zonedInput(new Date(candidate).toISOString(), timezone) + ':00Z',
    );
    if (represented === target) return new Date(candidate).toISOString();
    candidate += target - represented;
  }
  throw new Error('INVALID_INPUT'); // A nonexistent local time at a daylight-saving transition.
}
