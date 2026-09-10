import { useEffect, useState, lazy, Suspense, useRef } from 'react';
import { Plus, Trash2, Check, ArrowUp, ArrowDown, Copy, ArrowLeft } from 'lucide-react';
import type {
  Workout,
  Locale,
  Preferences,
  FitnessSet,
  Exercise,
  RecordingType,
} from '../../types/domain';
import { translator, exerciseName, taxonomyLabel } from '../../lib/i18n';
import {
  toDisplayWeight,
  toKg,
  toDisplayDistance,
  toMeters,
  workoutVolume,
} from '../../lib/analytics';
import { api, errorText, ApiFailure } from '../../lib/api';
import { workoutSchema } from '../../lib/schemas';
import { useUnsaved } from '../../lib/use-unsaved';
import {
  blankSet,
  recordingType,
  validCompletedSet,
  zonedInput,
  zonedISO,
} from '../../lib/fitness-recording';
import { useWorkoutSave } from './use-workout-save';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
const ExerciseSearch = lazy(() => import('./ExerciseSearch'));
export default function WorkoutEditor({
  locale,
  preferences,
  initial,
  onClose,
  onDirtyChange,
}: {
  locale: Locale;
  preferences: Preferences;
  initial: Workout;
  onClose?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const t = translator(locale),
    automatic = initial.status !== 'completed';
  const {
    workout,
    change,
    save,
    state,
    error: saveError,
    dirty,
  } = useWorkoutSave(initial, automatic);
  const [search, setSearch] = useState(false),
    [review, setReview] = useState(false),
    [error, setError] = useState(''),
    [finishing, setFinishing] = useState(false),
    [now, setNow] = useState(Date.now());
  const [setErrors, setSetErrors] = useState<Record<string, string>>({});
  const allowNavigation = useUnsaved(dirty),
    focusId = useRef<string | null>(null);
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  const backfill = initial.status === 'draft' || initial.status === 'completed';
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (focusId.current && !search) {
      document.getElementById(focusId.current)?.querySelector('input')?.focus();
      focusId.current = null;
    }
  }, [search, workout.exercises]);
  function close() {
    if (!dirty || confirm(t('common.unsaved'))) {
      allowNavigation();
      if (onClose) onClose();
      else location.assign('/fitness?view=history');
    }
  }
  async function discard() {
    if (!confirm(t('common.confirmDelete'))) return;
    setFinishing(true);
    try {
      try {
        await save();
      } catch {
        /* Failed input must not prevent discarding a workout. */
      }
      await api(`/api/fitness/sessions/${workout.id}`, { method: 'DELETE' });
      allowNavigation();
      location.assign('/fitness?view=history');
    } catch (e) {
      setError(errorText(e, locale));
      setFinishing(false);
    }
  }
  function patch(p: Partial<Workout>, immediate = false) {
    change(p);
    if (immediate && automatic) void save().catch(() => {});
  }
  function updateSet(exerciseId: string, setId: string, p: Partial<FitnessSet>) {
    const exercises = workout.exercises.map((e) =>
      e.id !== exerciseId
        ? e
        : {
            ...e,
            sets: e.sets.map((s) => {
              if (s.id !== setId) return s;
              const next = { ...s, ...p };
              if (backfill && p.completed === undefined)
                next.completed = validCompletedSet(next, recordingType(e));
              if (
                !backfill &&
                p.completed === undefined &&
                !validCompletedSet(next, recordingType(e))
              )
                next.completed = false;
              return next;
            }),
          },
    );
    patch({ exercises }, p.completed !== undefined);
    setSetErrors((x) => ({ ...x, [setId]: '' }));
  }
  function addExercises(items: Exercise[]) {
    const additions = items
      .filter((x) => !workout.exercises.some((e) => e.exercise_id === x.id))
      .map((e) => ({
        id: crypto.randomUUID(),
        exercise_id: e.id,
        name_en: e.name_en,
        name_zh: e.name_zh,
        target: e.target,
        equipment: e.equipment,
        recording_type: recordingType(e),
        sets: [blankSet()],
      }));
    patch({ mode: 'detailed', exercises: [...workout.exercises, ...additions] }, true);
    focusId.current = additions[0]?.id ?? null;
    setSearch(false);
  }
  function addSet(id: string, source?: FitnessSet) {
    patch(
      {
        exercises: workout.exercises.map((e) => {
          if (e.id !== id) return e;
          const previous = source ?? e.sets.at(-1);
          return {
            ...e,
            sets: [
              ...e.sets,
              {
                ...blankSet(),
                ...(source ? source : {}),
                id: crypto.randomUUID(),
                weight: previous?.weight ?? null,
                reps: previous?.reps ?? null,
                completed: false,
              },
            ],
          };
        }),
      },
      true,
    );
  }
  function move(index: number, delta: number) {
    const exercises = [...workout.exercises];
    [exercises[index], exercises[index + delta]] = [exercises[index + delta]!, exercises[index]!];
    patch({ exercises }, true);
  }
  async function finish(removeIncomplete = false) {
    setError('');
    const exercises = workout.exercises.map((e) => ({
      ...e,
      sets: removeIncomplete ? e.sets.filter((s) => s.completed) : e.sets,
    }));
    const input = {
      ...workout,
      exercises,
      status: 'completed',
      end_at: workout.end_at ?? new Date().toISOString(),
    };
    const parsed = workoutSchema.safeParse(input);
    if (!parsed.success) {
      setError(
        t('record.checkFields') +
          ' ' +
          [
            ...new Set(
              parsed.error.issues.map((i) =>
                i.path[0] === 'title'
                  ? t('fitness.type')
                  : i.path[0] === 'start_at'
                    ? t('common.start')
                    : i.path[0] === 'end_at'
                      ? t('common.end')
                      : t('record.invalidSet'),
              ),
            ),
          ].join(' · '),
      );
      return;
    }
    if (
      exercises.some((e) =>
        e.sets.some((s) => s.completed && !validCompletedSet(s, recordingType(e))),
      )
    ) {
      setError(t('record.invalidSet'));
      return;
    }
    setFinishing(true);
    try {
      change({ exercises, end_at: input.end_at });
      const saved = await save(true);
      allowNavigation();
      location.assign(`/fitness/${saved.id}`);
    } catch (e) {
      setError(errorText(e, locale));
    } finally {
      setFinishing(false);
    }
  }
  const seconds = Math.max(
    0,
    ((workout.end_at ? Date.parse(workout.end_at) : now) - Date.parse(workout.start_at)) / 1000,
  );
  const completed = workout.exercises.reduce(
      (n, e) => n + e.sets.filter((s) => s.completed).length,
      0,
    ),
    incomplete = workout.exercises.reduce(
      (n, e) => n + e.sets.filter((s) => !s.completed).length,
      0,
    );
  return (
    <div className="workout-workspace">
      <div className="record-heading">
        <Button type="button" variant="ghost" onClick={close}>
          <ArrowLeft size={16} />
          {t('fitness.history')}
        </Button>
        {initial.status !== 'completed' && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t('record.discard')}
            disabled={finishing}
            onClick={() => void discard()}
          >
            <Trash2 size={16} />
          </Button>
        )}
        <span role="status" className={`small ${state === 'error' ? 'error' : 'muted'}`}>
          {t(`record.${state}`)}
        </span>
        {state === 'error' && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              if (saveError instanceof ApiFailure && saveError.code === 'CONFLICT') {
                if (confirm(t('common.unsaved'))) location.reload();
              } else void save().catch(() => {});
            }}
          >
            {t(
              saveError instanceof ApiFailure && saveError.code === 'CONFLICT'
                ? 'record.reload'
                : 'record.retry',
            )}
          </Button>
        )}
      </div>
      <div className="record-summary">
        <div>
          <strong>{Math.floor(seconds / 60)}</strong>
          <span>{t('common.minutes')}</span>
        </div>
        <div>
          <strong>{completed}</strong>
          <span>{t('fitness.set')}</span>
        </div>
        <div>
          <strong>
            {Math.round(
              toDisplayWeight(workoutVolume(workout), preferences.weightUnit),
            ).toLocaleString(locale)}
          </strong>
          <span>
            {t('dashboard.volume')} · {preferences.weightUnit}
          </span>
        </div>
      </div>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          setReview(true);
        }}
      >
        <fieldset
          className="record-fields"
          disabled={finishing}
          onKeyDown={(event) => {
            if (
              event.key !== 'Enter' ||
              !(event.target instanceof HTMLInputElement) ||
              event.target.type !== 'number'
            )
              return;
            const section = event.target.closest('.set-exercise');
            if (!section) return;
            event.preventDefault();
            const inputs = Array.from(section.querySelectorAll('input')).filter(
              (input) => input.offsetParent !== null,
            );
            const next = inputs[inputs.indexOf(event.target) + 1];
            if (next) next.focus();
            else {
              addSet(section.id);
              requestAnimationFrame(() =>
                Array.from(section.querySelectorAll<HTMLElement>('.record-set-inputs'))
                  .at(-1)
                  ?.querySelector('input')
                  ?.focus(),
              );
            }
          }}
        >
          <details
            className="record-metadata"
            open={initial.status === 'draft' || initial.mode === 'quick'}
          >
            <summary>{t('record.sessionInfo')}</summary>
            <div className="form">
              <label className="field">
                <span>{t('fitness.type')}</span>
                <input
                  required
                  maxLength={120}
                  value={workout.title}
                  onChange={(e) => patch({ title: e.target.value })}
                />
              </label>
              <div className="form-row">
                {(['start_at', 'end_at'] as const).map((key) => (
                  <label className="field" key={key}>
                    <span>
                      {t(key === 'start_at' ? 'common.start' : 'common.end')} · {workout.timezone}
                    </span>
                    <input
                      type="datetime-local"
                      required={key === 'start_at' || backfill}
                      value={workout[key] ? zonedInput(workout[key]!, workout.timezone) : ''}
                      onChange={(e) => {
                        try {
                          patch({
                            [key]: e.target.value
                              ? zonedISO(e.target.value, workout.timezone)
                              : null,
                          });
                          setError('');
                        } catch {
                          setError(t('record.invalidTime'));
                        }
                      }}
                    />
                  </label>
                ))}
              </div>
              <div className="segmented">
                {(['quick', 'detailed'] as const).map((mode) => (
                  <button
                    type="button"
                    key={mode}
                    aria-pressed={workout.mode === mode}
                    onClick={() => {
                      if (
                        mode === 'quick' &&
                        workout.exercises.length &&
                        !confirm(t('common.confirmDelete'))
                      )
                        return;
                      patch({ mode, exercises: mode === 'quick' ? [] : workout.exercises });
                    }}
                  >
                    {t(`fitness.${mode}`)}
                  </button>
                ))}
              </div>
              {workout.mode === 'detailed' && (
                <fieldset className="parts-field">
                  <legend>{t('fitness.parts')}</legend>
                  <div className="part-options">
                    {(
                      [
                        'back',
                        'chest',
                        'legs',
                        'shoulders',
                        'arms',
                        'core',
                        'cardio',
                        'other',
                      ] as const
                    ).map((part) => (
                      <button
                        type="button"
                        className="part-chip"
                        aria-pressed={workout.body_parts.includes(part)}
                        key={part}
                        onClick={() =>
                          patch({
                            body_parts: workout.body_parts.includes(part)
                              ? workout.body_parts.filter((x) => x !== part)
                              : [...workout.body_parts, part],
                          })
                        }
                      >
                        {part === 'back' ? taxonomyLabel('back', locale) : t(`fitness.${part}`)}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
            </div>
          </details>
          {workout.mode === 'detailed' && (
            <>
              {!workout.exercises.length && (
                <div className="empty">
                  <p>{t('record.chooseFirst')}</p>
                  <Button type="button" onClick={() => setSearch(true)}>
                    <Plus size={16} />
                    {t('fitness.addExercise')}
                  </Button>
                </div>
              )}
              {workout.exercises.map((exercise, index) => {
                const type = recordingType(exercise),
                  fields =
                    type === 'weight'
                      ? (['weight', 'reps'] as const)
                      : type === 'reps'
                        ? (['reps'] as const)
                        : type === 'duration'
                          ? (['duration'] as const)
                          : (['duration', 'distance'] as const);
                return (
                  <section className="set-exercise" key={exercise.id} id={exercise.id}>
                    <div className="card-heading">
                      <h3>
                        {String(index + 1).padStart(2, '0')} · {exerciseName(exercise, locale)}
                      </h3>
                      <div className="row-controls">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={index === 0}
                          aria-label={t('record.moveUp')}
                          onClick={() => move(index, -1)}
                        >
                          <ArrowUp size={16} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={index === workout.exercises.length - 1}
                          aria-label={t('record.moveDown')}
                          onClick={() => move(index, 1)}
                        >
                          <ArrowDown size={16} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t('fitness.removeExercise')}
                          onClick={() => {
                            if (confirm(t('common.confirmDelete')))
                              patch(
                                {
                                  exercises: workout.exercises.filter((e) => e.id !== exercise.id),
                                },
                                true,
                              );
                          }}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                    <div className="record-exercise-meta">
                      <label className="field">
                        <span>{t('record.recordingType')}</span>
                        <select
                          value={type}
                          onChange={(event) => {
                            const next = event.target.value as RecordingType;
                            patch({
                              exercises: workout.exercises.map((e) =>
                                e.id === exercise.id
                                  ? {
                                      ...e,
                                      recording_type: next,
                                      sets: e.sets.map((s) => ({
                                        ...s,
                                        weight: next === 'weight' ? s.weight : null,
                                        reps: next === 'weight' || next === 'reps' ? s.reps : null,
                                        duration:
                                          next === 'duration' || next === 'cardio'
                                            ? s.duration
                                            : null,
                                        distance: next === 'cardio' ? s.distance : null,
                                        completed: false,
                                      })),
                                    }
                                  : e,
                              ),
                            });
                          }}
                        >
                          {(['weight', 'reps', 'duration', 'cardio'] as const).map((v) => (
                            <option key={v} value={v}>
                              {t(`record.type.${v}`)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <span className="muted small">
                        {Math.round(
                          toDisplayWeight(
                            workoutVolume({ ...workout, exercises: [exercise] }),
                            preferences.weightUnit,
                          ),
                        )}{' '}
                        {preferences.weightUnit}
                      </span>
                    </div>
                    {exercise.sets.map((set, i) => (
                      <div className={`set-row ${set.completed ? 'done' : ''}`} key={set.id}>
                        <div className="set-label">
                          <span>
                            {t('fitness.set')} {i + 1}
                          </span>
                          <div className="row-controls">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={t('fitness.setDone')}
                              aria-pressed={set.completed}
                              onClick={() => {
                                if (!set.completed && !validCompletedSet(set, type)) {
                                  setSetErrors((x) => ({ ...x, [set.id]: t('record.invalidSet') }));
                                  return;
                                }
                                updateSet(exercise.id, set.id, { completed: !set.completed });
                              }}
                            >
                              <Check size={18} />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={t('record.copySet')}
                              onClick={() => addSet(exercise.id, set)}
                            >
                              <Copy size={15} />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={t('fitness.removeSet')}
                              onClick={() => {
                                if (confirm(t('common.confirmDelete')))
                                  patch(
                                    {
                                      exercises: workout.exercises.map((e) =>
                                        e.id === exercise.id
                                          ? { ...e, sets: e.sets.filter((s) => s.id !== set.id) }
                                          : e,
                                      ),
                                    },
                                    true,
                                  );
                              }}
                            >
                              <Trash2 size={15} />
                            </Button>
                          </div>
                        </div>
                        <div className="record-set-inputs">
                          {fields.map((key) => (
                            <label className="field" key={key}>
                              <span>
                                {t(`fitness.${key}`)}
                                {key === 'weight'
                                  ? ` (${preferences.weightUnit})`
                                  : key === 'distance'
                                    ? ` (${preferences.distanceUnit})`
                                    : key === 'duration'
                                      ? ` (${t('fitness.unitSeconds')})`
                                      : ''}
                              </span>
                              <input
                                type="number"
                                inputMode={key === 'reps' ? 'numeric' : 'decimal'}
                                min={key === 'weight' ? 0 : 1}
                                step={key === 'reps' ? 1 : 'any'}
                                value={
                                  set[key] === null
                                    ? ''
                                    : key === 'weight'
                                      ? Number(
                                          toDisplayWeight(
                                            set[key]!,
                                            preferences.weightUnit,
                                          ).toFixed(2),
                                        )
                                      : key === 'distance'
                                        ? Number(
                                            toDisplayDistance(
                                              set[key]!,
                                              preferences.distanceUnit,
                                            ).toFixed(3),
                                          )
                                        : set[key]!
                                }
                                onChange={(event) => {
                                  const v =
                                    event.target.value === '' ? null : Number(event.target.value);
                                  updateSet(exercise.id, set.id, {
                                    [key]:
                                      v === null
                                        ? null
                                        : key === 'weight'
                                          ? toKg(v, preferences.weightUnit)
                                          : key === 'distance'
                                            ? toMeters(v, preferences.distanceUnit)
                                            : v,
                                  });
                                }}
                              />
                            </label>
                          ))}
                        </div>
                        <details>
                          <summary className="small muted">{t('record.moreFields')}</summary>
                          <div className="form-row">
                            <label className="field">
                              <span>RPE</span>
                              <input
                                type="number"
                                min={1}
                                max={10}
                                step="0.5"
                                inputMode="decimal"
                                value={set.rpe ?? ''}
                                onChange={(e) =>
                                  updateSet(exercise.id, set.id, {
                                    rpe: e.target.value ? Number(e.target.value) : null,
                                  })
                                }
                              />
                            </label>
                            <label className="field">
                              <span>{t('common.note')}</span>
                              <input
                                maxLength={1000}
                                value={set.note}
                                onChange={(e) =>
                                  updateSet(exercise.id, set.id, { note: e.target.value })
                                }
                              />
                            </label>
                          </div>
                        </details>
                        {setErrors[set.id] && (
                          <p role="alert" className="error small">
                            {setErrors[set.id]}
                          </p>
                        )}
                      </div>
                    ))}
                    <Button type="button" variant="secondary" onClick={() => addSet(exercise.id)}>
                      <Plus size={16} />
                      {t('fitness.addSet')}
                    </Button>
                  </section>
                );
              })}
            </>
          )}
          <label className="field">
            <span>{t('common.note')}</span>
            <textarea
              maxLength={5000}
              value={workout.note}
              onChange={(e) => patch({ note: e.target.value })}
            />
          </label>
          {initial.status === 'completed' && (
            <label className="field">
              <span>{t('common.visibility')}</span>
              <select
                value={workout.visibility}
                onChange={(e) => patch({ visibility: e.target.value as Workout['visibility'] })}
              >
                <option value="private">{t('common.private')}</option>
                <option value="public">{t('common.public')}</option>
              </select>
            </label>
          )}
          {(error || saveError != null) && (
            <p role="alert" className="form-message error">
              {error || errorText(saveError, locale)}
              {saveError instanceof ApiFailure &&
                saveError.fields &&
                Object.keys(saveError.fields)
                  .map((path) =>
                    path.includes('sets')
                      ? t('record.invalidSet')
                      : path === 'title'
                        ? t('fitness.type')
                        : path === 'end_at'
                          ? t('common.end')
                          : path === 'start_at'
                            ? t('common.start')
                            : t('record.checkFields'),
                  )
                  .join(' · ')}
            </p>
          )}
          <div className="record-footer">
            {workout.mode === 'detailed' && (
              <Button type="button" variant="secondary" onClick={() => setSearch(true)}>
                <Plus size={16} />
                {t('fitness.addExercise')}
              </Button>
            )}
            <Button type="submit" disabled={finishing}>
              {initial.status === 'completed' ? t('common.save') : t('fitness.finish')}
            </Button>
          </div>
        </fieldset>
      </form>
      <Dialog
        open={search}
        onOpenChange={setSearch}
        title={t('fitness.addExercise')}
        locale={locale}
        wide
      >
        <Suspense fallback={<p>{t('common.loading')}</p>}>
          <ExerciseSearch
            locale={locale}
            owner
            onSelectMany={addExercises}
            selectedIds={workout.exercises.map((e) => e.exercise_id)}
            onExisting={(id) => {
              focusId.current = workout.exercises.find((e) => e.exercise_id === id)?.id ?? null;
              setSearch(false);
            }}
          />
        </Suspense>
      </Dialog>
      <Dialog open={review} onOpenChange={setReview} title={t('record.review')} locale={locale}>
        <div className="form">
          <p>
            {workout.title} · {Math.floor(seconds / 60)} {t('common.minutes')}
          </p>
          <p>
            {workout.exercises.length} {t('fitness.library')} · {completed} {t('fitness.set')} ·{' '}
            {Math.round(toDisplayWeight(workoutVolume(workout), preferences.weightUnit))}{' '}
            {preferences.weightUnit}
          </p>
          {incomplete > 0 && (
            <p>
              {t('record.incomplete')} {incomplete}
            </p>
          )}
          <label className="field">
            <span>{t('common.visibility')}</span>
            <select
              value={workout.visibility}
              onChange={(e) => patch({ visibility: e.target.value as Workout['visibility'] })}
            >
              <option value="private">{t('common.private')}</option>
              <option value="public">{t('common.public')}</option>
            </select>
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="form-actions">
            <Button type="button" variant="ghost" onClick={() => setReview(false)}>
              {t('record.returnEdit')}
            </Button>
            <Button type="button" disabled={finishing} onClick={() => void finish(incomplete > 0)}>
              {finishing
                ? t('common.saving')
                : t(incomplete > 0 ? 'record.removeAndFinish' : 'record.confirmSave')}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
