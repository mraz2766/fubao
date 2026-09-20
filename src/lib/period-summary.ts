import type { Preferences, Workout } from '../types/domain';
import { shiftDay, weekBeginning, workoutDay } from './analytics';
export type SummaryPeriod = 'week' | 'month';
export interface PeriodSummary {
  period: SummaryPeriod;
  start: string;
  end: string; // Exclusive calendar boundary.
  count: number;
  goal: number;
  days: {
    date: string;
    count: number;
    sessions: { id: string; title: string; body_parts: string[] }[];
  }[];
}
export function periodBounds(period: SummaryPeriod, date: string, weekStart: number) {
  const start = period === 'week' ? weekBeginning(date, weekStart) : `${date.slice(0, 7)}-01`;
  const end =
    period === 'week'
      ? shiftDay(start, 7)
      : new Date(Date.UTC(Number(start.slice(0, 4)), Number(start.slice(5, 7)), 1, 12))
          .toISOString()
          .slice(0, 10);
  return { start, end };
}
export function summarizePeriod(
  workouts: Workout[],
  preferences: Preferences,
  period: SummaryPeriod,
  date: string,
): PeriodSummary {
  const { start, end } = periodBounds(period, date, preferences.weekStart);
  const days: PeriodSummary['days'] = [];
  for (let day = start; day < end; day = shiftDay(day, 1))
    days.push({ date: day, count: 0, sessions: [] });
  const byDate = new Map(days.map((day) => [day.date, day]));
  for (const workout of workouts) {
    if (workout.status !== 'completed') continue;
    const day = byDate.get(workoutDay(workout, preferences.timezone));
    if (day) {
      day.count++;
      day.sessions.push({ id: workout.id, title: workout.title, body_parts: workout.body_parts });
    }
  }
  return {
    period,
    start,
    end,
    count: days.reduce((sum, day) => sum + day.count, 0),
    goal:
      period === 'week'
        ? preferences.weeklyGoal
        : Math.ceil((preferences.weeklyGoal * days.length) / 7),
    days,
  };
}
