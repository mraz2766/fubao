import { useState, lazy, Suspense } from 'react';
import { Plus, Play, Trash2, Pencil } from 'lucide-react';
import type {
  Locale,
  WorkoutTemplate,
  Exercise,
  Preferences,
  FitnessSet,
  RecordingType,
} from '../../types/domain';
import { toDisplayWeight, toKg, toDisplayDistance, toMeters } from '../../lib/analytics';
import { translator, exerciseName } from '../../lib/i18n';
import { api, errorText } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { recordingType } from '../../lib/fitness-recording';
import { useUnsaved } from '../../lib/use-unsaved';
const ExerciseSearch = lazy(() => import('./ExerciseSearch'));
export default function Templates({
  locale,
  initial,
  preferences,
}: {
  locale: Locale;
  initial: WorkoutTemplate[];
  preferences: Preferences;
}) {
  const t = translator(locale),
    [items, setItems] = useState(initial),
    [editing, setEditing] = useState<WorkoutTemplate | null>(null),
    [search, setSearch] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(''),
    [dirty, setDirty] = useState(false);
  useUnsaved(dirty);
  function close() {
    if (pending) return;
    if (!dirty || confirm(t('common.unsaved'))) {
      setEditing(null);
      setDirty(false);
    }
  }
  async function save() {
    if (!editing) return;
    setPending(true);
    setError('');
    try {
      await api('/api/fitness/templates', { method: 'POST', body: editing });
      const result = await api<{ items: WorkoutTemplate[] }>('/api/fitness/templates');
      setItems(result.items);
      setEditing(null);
      setDirty(false);
    } catch (e) {
      setError(errorText(e, locale));
    } finally {
      setPending(false);
    }
  }
  async function start(id: string) {
    setPending(true);
    try {
      const result = await api<{ id: string }>(`/api/fitness/templates/${id}/start`, {
        method: 'POST',
        body: {},
      });
      location.assign(`/fitness/${result.id}`);
    } catch (e) {
      setError(errorText(e, locale));
      setPending(false);
    }
  }
  async function remove(id: string) {
    if (!confirm(t('common.confirmDelete'))) return;
    try {
      await api(`/api/fitness/templates/${id}`, { method: 'DELETE' });
      setItems(items.filter((t) => t.id !== id));
    } catch (e) {
      setError(errorText(e, locale));
    }
  }
  function changeSets(exerciseId: string, sets: FitnessSet[]) {
    if (!editing) return;
    setEditing({
      ...editing,
      exercises: editing.exercises.map((e) => (e.id === exerciseId ? { ...e, sets } : e)),
    });
    setDirty(true);
  }
  function select(e: Exercise) {
    if (!editing) return;
    setEditing({
      ...editing,
      exercises: [
        ...editing.exercises,
        {
          id: crypto.randomUUID(),
          exercise_id: e.id,
          name_en: e.name_en,
          name_zh: e.name_zh,
          target: e.target,
          equipment: e.equipment,
          recording_type: recordingType(e),
          sets: [
            {
              id: crypto.randomUUID(),
              reps: null,
              weight: null,
              duration: null,
              distance: null,
              rpe: null,
              note: '',
              completed: false,
            },
          ],
        },
      ],
    });
    setSearch(false);
    setDirty(true);
  }
  return (
    <>
      <div className="form-actions">
        <Button
          onClick={() => {
            setEditing({ id: crypto.randomUUID(), name: '', exercises: [] });
            setDirty(false);
          }}
        >
          <Plus size={16} />
          {t('fitness.templateNew')}
        </Button>
      </div>
      {error && (
        <p className="form-message error" role="alert">
          {error}
        </p>
      )}
      {items.length === 0 ? (
        <div className="empty">{t('fitness.templateEmpty')}</div>
      ) : (
        <div className="analytics-grid">
          {items.map((template) => (
            <section className="card" key={template.id}>
              <div className="card-heading">
                <h2>{template.name}</h2>
                <div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('common.edit')}
                    onClick={() => {
                      setEditing(template);
                      setDirty(false);
                    }}
                  >
                    <Pencil size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('common.delete')}
                    onClick={() => remove(template.id)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
              {template.exercises.map((e) => (
                <p key={e.id} className="small muted" style={{ padding: '6px 0' }}>
                  {exerciseName(e, locale)}
                </p>
              ))}
              <div className="form-actions">
                <Button onClick={() => start(template.id)} disabled={pending}>
                  <Play size={14} />
                  {t('fitness.start')}
                </Button>
              </div>
            </section>
          ))}
        </div>
      )}
      <Dialog
        open={!!editing}
        onOpenChange={(open) => !open && close()}
        title={t('fitness.templates')}
        locale={locale}
      >
        {editing && (
          <div className="form">
            <label className="field">
              <span>{t('fitness.templateName')}</span>
              <input
                value={editing.name}
                maxLength={120}
                onChange={(e) => {
                  setEditing({ ...editing, name: e.target.value });
                  setDirty(true);
                }}
              />
            </label>
            {editing.exercises.map((e, i) => (
              <section className="exercise-log" key={e.id}>
                <div className="exercise-row">
                  <span className="small muted">{i + 1}</span>
                  <span style={{ flex: 1 }}>{exerciseName(e, locale)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('fitness.removeExercise')}
                    onClick={() => {
                      setEditing({
                        ...editing,
                        exercises: editing.exercises.filter((x) => x.id !== e.id),
                      });
                      setDirty(true);
                    }}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
                <label className="field">
                  <span>{t('record.recordingType')}</span>
                  <select
                    value={recordingType(e)}
                    onChange={(event) => {
                      setEditing({
                        ...editing,
                        exercises: editing.exercises.map((x) =>
                          x.id === e.id
                            ? { ...x, recording_type: event.target.value as RecordingType }
                            : x,
                        ),
                      });
                      setDirty(true);
                    }}
                  >
                    {(['weight', 'reps', 'duration', 'cardio'] as const).map((v) => (
                      <option value={v} key={v}>
                        {t(`record.type.${v}`)}
                      </option>
                    ))}
                  </select>
                </label>
                {e.sets.map((set, index) => (
                  <div
                    key={set.id}
                    className="form-grid"
                    style={{ padding: '12px 0', borderTop: '1px solid var(--line)' }}
                  >
                    <span className="small muted">
                      {t('fitness.set')} {index + 1}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${t('common.delete')} ${t('fitness.set')} ${index + 1}`}
                      onClick={() =>
                        changeSets(
                          e.id,
                          e.sets.filter((s) => s.id !== set.id),
                        )
                      }
                    >
                      <Trash2 size={14} />
                    </Button>
                    {(['reps', 'weight', 'duration', 'distance', 'rpe'] as const).map((key) => {
                      const raw = set[key];
                      const display =
                        raw === null
                          ? ''
                          : key === 'weight'
                            ? +toDisplayWeight(raw, preferences.weightUnit).toFixed(2)
                            : key === 'distance'
                              ? +toDisplayDistance(raw, preferences.distanceUnit).toFixed(3)
                              : raw;
                      return (
                        <label className="field" key={key}>
                          <span>
                            {t(`fitness.${key}`)}{' '}
                            {key === 'weight'
                              ? preferences.weightUnit
                              : key === 'distance'
                                ? preferences.distanceUnit
                                : ''}
                          </span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min={key === 'weight' ? 0 : 1}
                            step={key === 'reps' ? 1 : 'any'}
                            value={display}
                            onChange={(event) => {
                              const value =
                                event.target.value === '' ? null : Number(event.target.value);
                              const converted =
                                value === null
                                  ? null
                                  : key === 'weight'
                                    ? toKg(value, preferences.weightUnit)
                                    : key === 'distance'
                                      ? toMeters(value, preferences.distanceUnit)
                                      : value;
                              changeSets(
                                e.id,
                                e.sets.map((s) =>
                                  s.id === set.id ? { ...s, [key]: converted } : s,
                                ),
                              );
                            }}
                          />
                        </label>
                      );
                    })}
                    <label className="field">
                      <span>{t('common.note')}</span>
                      <input
                        value={set.note}
                        maxLength={1000}
                        onChange={(event) =>
                          changeSets(
                            e.id,
                            e.sets.map((s) =>
                              s.id === set.id ? { ...s, note: event.target.value } : s,
                            ),
                          )
                        }
                      />
                    </label>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  onClick={() =>
                    changeSets(e.id, [
                      ...e.sets,
                      {
                        ...(e.sets.at(-1) ?? {
                          reps: null,
                          weight: null,
                          duration: null,
                          distance: null,
                          rpe: null,
                          note: '',
                          completed: false,
                        }),
                        id: crypto.randomUUID(),
                      },
                    ])
                  }
                >
                  <Plus size={14} />
                  {t('fitness.addSet')}
                </Button>
              </section>
            ))}
            <Button variant="secondary" onClick={() => setSearch(true)}>
              <Plus size={16} />
              {t('fitness.addExercise')}
            </Button>
            {error && (
              <p role="alert" className="form-message error">
                {error}
              </p>
            )}
            <div className="form-actions">
              <Button variant="ghost" onClick={close}>
                {t('common.cancel')}
              </Button>
              <Button
                disabled={pending || !editing.name.trim() || !editing.exercises.length}
                onClick={save}
              >
                {pending ? t('common.saving') : t('common.save')}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
      <Dialog
        open={search}
        onOpenChange={setSearch}
        title={t('fitness.addExercise')}
        locale={locale}
        wide
      >
        <Suspense fallback={<p>{t('common.loading')}</p>}>
          <ExerciseSearch locale={locale} owner onSelect={select} />
        </Suspense>
      </Dialog>
    </>
  );
}
