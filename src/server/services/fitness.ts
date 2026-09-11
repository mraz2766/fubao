import { z } from 'zod';
import mediaManifest from '../../data/exercise-media.json';
import {
  trainingPart,
  trainingParts,
  trainingTargets,
  validCompletedSet,
} from '../../lib/fitness-recording';
import { all, db, first, statement } from '../db';
import { HttpError } from '../http';
import { workoutSchema, templateSchema } from '../../lib/schemas';
import type {
  Workout,
  SessionExercise,
  FitnessSet,
  User,
  Exercise,
  WorkoutTemplate,
} from '../../types/domain';
type WorkoutRow = Omit<Workout, 'body_parts' | 'exercises'> & { body_parts: string };
type ExerciseRow = Omit<SessionExercise, 'sets'> & { session_id: string };
type SetRow = Omit<FitnessSet, 'completed'> & { session_exercise_id: string; completed: number };
export async function listWorkouts(
  user: User | null,
  id?: string,
  page?: { limit: number; offset: number; status?: string },
): Promise<Workout[]> {
  const owner = user?.id ?? null;
  let scope = `s.user_id=COALESCE(?,(SELECT id FROM users ORDER BY created_at LIMIT 1))${user ? '' : " AND s.visibility='public' AND s.status='completed'"}${id ? ' AND s.id=?' : ''}`;
  const bindings: (string | number | null)[] = id ? [owner, id] : [owner];
  if (page && !id) {
    const status = page.status ? ' AND s.status=?' : '';
    scope = `s.id IN (SELECT s.id FROM fitness_sessions s WHERE ${scope}${status} ORDER BY s.start_at DESC,s.id DESC LIMIT ? OFFSET ?)`;
    if (page.status) bindings.push(page.status);
    bindings.push(page.limit, page.offset);
  }
  const results = await db().batch([
    statement(
      `SELECT s.* FROM fitness_sessions s WHERE ${scope} ORDER BY s.start_at DESC`,
      ...bindings,
    ),
    statement(
      `SELECT e.id,e.session_id,e.exercise_id,l.name_en,l.name_zh,l.target,l.equipment,e.recording_type FROM fitness_session_exercises e JOIN exercise_library l ON l.id=e.exercise_id JOIN fitness_sessions s ON s.id=e.session_id WHERE ${scope} ORDER BY e.position`,
      ...bindings,
    ),
    statement(
      `SELECT f.* FROM fitness_sets f JOIN fitness_session_exercises e ON e.id=f.session_exercise_id JOIN fitness_sessions s ON s.id=e.session_id WHERE ${scope} ORDER BY f.position`,
      ...bindings,
    ),
  ]);
  const sessions = results[0].results as unknown as WorkoutRow[];
  const exercises = results[1].results as unknown as ExerciseRow[];
  const sets = results[2].results as unknown as SetRow[];
  const setMap = new Map<string, FitnessSet[]>();
  for (const row of sets) {
    const { session_exercise_id, ...set } = row;
    const bucket = setMap.get(session_exercise_id) ?? [];
    bucket.push({ ...set, completed: !!set.completed });
    setMap.set(session_exercise_id, bucket);
  }
  const exerciseMap = new Map<string, SessionExercise[]>();
  for (const row of exercises) {
    const { session_id, ...exercise } = row;
    const bucket = exerciseMap.get(session_id) ?? [];
    bucket.push({ ...exercise, sets: setMap.get(row.id) ?? [] });
    exerciseMap.set(session_id, bucket);
  }
  return sessions.map((s) => ({
    ...s,
    body_parts: JSON.parse(s.body_parts).length
      ? JSON.parse(s.body_parts)
      : [...new Set((exerciseMap.get(s.id) ?? []).map((e) => trainingPart(e.target)))].concat(
          (exerciseMap.get(s.id) ?? []).length || s.status !== 'completed' ? [] : ['other'],
        ),
    exercises: exerciseMap.get(s.id) ?? [],
  }));
}
export async function saveWorkout(userId: string, input: unknown) {
  const w = workoutSchema.parse(input);
  const existing = (await listWorkouts({ id: userId, username: '' }, w.id))[0];
  const ownership = await first<{ user_id: string; last_mutation_id: string | null }>(
    'SELECT user_id,last_mutation_id FROM fitness_sessions WHERE id=?',
    w.id,
  );
  if (ownership && ownership.user_id !== userId) throw new HttpError(404, 'NOT_FOUND');
  if (!existing && w.revision !== undefined) throw new HttpError(404, 'NOT_FOUND');
  if (existing && w.mutation_id && ownership?.last_mutation_id === w.mutation_id) return existing;
  if (
    existing &&
    ((w.revision !== undefined && existing.revision !== w.revision) ||
      (w.revision === undefined && w.updated_at && existing.updated_at !== w.updated_at))
  )
    throw new HttpError(409, 'CONFLICT');
  for (const e of w.exercises) {
    if (e.sets.some((s) => s.completed && !validCompletedSet(s, e.recording_type)))
      throw new HttpError(400, 'INVALID_INPUT');
  }
  if (
    new Set(w.exercises.map((e) => e.id)).size !== w.exercises.length ||
    new Set(w.exercises.flatMap((e) => e.sets.map((s) => s.id))).size !==
      w.exercises.reduce((n, e) => n + e.sets.length, 0)
  )
    throw new HttpError(400, 'INVALID_INPUT');
  if (!w.body_parts.length && w.exercises.length) {
    for (const e of w.exercises) {
      const row = await first<{ target: string }>(
        'SELECT target FROM exercise_library WHERE id=?',
        e.exercise_id,
      );
      if (row) w.body_parts.push(trainingPart(row.target));
    }
    w.body_parts = [...new Set(w.body_parts)];
  }
  const guard = crypto.randomUUID();
  const statements = existing
    ? [
        statement(
          'INSERT INTO fitness_write_guards(id,valid) VALUES(?,CASE WHEN EXISTS(SELECT 1 FROM fitness_sessions WHERE id=? AND user_id=? AND revision=?) THEN 1 ELSE 0 END)',
          guard,
          w.id,
          userId,
          existing.revision ?? 0,
        ),
      ]
    : [];
  statements.push(
    statement(
      `INSERT INTO fitness_sessions(id,user_id,title,mode,status,body_parts,start_at,end_at,timezone,note,visibility,updated_at,revision,last_mutation_id,workout_date,time_precision,duration_seconds) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ${existing ? 'ON CONFLICT(id) DO UPDATE SET title=excluded.title,mode=excluded.mode,status=excluded.status,body_parts=excluded.body_parts,start_at=excluded.start_at,end_at=excluded.end_at,timezone=excluded.timezone,note=excluded.note,visibility=excluded.visibility,updated_at=excluded.updated_at,revision=excluded.revision,last_mutation_id=excluded.last_mutation_id,workout_date=excluded.workout_date,time_precision=excluded.time_precision,duration_seconds=excluded.duration_seconds' : ''}`,
      w.id,
      userId,
      w.title,
      w.mode,
      w.status,
      JSON.stringify(w.body_parts),
      w.start_at,
      w.end_at,
      w.timezone,
      w.note,
      w.status === 'completed' ? w.visibility : 'private',
      new Date().toISOString(),
      (existing?.revision ?? 0) + 1,
      w.mutation_id ?? null,
      w.workout_date ?? null,
      w.time_precision,
      w.duration_seconds ?? null,
    ),
  );
  for (const old of existing?.exercises ?? []) {
    const next = w.exercises.find((e) => e.id === old.id);
    if (!next)
      statements.push(
        statement(
          'DELETE FROM fitness_session_exercises WHERE id=? AND session_id=?',
          old.id,
          w.id,
        ),
      );
    else
      for (const set of old.sets)
        if (!next.sets.some((s) => s.id === set.id))
          statements.push(
            statement(
              'DELETE FROM fitness_sets WHERE id=? AND session_exercise_id=?',
              set.id,
              old.id,
            ),
          );
  }
  w.exercises.forEach((e, i) => {
    const oldIndex = existing?.exercises.findIndex((x) => x.id === e.id) ?? -1;
    const old = oldIndex >= 0 ? existing!.exercises[oldIndex] : undefined;
    if (!old)
      statements.push(
        statement(
          'INSERT INTO fitness_session_exercises(id,session_id,exercise_id,position,recording_type) VALUES(?,?,?,?,?)',
          e.id,
          w.id,
          e.exercise_id,
          i,
          e.recording_type,
        ),
      );
    else if (
      oldIndex !== i ||
      old.exercise_id !== e.exercise_id ||
      old.recording_type !== e.recording_type
    )
      statements.push(
        statement(
          'UPDATE fitness_session_exercises SET exercise_id=?,position=?,recording_type=? WHERE id=? AND session_id=?',
          e.exercise_id,
          i,
          e.recording_type,
          e.id,
          w.id,
        ),
      );
    e.sets.forEach((s, j) => {
      const oldSet = old?.sets.find((x) => x.id === s.id);
      const values = [s.reps, s.weight, s.duration, s.distance, s.rpe, s.note, +s.completed];
      if (!oldSet)
        statements.push(
          statement(
            'INSERT INTO fitness_sets(id,session_exercise_id,position,reps,weight,duration,distance,rpe,note,completed) VALUES(?,?,?,?,?,?,?,?,?,?)',
            s.id,
            e.id,
            j,
            ...values,
          ),
        );
      else if (
        old!.sets.findIndex((x) => x.id === s.id) !== j ||
        ['reps', 'weight', 'duration', 'distance', 'rpe', 'note', 'completed'].some(
          (k) => oldSet[k as keyof FitnessSet] !== s[k as keyof FitnessSet],
        )
      )
        statements.push(
          statement(
            'UPDATE fitness_sets SET position=?,reps=?,weight=?,duration=?,distance=?,rpe=?,note=?,completed=? WHERE id=? AND session_exercise_id=?',
            j,
            ...values,
            s.id,
            e.id,
          ),
        );
    });
  });
  if (existing) statements.push(statement('DELETE FROM fitness_write_guards WHERE id=?', guard));
  try {
    await db().batch(statements);
  } catch (error) {
    if (String(error).includes('valid=1') || String(error).includes('fitness_sessions.id'))
      throw new HttpError(409, 'CONFLICT');
    throw error;
  }
  return (await listWorkouts({ id: userId, username: '' }, w.id))[0];
}
export async function deleteWorkout(userId: string, id: string) {
  const result = await statement(
    'DELETE FROM fitness_sessions WHERE id=? AND user_id=?',
    id,
    userId,
  ).run();
  if (!result.meta.changes) throw new HttpError(404, 'NOT_FOUND');
}
export async function searchExercises(params: URLSearchParams, user: User | null) {
  const q = (params.get('q') ?? '').trim().slice(0, 100),
    body = params.get('bodyPart'),
    target = params.get('target'),
    equipment = params.get('equipment');
  const page = Math.max(0, Math.min(10000, Number(params.get('page')) || 0)),
    limit = Math.max(1, Math.min(50, Number(params.get('limit')) || 20));
  const mode = params.get('mode') ?? 'all';
  const bindings: (string | number)[] = [user?.id ?? '', user?.id ?? ''];
  const clauses = ['l.active=1'];
  let relatedTargets: string[] = [];
  const relatedParts = params.get('trainingItems');
  if (relatedParts) {
    const parts = z
      .array(z.enum(trainingParts))
      .max(trainingParts.length)
      .parse(relatedParts.split(','));
    relatedTargets = [...new Set(parts.flatMap((part) => trainingTargets[part]))];
    clauses.push(
      `(LOWER(l.target) IN (SELECT value FROM json_each(?)) OR EXISTS (SELECT 1 FROM json_each(l.secondary_muscles) muscle WHERE LOWER(muscle.value) IN (SELECT value FROM json_each(?))))`,
    );
    bindings.push(JSON.stringify(relatedTargets), JSON.stringify(relatedTargets));
  }
  if (q) {
    clauses.push("(l.name_en LIKE ? ESCAPE '\\' OR l.name_zh LIKE ? ESCAPE '\\')");
    const escaped = q.replace(/[\\%_]/g, '\\$&');
    bindings.push(`%${escaped}%`, `%${escaped}%`);
  }
  for (const [column, value] of [
    ['body_part', body],
    ['target', target],
    ['equipment', equipment],
  ])
    if (value) {
      clauses.push(`l.${column}=?`);
      bindings.push(value);
    }
  if (mode === 'favorites') clauses.push('f.exercise_id IS NOT NULL');
  if (mode === 'recent' || mode === 'frequent') clauses.push('u.usage_count>0');
  const ordering =
    (relatedTargets.length
      ? 'CASE WHEN LOWER(l.target) IN (SELECT value FROM json_each(?)) THEN 0 ELSE 1 END,'
      : '') +
    (mode === 'recent'
      ? 'u.last_used DESC'
      : mode === 'frequent'
        ? 'u.usage_count DESC'
        : 'approved_image IS NOT NULL DESC,l.name_en') +
    ',l.id';
  if (relatedTargets.length) bindings.push(JSON.stringify(relatedTargets));
  const rows = await all<Record<string, unknown>>(
    `SELECT l.*,(SELECT image FROM exercise_media m WHERE m.exercise_id=l.id AND m.approved=1 ORDER BY m.id LIMIT 1) approved_image,f.exercise_id IS NOT NULL AS favorite,COALESCE(u.usage_count,0) AS usage_count FROM exercise_library l LEFT JOIN exercise_favorites f ON f.exercise_id=l.id AND f.user_id=? LEFT JOIN (SELECT e.exercise_id,COUNT(*) usage_count,MAX(s.start_at) last_used FROM fitness_session_exercises e JOIN fitness_sessions s ON s.id=e.session_id WHERE s.user_id=? AND s.status='completed' GROUP BY e.exercise_id) u ON u.exercise_id=l.id WHERE ${clauses.join(' AND ')} ORDER BY ${ordering} LIMIT ? OFFSET ?`,
    ...bindings,
    limit + 1,
    page * limit,
  );
  const items = rows.slice(0, limit).map(parseExercise);
  return { items, hasMore: rows.length > limit, page };
}
function parseExercise(row: Record<string, unknown>): Exercise {
  const media = (
    mediaManifest.records as Record<
      string,
      { thumbnail: string; images: string[]; attribution: string }
    >
  )[String(row.id)];
  const approved = media && row.approved_image === media.thumbnail;
  return {
    id: String(row.id),
    name_en: String(row.name_en),
    name_zh: String(row.name_zh),
    body_part: String(row.body_part),
    target: String(row.target),
    equipment: String(row.equipment),
    secondary_muscles: JSON.parse(String(row.secondary_muscles)),
    instructions_en: JSON.parse(String(row.instructions_en)),
    instructions_zh: JSON.parse(String(row.instructions_zh)),
    image: approved ? media.thumbnail : null,
    images: approved ? media.images : [],
    attribution: approved ? media.attribution : undefined,
    animation: null,
    favorite: !!row.favorite,
    usage_count: Number(row.usage_count ?? 0),
  };
}
export async function exerciseFilters() {
  const rows = await all<{ body_part: string; target: string; equipment: string }>(
    'SELECT DISTINCT body_part,target,equipment FROM exercise_library WHERE active=1',
  );
  return {
    bodyParts: [...new Set(rows.map((r) => r.body_part))].sort(),
    targets: [...new Set(rows.map((r) => r.target))].sort(),
    equipment: [...new Set(rows.map((r) => r.equipment))].sort(),
  };
}
export async function getExercise(id: string) {
  const row = await first<Record<string, unknown>>(
    'SELECT l.*,(SELECT image FROM exercise_media m WHERE m.exercise_id=l.id AND m.approved=1 ORDER BY m.id LIMIT 1) approved_image FROM exercise_library l WHERE l.id=?',
    id,
  );
  if (!row) throw new HttpError(404, 'NOT_FOUND');
  return parseExercise(row);
}
export async function listTemplates(userId: string): Promise<WorkoutTemplate[]> {
  const [templates, exercises, sets] = await Promise.all([
    all<{ id: string; name: string }>(
      'SELECT id,name FROM workout_templates WHERE user_id=? ORDER BY updated_at DESC',
      userId,
    ),
    all<ExerciseRow & { template_id: string }>(
      'SELECT e.id,e.template_id,e.exercise_id,l.name_en,l.name_zh,l.target,l.equipment,e.recording_type FROM workout_template_exercises e JOIN workout_templates t ON t.id=e.template_id JOIN exercise_library l ON l.id=e.exercise_id WHERE t.user_id=? ORDER BY e.position',
      userId,
    ),
    all<SetRow & { template_exercise_id: string }>(
      'SELECT f.* FROM workout_template_sets f JOIN workout_template_exercises e ON e.id=f.template_exercise_id JOIN workout_templates t ON t.id=e.template_id WHERE t.user_id=? ORDER BY f.position',
      userId,
    ),
  ]);
  return templates.map((t) => ({
    ...t,
    exercises: exercises
      .filter((e) => e.template_id === t.id)
      .map((e) => ({
        id: e.id,
        exercise_id: e.exercise_id,
        name_en: e.name_en,
        name_zh: e.name_zh,
        target: e.target,
        equipment: e.equipment,
        recording_type: e.recording_type,
        sets: sets
          .filter((s) => s.template_exercise_id === e.id)
          .map((s) => ({
            id: s.id,
            reps: s.reps,
            weight: s.weight,
            duration: s.duration,
            distance: s.distance,
            rpe: s.rpe,
            note: s.note,
            completed: false,
          })),
      })),
  }));
}
export async function saveTemplate(userId: string, input: unknown) {
  const t = templateSchema.parse(input);
  const existing = await first<{ user_id: string }>(
    'SELECT user_id FROM workout_templates WHERE id=?',
    t.id,
  );
  if (existing && existing.user_id !== userId) throw new HttpError(404, 'NOT_FOUND');
  const statements = [
    statement(
      'INSERT INTO workout_templates(id,user_id,name,updated_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,updated_at=excluded.updated_at',
      t.id,
      userId,
      t.name,
      new Date().toISOString(),
    ),
    statement('DELETE FROM workout_template_exercises WHERE template_id=?', t.id),
  ];
  t.exercises.forEach((e, i) => {
    statements.push(
      statement(
        'INSERT INTO workout_template_exercises(id,template_id,exercise_id,position,recording_type) VALUES(?,?,?,?,?)',
        e.id,
        t.id,
        e.exercise_id,
        i,
        e.recording_type,
      ),
    );
    e.sets.forEach((s, j) =>
      statements.push(
        statement(
          'INSERT INTO workout_template_sets(id,template_exercise_id,position,reps,weight,duration,distance,rpe,note) VALUES(?,?,?,?,?,?,?,?,?)',
          s.id,
          e.id,
          j,
          s.reps,
          s.weight,
          s.duration,
          s.distance,
          s.rpe,
          s.note,
        ),
      ),
    );
  });
  await db().batch(statements);
  return { id: t.id };
}
export async function toggleFavorite(userId: string, id: string, input: unknown) {
  const { favorite } = z.object({ favorite: z.boolean() }).parse(input);
  await statement(
    favorite
      ? 'INSERT OR IGNORE INTO exercise_favorites(user_id,exercise_id,created_at) VALUES(?,?,?)'
      : 'DELETE FROM exercise_favorites WHERE user_id=? AND exercise_id=?',
    ...(favorite ? [userId, id, new Date().toISOString()] : [userId, id]),
  ).run();
  return { favorite };
}
