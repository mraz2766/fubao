import type { FitnessSet, RecordingType, SessionExercise } from '../types/domain';
export function recordingType(
  e: Pick<SessionExercise, 'recording_type' | 'equipment' | 'name_en'>,
): Exclude<RecordingType, 'auto'> {
  if (e.recording_type && e.recording_type !== 'auto') return e.recording_type;
  if (/plank|stretch|hold/i.test(e.name_en)) return 'duration';
  if (/run|treadmill|bicycl|elliptical|rowing machine/i.test(e.name_en)) return 'cardio';
  return e.equipment === 'body weight' ? 'reps' : 'weight';
}
// Completion is an explicit user action; only supplied measurements are validated.
export function validCompletedSet(s: FitnessSet, _type: RecordingType) {
  return (
    (s.weight === null || (Number.isFinite(s.weight) && s.weight >= 0 && s.weight <= 2000)) &&
    (s.reps === null || (Number.isInteger(s.reps) && s.reps >= 1 && s.reps <= 10000)) &&
    (s.duration === null ||
      (Number.isFinite(s.duration) && s.duration > 0 && s.duration <= 604800)) &&
    (s.distance === null ||
      (Number.isFinite(s.distance) && s.distance > 0 && s.distance <= 10000000)) &&
    (s.rpe === null || (Number.isFinite(s.rpe) && s.rpe >= 1 && s.rpe <= 10))
  );
}
export const trainingParts = [
  'cardio',
  'back',
  'chest',
  'legs',
  'shoulders',
  'arms',
  'core',
  'other',
] as const;
export function trainingPart(target: string): (typeof trainingParts)[number] {
  if (/cardio|cardiovascular/i.test(target)) return 'cardio';
  if (/back|lat|trap|spine/i.test(target)) return 'back';
  if (/chest|pectoral|serratus/i.test(target)) return 'chest';
  if (/leg|quad|hamstring|glute|calv|calves|adductor|abductor/i.test(target)) return 'legs';
  if (/shoulder|delt/i.test(target)) return 'shoulders';
  if (/arm|bicep|tricep|forearm/i.test(target)) return 'arms';
  if (/abs|abdominal|core|oblique/i.test(target)) return 'core';
  return 'other';
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
