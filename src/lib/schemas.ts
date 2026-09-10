import { z } from 'zod';
export const idSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const visibilitySchema = z.enum(['private', 'public']);
export const timeZoneSchema = z
  .string()
  .max(80)
  .refine((v) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: v });
      return true;
    } catch {
      return false;
    }
  });
export const setSchema = z.object({
  id: idSchema,
  reps: z.number().int().min(1).max(10000).nullable(),
  weight: z.number().min(0).max(2000).nullable(),
  duration: z.number().positive().max(604800).nullable(),
  distance: z.number().positive().max(10000000).nullable(),
  rpe: z.number().min(1).max(10).nullable(),
  note: z.string().max(1000),
  completed: z.boolean(),
});
export const sessionExerciseSchema = z.object({
  id: idSchema,
  exercise_id: idSchema,
  recording_type: z.enum(['auto', 'weight', 'reps', 'duration', 'cardio']).default('auto'),
  sets: z.array(setSchema).max(100),
});
export const workoutSchema = z
  .object({
    id: idSchema,
    title: z.string().trim().min(1).max(120),
    mode: z.enum(['quick', 'detailed']),
    status: z.enum(['draft', 'active', 'completed']),
    body_parts: z
      .array(z.enum(['back', 'chest', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'other']))
      .max(8),
    workout_date: z.iso.date().nullable().optional(),
    time_precision: z.enum(['date', 'exact']).default('exact'),
    duration_seconds: z.number().int().min(0).max(604800).nullable().optional(),
    start_at: z.iso.datetime(),
    end_at: z.iso.datetime().nullable(),
    timezone: timeZoneSchema,
    note: z.string().max(5000),
    visibility: visibilitySchema,
    exercises: z.array(sessionExerciseSchema).max(50),
    updated_at: z.string().optional(),
    revision: z.number().int().min(0).optional(),
    mutation_id: idSchema.optional(),
  })
  .refine((w) => !w.end_at || w.end_at >= w.start_at, {
    path: ['end_at'],
    message: 'End must follow start',
  })
  .refine((w) => w.time_precision !== 'date' || (!!w.workout_date && !w.end_at), {
    path: ['workout_date'],
    message: 'Date-only records need a date and no end timestamp',
  })
  .refine((w) => w.mode !== 'quick' || w.exercises.length === 0)
  .refine((w) => w.status !== 'completed' || w.body_parts.length > 0 || w.exercises.length > 0, {
    path: ['body_parts'],
    message: 'Choose a training item',
  });
export const templateSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(120),
  exercises: z.array(sessionExerciseSchema).min(1).max(50),
});
export const preferencesSchema = z.object({
  language: z.enum(['zh-CN', 'en-US']),
  theme: z.enum(['light', 'dark', 'system']),
  weightUnit: z.enum(['kg', 'lb']),
  distanceUnit: z.enum(['km', 'mile']),
  weekStart: z.union([z.literal(0), z.literal(1)]),
  weeklyGoal: z.number().int().min(1).max(21),
  timezone: timeZoneSchema,
  mapStyle: z.enum(['countries', 'places']),
});
export const widgetsSchema = z
  .array(
    z.object({
      key: z.enum(['fitness', 'travel', 'weekly', 'recent']),
      visible: z.boolean(),
      size: z.enum(['small', 'medium', 'large']),
      order: z.number().int().min(0).max(3),
    }),
  )
  .length(4)
  .refine(
    (w) => new Set(w.map((x) => x.key)).size === 4 && new Set(w.map((x) => x.order)).size === 4,
  );
const date = z.iso.date().nullable();
export const tripSchema = z
  .object({
    id: idSchema,
    location_id: idSchema,
    spot_id: idSchema.nullable().optional(),
    place_name: z.string().trim().max(120).default(''),
    start_date: date,
    end_date: date,
    description: z.string().max(10000),
    tags: z.array(z.string().trim().min(1).max(40)).max(20),
    rating: z.number().int().min(1).max(5).nullable(),
    visibility: visibilitySchema,
    photo_ids: z.array(idSchema).min(1).max(6),
    updated_at: z.string().optional(),
  })
  .refine((t) => new Set(t.photo_ids).size === t.photo_ids.length)
  .refine((t) => !t.end_date || (!!t.start_date && t.end_date >= t.start_date), {
    path: ['end_date'],
    message: 'End date must follow start date',
  });
