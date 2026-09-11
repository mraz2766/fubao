import { z } from 'zod';
import { fitnessDay, patchCheckin } from './services/fitness-overview';
import { idSchema } from '../lib/schemas';
import { zonedISO, trainingParts } from '../lib/fitness-recording';
import { translator } from '../lib/i18n';
import type { APIContext } from 'astro';
import { HttpError, json, readJSON, requireUser } from './http';
import {
  listWorkouts,
  saveWorkout,
  deleteWorkout,
  searchExercises,
  exerciseFilters,
  getExercise,
  toggleFavorite,
  listTemplates,
  saveTemplate,
} from './services/fitness';
import { fitnessSummary, muscleDistribution, personalRecords } from '../lib/analytics';
import { statement } from './db';
import type { Workout } from '../types/domain';
export async function fitnessRoute(context: APIContext, parts: string[]) {
  const [resource, id, action] = parts,
    method = context.request.method;
  if (resource === 'day' && method === 'GET') {
    const user = requireUser(context);
    const date = z.iso.date().parse(context.url.searchParams.get('date'));
    return json(await fitnessDay(user, context.locals.preferences, date));
  }
  if (resource === 'checkin' && method === 'POST') {
    const user = requireUser(context);
    const input = z
      .object({
        id: idSchema,
        mutation_id: idSchema,
        date: z.iso.date(),
        part: z.enum(trainingParts),
      })
      .parse(await readJSON(context.request));
    const t = translator(context.locals.locale);
    const w = {
      id: input.id,
      mutation_id: input.mutation_id,
      title: t(`fitness.${input.part}`),
      mode: 'quick',
      status: 'completed',
      body_parts: [input.part],
      workout_date: input.date,
      time_precision: 'date',
      duration_seconds: null,
      start_at: zonedISO(input.date + 'T12:00', context.locals.preferences.timezone),
      end_at: null,
      timezone: context.locals.preferences.timezone,
      note: '',
      visibility: 'private',
      exercises: [],
    };
    try {
      return json(await saveWorkout(user.id, w), 201);
    } catch (error) {
      // Concurrent identical requests may race the insert. Return only the matching receipt.
      const existing = (await listWorkouts(user, input.id))[0];
      const receipt = await statement(
        'SELECT last_mutation_id FROM fitness_sessions WHERE id=? AND user_id=?',
        input.id,
        user.id,
      ).first<{ last_mutation_id: string }>();
      if (existing && receipt?.last_mutation_id === input.mutation_id) return json(existing);
      throw error;
    }
  }
  if (resource === 'sessions') {
    if (method === 'GET') {
      const status = context.url.searchParams.get('status');
      const items = (
        await listWorkouts(
          context.locals.user,
          id,
          id
            ? undefined
            : {
                limit: 21,
                offset: Math.max(0, Number(context.url.searchParams.get('page')) || 0) * 20,
                status: status ?? undefined,
              },
        )
      ).filter((w) => !status || w.status === status);
      if (id) {
        if (!items[0]) throw new HttpError(404, 'NOT_FOUND');
        return json(items[0]);
      }
      return json({
        items: items.slice(0, 20),
        hasMore: items.length > 20,
      });
    }
    const user = requireUser(context);
    if (method === 'PATCH' && id && !action)
      return json(await patchCheckin(user, idSchema.parse(id), await readJSON(context.request)));
    if (method === 'POST' || method === 'PUT') {
      const input = (await readJSON(context.request)) as Record<string, unknown>;
      if (id && input.id !== id) throw new HttpError(400, 'INVALID_INPUT');
      if (action === 'complete') input.status = 'completed';
      return json(await saveWorkout(user.id, input));
    }
    if (method === 'DELETE' && id) {
      await deleteWorkout(user.id, id);
      return json({ ok: true });
    }
  }
  if (resource === 'exercises') {
    if (method === 'GET') {
      if (id && action === 'last-set') {
        const user = requireUser(context);
        const set = await statement(
          `SELECT f.* FROM fitness_sets f JOIN fitness_session_exercises e ON e.id=f.session_exercise_id JOIN fitness_sessions s ON s.id=e.session_id WHERE s.user_id=? AND e.exercise_id=? AND s.status='completed' AND f.completed=1 AND (f.weight IS NOT NULL OR f.reps IS NOT NULL OR f.duration IS NOT NULL OR f.distance IS NOT NULL) ORDER BY s.start_at DESC,f.position DESC LIMIT 1`,
          user.id,
          id,
        ).first();
        return json({ set: set ? { ...set, completed: !!set.completed } : null });
      }
      if (id === 'filters') return json(await exerciseFilters());
      if (id) return json(await getExercise(id));
      return json(await searchExercises(context.url.searchParams, context.locals.user));
    }
    if (method === 'POST' && id && action === 'favorite')
      return json(
        await toggleFavorite(requireUser(context).id, id, await readJSON(context.request)),
      );
  }
  if (resource === 'analytics' && method === 'GET') {
    const workouts = await listWorkouts(context.locals.user);
    return json({
      summary: fitnessSummary(workouts, context.locals.preferences),
      records: personalRecords(workouts),
      muscles: muscleDistribution(
        workouts,
        context.locals.preferences.timezone,
        Number(context.url.searchParams.get('days')) === 7 ? 7 : 30,
      ),
    });
  }
  if (resource === 'templates') {
    const user = requireUser(context);
    if (method === 'GET') return json({ items: await listTemplates(user.id) });
    if (method === 'POST' && action === 'start') {
      const template = (await listTemplates(user.id)).find((t) => t.id === id);
      if (!template) throw new HttpError(404, 'NOT_FOUND');
      const workout: Workout = {
        id: crypto.randomUUID(),
        user_id: user.id,
        title: template.name,
        mode: 'detailed',
        status: 'active',
        body_parts: [],
        start_at: new Date().toISOString(),
        end_at: null,
        timezone: context.locals.preferences.timezone,
        note: '',
        visibility: 'private',
        updated_at: '',
        exercises: template.exercises.map((e) => ({
          ...e,
          id: crypto.randomUUID(),
          sets: e.sets.map((s) => ({ ...s, id: crypto.randomUUID(), completed: false })),
        })),
      };
      return json(await saveWorkout(user.id, workout), 201);
    }
    if (method === 'POST' || method === 'PUT')
      return json(await saveTemplate(user.id, await readJSON(context.request)));
    if (method === 'DELETE' && id) {
      const result = await statement(
        'DELETE FROM workout_templates WHERE id=? AND user_id=?',
        id,
        user.id,
      ).run();
      if (!result.meta.changes) throw new HttpError(404, 'NOT_FOUND');
      return json({ ok: true });
    }
  }
  throw new HttpError(404, 'NOT_FOUND');
}
