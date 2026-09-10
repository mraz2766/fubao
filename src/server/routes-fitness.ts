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
  if (resource === 'sessions') {
    if (method === 'GET') {
      const items = await listWorkouts(context.locals.user, id);
      if (id) {
        if (!items[0]) throw new HttpError(404, 'NOT_FOUND');
        return json(items[0]);
      }
      const page = Math.max(0, Number(context.url.searchParams.get('page')) || 0);
      return json({
        items: items.slice(page * 20, page * 20 + 20),
        hasMore: items.length > (page + 1) * 20,
      });
    }
    const user = requireUser(context);
    if (method === 'POST' || method === 'PUT')
      return json(await saveWorkout(user.id, await readJSON(context.request)));
    if (method === 'DELETE' && id) {
      await deleteWorkout(user.id, id);
      return json({ ok: true });
    }
  }
  if (resource === 'exercises') {
    if (method === 'GET') {
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
