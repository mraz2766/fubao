import { z } from 'zod';
import { all, first, statement } from '../db';
import { HttpError } from '../http';
import { idSchema } from '../../lib/schemas';
import { zonedDayStart, trainingPart, trainingParts } from '../../lib/fitness-recording';
import { dayKey, shiftDay, weekBeginning, workoutDay } from '../../lib/analytics';
import { translator } from '../../lib/i18n';
import type { Preferences, User, Workout } from '../../types/domain';
import type { FitnessDay } from '../../types/fitness-overview';

type Row = Omit<Workout, 'body_parts' | 'exercises'> & {
  body_parts: string;
  inferred_targets?: string;
};
const scope = (user: User | null) =>
  `s.user_id=COALESCE(?,(SELECT id FROM users ORDER BY created_at LIMIT 1))${user ? '' : " AND s.visibility='public' AND s.status='completed'"}`;
const parse = ({ inferred_targets, ...row }: Row): Workout => {
  const parts = JSON.parse(row.body_parts) as string[];
  return {
    ...row,
    body_parts: parts.length
      ? parts
      : inferred_targets
        ? [...new Set((JSON.parse(inferred_targets) as string[]).map(trainingPart))]
        : row.status === 'completed'
          ? ['other']
          : [],
    exercises: [],
  };
};
// Summary reads deliberately never load exercise/sets graphs. Exact timestamps use the
// viewer's configured timezone; date-only entries keep their recorded calendar day.
export async function workoutSummaries(
  user: User | null,
  timezone: string,
  options: { from?: string; to?: string; status?: string; limit?: number; offset?: number } = {},
) {
  const where = [scope(user)],
    bindings: (string | number | null)[] = [user?.id ?? null];
  if (options.status) {
    where.push('s.status=?');
    bindings.push(options.status);
  }
  if (options.from && options.to) {
    where.push(
      "((s.time_precision='date' AND s.workout_date IS NOT NULL AND s.workout_date>=? AND s.workout_date<?) OR ((s.time_precision<>'date' OR s.workout_date IS NULL) AND s.start_at>=? AND s.start_at<?))",
    );
    bindings.push(
      options.from,
      options.to,
      zonedDayStart(options.from, timezone),
      zonedDayStart(options.to, timezone),
    );
  }
  const rows = await all<Row>(
    `SELECT s.*,CASE WHEN json_array_length(s.body_parts)=0 AND EXISTS(SELECT 1 FROM fitness_session_exercises e WHERE e.session_id=s.id) THEN (SELECT json_group_array(l.target) FROM fitness_session_exercises e JOIN exercise_library l ON l.id=e.exercise_id WHERE e.session_id=s.id) END inferred_targets FROM fitness_sessions s WHERE ${where.join(' AND ')} ORDER BY s.start_at DESC,s.updated_at DESC,s.id DESC${options.limit ? ' LIMIT ? OFFSET ?' : ''}`,
    ...bindings,
    ...(options.limit ? [options.limit, options.offset ?? 0] : []),
  );
  return rows.map(parse);
}
export async function fitnessOverview(
  user: User | null,
  preferences: Preferences,
  windowDays = 90,
) {
  const today = dayKey(new Date(), preferences.timezone),
    weekStart = weekBeginning(today, preferences.weekStart);
  const [period, recent, active, drafts] = await Promise.all([
    workoutSummaries(user, preferences.timezone, {
      from: shiftDay(today, -windowDays + 1),
      to: shiftDay(weekStart, 7),
      status: 'completed',
    }),
    workoutSummaries(user, preferences.timezone, { status: 'completed', limit: 5 }),
    user ? workoutSummaries(user, preferences.timezone, { status: 'active' }) : [],
    user ? workoutSummaries(user, preferences.timezone, { status: 'draft' }) : [],
  ]);
  return {
    today,
    weekStart,
    recent,
    workouts: [
      ...new Map([...active, ...drafts, ...period, ...recent].map((w) => [w.id, w])).values(),
    ].sort(
      (a, b) => b.start_at.localeCompare(a.start_at) || b.updated_at.localeCompare(a.updated_at),
    ),
  };
}
export async function fitnessDay(
  user: User,
  preferences: Preferences,
  date: string,
): Promise<FitnessDay> {
  const [items, overview] = await Promise.all([
    workoutSummaries(user, preferences.timezone, {
      from: date,
      to: shiftDay(date, 1),
      status: 'completed',
    }),
    fitnessOverview(user, preferences, 7),
  ]);
  items.sort(
    (a, b) =>
      b.updated_at.localeCompare(a.updated_at) ||
      b.start_at.localeCompare(a.start_at) ||
      b.id.localeCompare(a.id),
  );
  return {
    date,
    items,
    current: items[0] ?? null,
    recent: overview.recent,
    weekCount: overview.workouts.filter(
      (w) =>
        w.status === 'completed' &&
        workoutDay(w, preferences.timezone) >= overview.weekStart &&
        workoutDay(w, preferences.timezone) < shiftDay(overview.weekStart, 7),
    ).length,
  };
}
export const checkinPatchSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    mutation_id: idSchema,
    body_parts: z
      .array(z.enum(trainingParts))
      .min(1)
      .max(trainingParts.length)
      .transform((p) => [...new Set(p)])
      .optional(),
    duration_seconds: z.number().int().min(1).max(604800).nullable().optional(),
  })
  .strict()
  .refine((p) => p.body_parts !== undefined || p.duration_seconds !== undefined);
export async function patchCheckin(user: User, id: string, input: unknown) {
  const patch = checkinPatchSchema.parse(input);
  const row = await first<Row & { last_mutation_id: string }>(
    'SELECT * FROM fitness_sessions WHERE id=? AND user_id=?',
    id,
    user.id,
  );
  if (!row) throw new HttpError(404, 'NOT_FOUND');
  if (row.last_mutation_id === patch.mutation_id) return parse(row);
  if (row.revision !== patch.revision) throw new HttpError(409, 'CONFLICT');
  if (
    row.status !== 'completed' ||
    (patch.duration_seconds !== undefined && row.time_precision !== 'date')
  )
    throw new HttpError(400, 'INVALID_INPUT');
  const updates = ['revision=revision+1', 'last_mutation_id=?', 'updated_at=?'];
  const bindings: (string | number | null)[] = [patch.mutation_id, new Date().toISOString()];
  if (patch.body_parts) {
    updates.push('body_parts=?');
    bindings.push(JSON.stringify(patch.body_parts));
    const old = JSON.parse(row.body_parts) as string[];
    // Only regenerate automatic titles; custom names are never overwritten.
    for (const locale of ['zh-CN', 'en-US'] as const) {
      const t = translator(locale);
      if (
        row.title === old.map((p) => t(`fitness.${p}` as 'fitness.back')).join(' · ') ||
        row.title === t('record.defaultTitle')
      ) {
        updates.push('title=?');
        bindings.push(patch.body_parts.map((p) => t(`fitness.${p}` as 'fitness.back')).join(' · '));
        break;
      }
    }
  }
  if (patch.duration_seconds !== undefined) {
    updates.push('duration_seconds=?');
    bindings.push(patch.duration_seconds);
  }
  const result = await statement(
    `UPDATE fitness_sessions SET ${updates.join(',')} WHERE id=? AND user_id=? AND revision=?`,
    ...bindings,
    id,
    user.id,
    patch.revision,
  ).run();
  const saved = await first<Row & { last_mutation_id: string }>(
    'SELECT * FROM fitness_sessions WHERE id=? AND user_id=?',
    id,
    user.id,
  );
  if (!result.meta.changes && saved?.last_mutation_id !== patch.mutation_id)
    throw new HttpError(409, 'CONFLICT');
  if (!saved) throw new HttpError(404, 'NOT_FOUND');
  return parse(saved);
}
