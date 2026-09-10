import { z } from 'zod';
import { all, db, first, statement } from '../db';
import { listWorkouts, listTemplates, saveWorkout, saveTemplate } from './fitness';
import { listTrips, listWishlist } from './travel';
import { getPreferences, getWidgets } from './settings';
import {
  idSchema,
  workoutSchema,
  templateSchema,
  tripSchema,
  preferencesSchema,
  widgetsSchema,
  visibilitySchema,
} from '../../lib/schemas';
import { storage } from '../storage';
import { HttpError } from '../http';
import type { User } from '../../types/domain';
export async function exportBackup(user: User) {
  const [sessions, templates, entries, wishlist, preferences, widgets, favorites, sources] =
    await Promise.all([
      listWorkouts(user),
      listTemplates(user.id),
      listTrips(user),
      listWishlist(user),
      getPreferences(user.id),
      getWidgets(),
      all<{ exercise_id: string }>(
        'SELECT exercise_id FROM exercise_favorites WHERE user_id=?',
        user.id,
      ),
      all('SELECT * FROM data_source_versions'),
    ]);
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    fitness: { sessions, templates, favorites: favorites.map((f) => f.exercise_id) },
    travel: { entries, wishlist },
    settings: { preferences, widgets },
    sources,
  };
}
const photo = z.object({
  id: idSchema,
  large_key: z.string().max(500),
  thumbnail_key: z.string().max(500),
  width: z.number().int().positive().max(1920),
  height: z.number().int().positive().max(1920),
  size: z
    .number()
    .int()
    .positive()
    .max(4 * 1024 * 1024),
  position: z.number().int().min(0).max(5),
});
const entry = z
  .object({
    id: idSchema,
    location_id: idSchema,
    spot_id: idSchema.nullable().optional(),
    place_name: z.string().trim().max(120).default(''),
    start_date: z.iso.date().nullable(),
    end_date: z.iso.date().nullable(),
    description: z.string().max(10000),
    tags: z.array(z.string().max(40)).max(20),
    rating: z.number().int().min(1).max(5).nullable(),
    visibility: visibilitySchema,
    photos: z.array(photo).min(1).max(6),
  })
  .refine((t) => tripSchema.safeParse({ ...t, photo_ids: t.photos.map((p) => p.id) }).success);
const wish = z.object({
  id: idSchema,
  location_id: idSchema,
  spot_id: idSchema.nullable().optional(),
  visibility: visibilitySchema,
});
export const backupSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.iso.datetime(),
  fitness: z.object({
    sessions: z.array(workoutSchema).max(20000),
    templates: z.array(templateSchema).max(2000),
    favorites: z.array(idSchema).max(20000),
  }),
  travel: z.object({ entries: z.array(entry).max(10000), wishlist: z.array(wish).max(10000) }),
  settings: z.object({ preferences: preferencesSchema, widgets: widgetsSchema }),
});
export type Backup = z.infer<typeof backupSchema>;
export function validateBackup(input: unknown) {
  const result = backupSchema.safeParse(input);
  if (!result.success) throw new HttpError(400, 'INVALID_BACKUP');
  return result.data;
}
export async function previewBackup(user: User, input: unknown) {
  const backup = validateBackup(input);
  const [sessions, templates, trips, wishes] = await Promise.all([
    all<{ id: string }>('SELECT id FROM fitness_sessions WHERE user_id=?', user.id),
    all<{ id: string }>('SELECT id FROM workout_templates WHERE user_id=?', user.id),
    all<{ id: string }>('SELECT id FROM travel_entries WHERE user_id=?', user.id),
    all<{ id: string }>('SELECT id FROM travel_wishlist WHERE user_id=?', user.id),
  ]);
  const count = (incoming: { id: string }[], current: { id: string }[]) => {
    const ids = new Set(current.map((x) => x.id));
    return {
      new: incoming.filter((x) => !ids.has(x.id)).length,
      skip: incoming.filter((x) => ids.has(x.id)).length,
    };
  };
  return {
    sessions: count(backup.fitness.sessions, sessions),
    templates: count(backup.fitness.templates, templates),
    trips: count(backup.travel.entries, trips),
    wishlist: count(backup.travel.wishlist, wishes),
    favorites: backup.fitness.favorites.length,
  };
}
export const importItemSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('session'), value: workoutSchema }),
  z.object({ kind: z.literal('template'), value: templateSchema }),
  z.object({ kind: z.literal('trip'), value: entry }),
  z.object({ kind: z.literal('wishlist'), value: wish }),
  z.object({ kind: z.literal('favorite'), value: idSchema }),
]);
export async function importItem(user: User, input: unknown) {
  const item = importItemSchema.parse(input);
  if (item.kind === 'favorite') {
    await statement(
      'INSERT OR IGNORE INTO exercise_favorites(user_id,exercise_id,created_at) VALUES(?,?,?)',
      user.id,
      item.value,
      new Date().toISOString(),
    ).run();
    return { status: 'imported' };
  }
  const tables = {
    session: 'fitness_sessions',
    template: 'workout_templates',
    trip: 'travel_entries',
    wishlist: 'travel_wishlist',
  } as const;
  const existing = await first<{ user_id: string }>(
    `SELECT user_id FROM ${tables[item.kind]} WHERE id=?`,
    item.value.id,
  );
  if (existing) {
    if (existing.user_id !== user.id) throw new HttpError(409, 'CONFLICT');
    return { status: 'skipped' };
  }
  if (item.kind === 'session') await saveWorkout(user.id, { ...item.value, updated_at: undefined });
  if (item.kind === 'template') await saveTemplate(user.id, item.value);
  if (item.kind === 'wishlist')
    await statement(
      'INSERT OR IGNORE INTO travel_wishlist(id,user_id,location_id,visibility,created_at,spot_id) VALUES(?,?,?,?,?,?)',
      item.value.id,
      user.id,
      item.value.location_id,
      item.value.visibility,
      new Date().toISOString(),
      item.value.spot_id ?? null,
    ).run();
  if (item.kind === 'trip') {
    const t = item.value;
    for (const p of t.photos) {
      const prefix = `travel/${user.id}/${t.id}/${p.id}/`;
      if (p.large_key !== prefix + 'large.webp' || p.thumbnail_key !== prefix + 'thumbnail.webp')
        throw new HttpError(400, 'MISSING_PHOTOS');
      if (!(await storage.exists(p.large_key)) || !(await storage.exists(p.thumbnail_key)))
        throw new HttpError(400, 'MISSING_PHOTOS');
    }
    // No upload claims are written before the whole trip is valid; its relationships commit together.
    await db().batch([
      statement(
        'INSERT INTO travel_entries(id,user_id,location_id,start_date,end_date,description,tags,rating,visibility,updated_at,spot_id,place_name) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
        t.id,
        user.id,
        t.location_id,
        t.start_date,
        t.end_date,
        t.description,
        JSON.stringify(t.tags),
        t.rating,
        t.visibility,
        new Date().toISOString(),
        t.spot_id ?? null,
        t.place_name,
      ),
      ...t.photos.map((p, i) =>
        statement(
          'INSERT INTO travel_photos(id,travel_id,large_key,thumbnail_key,width,height,size,position) VALUES(?,?,?,?,?,?,?,?)',
          p.id,
          t.id,
          p.large_key,
          p.thumbnail_key,
          p.width,
          p.height,
          p.size,
          i,
        ),
      ),
    ]);
  }
  return { status: 'imported' };
}
