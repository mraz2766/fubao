import { useState, lazy, Suspense, type SubmitEvent } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import type { Workout, Locale, Preferences, FitnessSet, Exercise } from '../../types/domain';
import { translator, exerciseName } from '../../lib/i18n';
import { toDisplayWeight, toKg, toDisplayDistance, toMeters } from '../../lib/analytics';
import { api, errorText } from '../../lib/api';
import { workoutSchema } from '../../lib/schemas';
import { useUnsaved } from '../../lib/use-unsaved';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
const ExerciseSearch = lazy(() => import('./ExerciseSearch'));
const localTime = (iso: string) => {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const blankSet = (): FitnessSet => ({
  id: crypto.randomUUID(),
  reps: null,
  weight: null,
  duration: null,
  distance: null,
  rpe: null,
  note: '',
  completed: false,
});
export default function WorkoutEditor({
  locale,
  preferences,
  initial,
  onClose,
}: {
  locale: Locale;
  preferences: Preferences;
  initial?: Workout;
  onClose: () => void;
}) {
  const t = translator(locale),
    [workout, setWorkout] = useState<Workout>(
      () =>
        initial ?? {
          id: crypto.randomUUID(),
          user_id: '',
          title: '',
          mode: 'quick',
          status: 'completed',
          body_parts: [],
          start_at: new Date().toISOString(),
          end_at: new Date().toISOString(),
          timezone: preferences.timezone,
          note: '',
          visibility: 'private',
          exercises: [],
          updated_at: '',
        },
    );
  const [dirty, setDirty] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(''),
    [search, setSearch] = useState(false);
  const allowNavigation = useUnsaved(dirty);
  const change = (patch: Partial<Workout>) => {
    setWorkout((w) => ({ ...w, ...patch }));
    setDirty(true);
  };
  function close() {
    if (!pending && (!dirty || confirm(t('common.unsaved')))) onClose();
  }
  function updateSet(exerciseId: string, setId: string, patch: Partial<FitnessSet>) {
    change({
      exercises: workout.exercises.map((e) =>
        e.id === exerciseId
          ? { ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) }
          : e,
      ),
    });
  }
  function addExercise(exercise: Exercise) {
    change({
      exercises: [
        ...workout.exercises,
        {
          id: crypto.randomUUID(),
          exercise_id: exercise.id,
          name_en: exercise.name_en,
          name_zh: exercise.name_zh,
          target: exercise.target,
          sets: [blankSet()],
        },
      ],
    });
    setSearch(false);
  }
  async function save(status: Workout['status']) {
    setPending(true);
    setError('');
    const input = {
      ...workout,
      status,
      end_at: status === 'completed' ? (workout.end_at ?? new Date().toISOString()) : null,
    };
    if (!workoutSchema.safeParse(input).success) {
      setError(t('error.INVALID_INPUT'));
      setPending(false);
      return;
    }
    try {
      const saved = await api<Workout>('/api/fitness/sessions', { method: 'POST', body: input });
      setDirty(false);
      allowNavigation();
      location.assign(`/fitness/${saved.id}`);
    } catch (e) {
      setError(errorText(e, locale));
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && close()}
      title={initial ? t('common.edit') : t('fitness.new')}
      locale={locale}
      wide
    >
      <form
        className="form"
        onSubmit={(e: SubmitEvent<HTMLFormElement>) => {
          e.preventDefault();
          save('completed');
        }}
      >
        {!initial && (
          <div className="segmented">
            {(['quick', 'detailed'] as const).map((mode) => (
              <button
                type="button"
                key={mode}
                className={workout.mode === mode ? 'active' : ''}
                onClick={() => {
                  if (mode === 'quick' && workout.exercises.length && !confirm(t('common.unsaved')))
                    return;
                  change({
                    mode,
                    status: mode === 'quick' ? 'completed' : 'active',
                    exercises: mode === 'quick' ? [] : workout.exercises,
                  });
                }}
              >
                {t(`fitness.${mode}`)}
              </button>
            ))}
          </div>
        )}
        <label className="field">
          <span>{t('fitness.type')}</span>
          <input
            value={workout.title}
            maxLength={120}
            required
            onChange={(e) => change({ title: e.target.value })}
          />
        </label>
        <div className="form-row">
          <label className="field">
            <span>{t('common.start')}</span>
            <input
              type="datetime-local"
              required
              value={localTime(workout.start_at)}
              onChange={(e) => {
                if (e.target.value) change({ start_at: new Date(e.target.value).toISOString() });
              }}
            />
          </label>
          <label className="field">
            <span>{t('common.end')}</span>
            <input
              type="datetime-local"
              value={workout.end_at ? localTime(workout.end_at) : ''}
              onChange={(e) =>
                change({ end_at: e.target.value ? new Date(e.target.value).toISOString() : null })
              }
            />
          </label>
        </div>
        {workout.mode === 'detailed' && (
          <>
            <fieldset className="parts-field">
              <legend>{t('fitness.parts')}</legend>
              <div className="part-options">
                {(
                  ['back', 'chest', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'other'] as const
                ).map((part) => (
                  <button
                    type="button"
                    className={`part-chip ${workout.body_parts.includes(part) ? 'selected' : ''}`}
                    aria-pressed={workout.body_parts.includes(part)}
                    key={part}
                    onClick={() =>
                      change({
                        body_parts: workout.body_parts.includes(part)
                          ? workout.body_parts.filter((x) => x !== part)
                          : [...workout.body_parts, part],
                      })
                    }
                  >
                    {t(`fitness.${part}`)}
                  </button>
                ))}
              </div>
            </fieldset>
            {workout.exercises.map((exercise, index) => (
              <section className="set-exercise" key={exercise.id}>
                <div className="card-heading">
                  <h3>
                    <span className="muted mono">{String(index + 1).padStart(2, '0')} </span>
                    {exerciseName(exercise, locale)}
                  </h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('fitness.removeExercise')}
                    onClick={() =>
                      change({ exercises: workout.exercises.filter((e) => e.id !== exercise.id) })
                    }
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
                {exercise.sets.map((set, i) => (
                  <div className={`set-row ${set.completed ? 'done' : ''}`} key={set.id}>
                    <div className="set-label">
                      <span>
                        {t('fitness.set')} {i + 1}
                      </span>
                      <div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t('fitness.setDone')}
                          aria-pressed={set.completed}
                          onClick={() =>
                            updateSet(exercise.id, set.id, { completed: !set.completed })
                          }
                        >
                          <Check size={18} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t('fitness.removeSet')}
                          onClick={() =>
                            change({
                              exercises: workout.exercises.map((e) =>
                                e.id === exercise.id
                                  ? { ...e, sets: e.sets.filter((s) => s.id !== set.id) }
                                  : e,
                              ),
                            })
                          }
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                    <div className="set-inputs">
                      {(['weight', 'reps', 'duration', 'distance', 'rpe'] as const).map((key) => (
                        <label className="field" key={key}>
                          <span>
                            {t(`fitness.${key}`)}
                            {key === 'weight'
                              ? ` (${preferences.weightUnit})`
                              : key === 'distance'
                                ? ` (${preferences.distanceUnit})`
                                : ''}
                          </span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min={key === 'weight' ? 0 : 1}
                            max={key === 'rpe' ? 10 : undefined}
                            step={key === 'reps' ? 1 : 'any'}
                            value={
                              set[key] === null
                                ? ''
                                : key === 'weight'
                                  ? Number(
                                      toDisplayWeight(set[key]!, preferences.weightUnit).toFixed(2),
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
                    <label className="field">
                      <span className="small muted">{t('common.note')}</span>
                      <input
                        value={set.note}
                        maxLength={1000}
                        onChange={(e) => updateSet(exercise.id, set.id, { note: e.target.value })}
                      />
                    </label>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    change({
                      exercises: workout.exercises.map((e) =>
                        e.id === exercise.id
                          ? {
                              ...e,
                              sets: [
                                ...e.sets,
                                {
                                  ...blankSet(),
                                  weight: e.sets.at(-1)?.weight ?? null,
                                  reps: e.sets.at(-1)?.reps ?? null,
                                },
                              ],
                            }
                          : e,
                      ),
                    })
                  }
                >
                  <Plus size={15} />
                  {t('fitness.addSet')}
                </Button>
              </section>
            ))}
            <Button type="button" variant="secondary" onClick={() => setSearch(true)}>
              <Plus size={16} />
              {t('fitness.addExercise')}
            </Button>
          </>
        )}
        <label className="field">
          <span>{t('common.note')}</span>
          <textarea
            value={workout.note}
            maxLength={5000}
            onChange={(e) => change({ note: e.target.value })}
          />
        </label>
        <label className="field">
          <span>{t('common.visibility')}</span>
          <select
            value={workout.visibility}
            onChange={(e) => change({ visibility: e.target.value as Workout['visibility'] })}
          >
            <option value="private">{t('common.private')}</option>
            <option value="public">{t('common.public')}</option>
          </select>
        </label>
        {error && (
          <p className="form-message error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={close} disabled={pending}>
            {t('common.cancel')}
          </Button>
          {workout.mode === 'detailed' && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => save('active')}
              disabled={pending}
            >
              {t('fitness.saveDraft')}
            </Button>
          )}
          <Button type="submit" disabled={pending}>
            {pending
              ? t('common.saving')
              : workout.mode === 'quick'
                ? t('common.save')
                : t('fitness.finish')}
          </Button>
        </div>
      </form>
      <Dialog
        open={search}
        onOpenChange={setSearch}
        title={t('fitness.addExercise')}
        locale={locale}
        wide
      >
        <Suspense fallback={<p>{t('common.loading')}</p>}>
          <ExerciseSearch locale={locale} owner onSelect={addExercise} />
        </Suspense>
      </Dialog>
    </Dialog>
  );
}
