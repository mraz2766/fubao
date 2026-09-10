import type { Preferences, Trip, Workout } from '../types/domain';
export const dayKey = (date: string | Date, timezone: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(date));
export function shiftDay(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function weekBeginning(day: string, starts: number) {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return shiftDay(day, -((weekday - starts + 7) % 7));
}
export const workoutVolume = (w: Workout) =>
  w.exercises.reduce(
    (sum, e) =>
      sum +
      e.sets.reduce(
        (n, s) => n + (s.completed && s.weight !== null && s.reps !== null ? s.weight * s.reps : 0),
        0,
      ),
    0,
  );
export const workoutSeconds = (w: Workout) =>
  w.end_at ? Math.max(0, (Date.parse(w.end_at) - Date.parse(w.start_at)) / 1000) : 0;
export const estimated1RM = (weight: number, reps: number) =>
  reps >= 1 && reps <= 10 && weight > 0 ? (reps === 1 ? weight : weight * (1 + reps / 30)) : null;
export function streaks(days: string[], today: string) {
  const distinct = [...new Set(days.filter((d) => d <= today))].sort();
  let longest = 0,
    run = 0,
    last = '';
  for (const day of distinct) {
    run = last && shiftDay(last, 1) === day ? run + 1 : 1;
    longest = Math.max(longest, run);
    last = day;
  }
  const set = new Set(distinct);
  let cursor = set.has(today) ? today : shiftDay(today, -1),
    current = 0;
  while (set.has(cursor)) {
    current++;
    cursor = shiftDay(cursor, -1);
  }
  return { current, longest };
}
export function fitnessSummary(workouts: Workout[], p: Preferences, now = new Date()) {
  const today = dayKey(now, p.timezone),
    weekStart = weekBeginning(today, p.weekStart),
    nextWeek = shiftDay(weekStart, 7);
  const complete = workouts.filter((w) => w.status === 'completed');
  const daily = complete.map((w) => ({ w, day: dayKey(w.start_at, p.timezone) }));
  const week = daily.filter((x) => x.day >= weekStart && x.day < nextWeek).map((x) => x.w);
  return {
    today,
    weekStart,
    todayWorkouts: daily.filter((x) => x.day === today).map((x) => x.w),
    weekCount: week.length,
    monthCount: daily.filter((x) => x.day.slice(0, 7) === today.slice(0, 7)).length,
    weekSeconds: week.reduce((n, w) => n + workoutSeconds(w), 0),
    weekVolume: week.reduce((n, w) => n + workoutVolume(w), 0),
    totalSeconds: complete.reduce((n, w) => n + workoutSeconds(w), 0),
    totalVolume: complete.reduce((n, w) => n + workoutVolume(w), 0),
    ...streaks(
      daily.map((x) => x.day),
      today,
    ),
    days: Array.from({ length: 7 }, (_, i) => {
      const day = shiftDay(weekStart, i);
      return { day, trained: daily.some((x) => x.day === day) };
    }),
  };
}
export function personalRecords(workouts: Workout[]) {
  const records = new Map<
    string,
    {
      exerciseId: string;
      name_en: string;
      name_zh: string;
      weight: number;
      estimated: number;
      date: string;
      increase: number;
    }
  >();
  for (const w of [...workouts]
    .filter((w) => w.status === 'completed')
    .sort((a, b) => a.start_at.localeCompare(b.start_at)))
    for (const e of w.exercises)
      for (const s of e.sets) {
        if (!s.completed || !s.weight || !s.reps) continue;
        const current = records.get(e.exercise_id) ?? {
          exerciseId: e.exercise_id,
          name_en: e.name_en,
          name_zh: e.name_zh,
          weight: 0,
          estimated: 0,
          date: w.start_at,
          increase: 0,
        };
        if (s.weight > current.weight) {
          current.increase = current.weight ? s.weight - current.weight : 0;
          current.weight = s.weight;
          current.date = w.start_at;
        }
        current.estimated = Math.max(current.estimated, estimated1RM(s.weight, s.reps) ?? 0);
        records.set(e.exercise_id, current);
      }
  return [...records.values()].sort((a, b) => b.date.localeCompare(a.date));
}
export function muscleDistribution(
  workouts: Workout[],
  timezone: string,
  days: number,
  now = new Date(),
) {
  const today = dayKey(now, timezone),
    from = shiftDay(today, -days + 1),
    counts = new Map<string, number>();
  for (const w of workouts)
    if (
      w.status === 'completed' &&
      dayKey(w.start_at, timezone) >= from &&
      dayKey(w.start_at, timezone) <= today
    )
      for (const e of w.exercises) {
        const n = e.sets.filter((s) => s.completed).length;
        if (n) counts.set(e.target, (counts.get(e.target) ?? 0) + n);
      }
  return [...counts].map(([muscle, sets]) => ({ muscle, sets })).sort((a, b) => b.sets - a.sets);
}
export function travelDays(trips: Pick<Trip, 'start_date' | 'end_date'>[], year: number) {
  const intervals = trips
    .filter((t) => t.start_date)
    .map((t) => [
      Math.max(Date.parse(t.start_date!), Date.parse(`${year}-01-01`)),
      Math.min(Date.parse(t.end_date ?? t.start_date!), Date.parse(`${year}-12-31`)),
    ])
    .filter(([a, b]) => a <= b)
    .sort((a, b) => a[0] - b[0]);
  let total = 0,
    start = 0,
    end = -1;
  for (const [a, b] of intervals) {
    if (a > end + 86400000) {
      if (end >= start) total += (end - start) / 86400000 + 1;
      start = a;
      end = b;
    } else end = Math.max(end, b);
  }
  return total + (end >= start ? (end - start) / 86400000 + 1 : 0);
}
export const toDisplayWeight = (kg: number, unit: Preferences['weightUnit']) =>
  unit === 'lb' ? kg * 2.2046226218 : kg;
export const toKg = (value: number, unit: Preferences['weightUnit']) =>
  unit === 'lb' ? value / 2.2046226218 : value;
export const toDisplayDistance = (meters: number, unit: Preferences['distanceUnit']) =>
  meters / (unit === 'mile' ? 1609.344 : 1000);
export const toMeters = (value: number, unit: Preferences['distanceUnit']) =>
  value * (unit === 'mile' ? 1609.344 : 1000);
