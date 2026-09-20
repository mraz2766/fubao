import type { Preferences, User } from '../../types/domain';
import { periodBounds, summarizePeriod, type SummaryPeriod } from '../../lib/period-summary';
import { workoutSummaries } from './fitness-overview';
export async function getPeriodSummary(
  user: User | null,
  preferences: Preferences,
  period: SummaryPeriod,
  date: string,
) {
  const { start, end } = periodBounds(period, date, preferences.weekStart);
  const workouts = await workoutSummaries(user, preferences.timezone, {
    from: start,
    to: end,
    status: 'completed',
  });
  return summarizePeriod(workouts, preferences, period, date);
}
