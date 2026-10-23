import type {
  Exercise,
  FitnessSet,
  Preferences,
  SessionExercise,
  Workout,
  WorkoutTemplate,
} from '../../types/domain';
import type { PeriodSummary } from '../../lib/period-summary';
import { api } from '../../lib/api';
import { invalidate } from '../core/query';
import { recordingType } from '../../lib/fitness-recording';
import media from '../../data/exercise-media.json';
import { t } from '../core/i18n';

export type { PeriodSummary };
export interface Page<T> {
  items: T[];
  hasMore: boolean;
}
export interface Analytics {
  summary: {
    today: string;
    weekCount: number;
    monthCount: number;
    current: number;
    longest: number;
    weekSeconds: number;
    weekVolume: number;
    totalSeconds: number;
    totalVolume: number;
  };
  records: {
    exerciseId: string;
    name_en: string;
    name_zh: string;
    weight: number;
    estimated: number;
    date: string;
  }[];
  muscles: { muscle: string; sets: number }[];
}
export const keys = {
  week: (date: string) => `/api/fitness/summary?period=week&date=${date}`,
  month: (date: string) => `/api/fitness/summary?period=month&date=${date}`,
  sessions: (page = 0) => `/api/fitness/sessions?page=${page}`,
  active: '/api/fitness/sessions?status=active',
  session: (id: string) => `/api/fitness/sessions/${id}`,
  analytics: '/api/fitness/analytics?days=30',
  templates: '/api/fitness/templates',
};
export const refreshFitness = () => invalidate('/api/fitness', '/api/dashboard');

const records = (media as { records: Record<string, { thumbnail: string; images: string[] }> })
  .records;
export const exerciseThumb = (id: string, fallback?: string | null) =>
  fallback ?? records[id]?.thumbnail ?? null;
export const exerciseImages = (id: string) => records[id]?.images ?? [];

export const uid = () => crypto.randomUUID();
export const blank = (from?: FitnessSet): FitnessSet => ({
  id: uid(),
  reps: from?.reps ?? null,
  weight: from?.weight ?? null,
  duration: from?.duration ?? null,
  distance: from?.distance ?? null,
  rpe: null,
  note: '',
  completed: false,
});
export const kind = (e: SessionExercise) => recordingType(e);

export function fromExercise(ex: Exercise, last?: FitnessSet | null): SessionExercise {
  const e: SessionExercise = {
    id: uid(),
    exercise_id: ex.id,
    name_en: ex.name_en,
    name_zh: ex.name_zh,
    target: ex.target,
    equipment: ex.equipment,
    image: ex.image,
    recording_type: 'auto',
    sets: [],
  };
  const seed = last ? blank(last) : blank();
  e.sets = [seed, blank(seed), blank(seed)];
  return e;
}

export function newWorkout(p: Preferences, title = t('力量训练', 'Strength session')): Workout {
  return {
    id: uid(),
    user_id: '',
    title,
    mode: 'detailed',
    status: 'active',
    body_parts: [],
    start_at: new Date().toISOString(),
    end_at: null,
    timezone: p.timezone,
    note: '',
    visibility: 'private',
    exercises: [],
    updated_at: '',
    time_precision: 'exact',
    workout_date: null,
  };
}

/** Strip display-only fields before sending to the schema-validated endpoint. */
export function payload(w: Workout) {
  return {
    id: w.id,
    title: w.title.trim() || t('训练', 'Workout'),
    mode: w.mode,
    status: w.status,
    body_parts: w.body_parts,
    workout_date: w.workout_date ?? null,
    time_precision: w.time_precision ?? 'exact',
    duration_seconds: w.duration_seconds ?? null,
    start_at: w.start_at,
    end_at: w.end_at,
    timezone: w.timezone,
    note: w.note,
    visibility: w.visibility,
    exercises: w.exercises.map((e) => ({
      id: e.id,
      exercise_id: e.exercise_id,
      recording_type: e.recording_type ?? 'auto',
      sets: e.sets.map((s) => ({
        id: s.id,
        reps: s.reps,
        weight: s.weight,
        duration: s.duration,
        distance: s.distance,
        rpe: s.rpe,
        note: s.note,
        completed: s.completed,
      })),
    })),
    revision: w.revision,
    mutation_id: uid(),
  };
}

export async function createWorkout(w: Workout) {
  const saved = await api<Workout>('/api/fitness/sessions', { method: 'POST', body: payload(w) });
  refreshFitness();
  return saved;
}
export async function putWorkout(w: Workout) {
  return api<Workout>(`/api/fitness/sessions/${w.id}`, { method: 'PUT', body: payload(w) });
}
export async function removeWorkout(id: string) {
  await api(`/api/fitness/sessions/${id}`, { method: 'DELETE' });
  refreshFitness();
}
export async function saveTemplate(name: string, w: Workout, id = uid()) {
  await api('/api/fitness/templates', {
    method: 'POST',
    body: {
      id,
      name,
      exercises: w.exercises.map((e) => ({
        id: uid(),
        exercise_id: e.exercise_id,
        recording_type: e.recording_type ?? 'auto',
        sets: e.sets.map((s) => ({ ...s, id: uid(), completed: false })),
      })),
    },
  });
  invalidate(keys.templates);
}
export async function deleteTemplate(id: string) {
  await api(`/api/fitness/templates/${id}`, { method: 'DELETE' });
  invalidate(keys.templates);
}
export type { WorkoutTemplate, Workout, SessionExercise, FitnessSet, Exercise };

export function workoutStats(w: Workout) {
  let sets = 0,
    volume = 0;
  for (const e of w.exercises)
    for (const s of e.sets)
      if (s.completed) {
        sets++;
        if (s.weight && s.reps && kind(e) === 'weight') volume += s.weight * s.reps;
      }
  const seconds =
    w.time_precision === 'date'
      ? (w.duration_seconds ?? 0)
      : w.end_at
        ? (Date.parse(w.end_at) - Date.parse(w.start_at)) / 1000
        : 0;
  return { sets, volume, seconds };
}
