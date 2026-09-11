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
export type TrainingPart = (typeof trainingParts)[number];
// Dataset muscle names and aliases keep related search independent of UI translations.
export const trainingTargets: Record<TrainingPart, readonly string[]> = {
  cardio: ['cardiovascular system'],
  back: [
    'lats',
    'upper back',
    'lower back',
    'spine',
    'traps',
    'trapezius',
    'rhomboids',
    'erector spinae',
  ],
  chest: ['pectorals', 'serratus anterior', 'upper chest', 'pectoralis major'],
  legs: [
    'abductors',
    'adductors',
    'calves',
    'glutes',
    'hamstrings',
    'quads',
    'quadriceps',
    'hip flexors',
    'gluteus medius',
    'gluteus maximus',
  ],
  shoulders: ['delts', 'deltoids', 'shoulder stabilizers', 'rotator cuff'],
  arms: ['biceps', 'triceps', 'forearms', 'forearm muscles'],
  core: ['abs', 'core', 'obliques', 'lower abs'],
  other: ['levator scapulae'],
};
export function trainingPart(target: string): (typeof trainingParts)[number] {
  const known = trainingParts.find((part) => trainingTargets[part].includes(target.toLowerCase()));
  if (known) return known;
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

/** First instant of a calendar day, including zones that skip midnight for DST. */
export function zonedDayStart(date: string, timezone: string): string {
  try {
    return zonedISO(date + 'T00:00', timezone);
  } catch {
    const format = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const center = Date.parse(date + 'T00:00:00Z') / 1000;
    let low = center - 172800,
      high = center + 172800;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (format.format(new Date(middle * 1000)) < date) low = middle + 1;
      else high = middle;
    }
    return new Date(low * 1000).toISOString();
  }
}
