import { useEffect, useState } from 'react';
import { Search, Heart, Plus, Dumbbell, Info, Check, ArrowLeft } from 'lucide-react';
import type { Exercise, Locale, Workout, Preferences } from '../../types/domain';
import { translator, exerciseName, taxonomyLabel } from '../../lib/i18n';
import { api, errorText } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import MuscleFigure from './MuscleFigure';
import { blankSet, recordingType } from '../../lib/fitness-recording';
import { defaultPreferences } from '../../types/domain';
export default function ExerciseSearch({
  locale,
  onSelect,
  owner = false,
  onSelectMany,
  selectedIds = [],
  onExisting,
  preferences = defaultPreferences,
}: {
  locale: Locale;
  onSelect?: (exercise: Exercise) => void;
  owner?: boolean;
  onSelectMany?: (exercises: Exercise[]) => void;
  selectedIds?: string[];
  onExisting?: (id: string) => void;
  preferences?: Preferences;
}) {
  const [selected, setSelected] = useState<Exercise[]>([]),
    [ready, setReady] = useState(false),
    [targets, setTargets] = useState<Workout[] | null>(null),
    [joining, setJoining] = useState<Exercise | null>(null),
    [pending, setPending] = useState(false);
  const selecting = !!onSelect || !!onSelectMany;
  function choose(e: Exercise) {
    if (selectedIds.includes(e.id)) {
      onExisting?.(e.id);
      return;
    }
    if (onSelectMany)
      setSelected((items) =>
        items.some((x) => x.id === e.id) ? items.filter((x) => x.id !== e.id) : [...items, e],
      );
    else onSelect?.(e);
  }
  async function join(e: Exercise) {
    setJoining(e);
    setPending(true);
    try {
      const result = await api<{ items: Workout[] }>('/api/fitness/sessions?status=active');
      if (result.items.length === 1) await attach(e, result.items[0]);
      else setTargets(result.items);
    } catch (err) {
      setError(errorText(err, locale));
    } finally {
      setPending(false);
    }
  }
  async function attach(e: Exercise, w?: Workout) {
    setPending(true);
    try {
      const base: Workout = w ?? {
        id: crypto.randomUUID(),
        user_id: '',
        title: t('record.defaultTitle'),
        mode: 'detailed',
        status: 'active',
        body_parts: [],
        start_at: new Date().toISOString(),
        end_at: null,
        timezone: preferences.timezone,
        note: '',
        visibility: 'private',
        exercises: [],
        updated_at: '',
      };
      if (!base.exercises.some((x) => x.exercise_id === e.id))
        base.exercises.push({
          id: crypto.randomUUID(),
          exercise_id: e.id,
          name_en: e.name_en,
          name_zh: e.name_zh,
          target: e.target,
          equipment: e.equipment,
          recording_type: recordingType(e),
          sets: [blankSet()],
        });
      base.mode = 'detailed';
      const saved = await api<Workout>(`/api/fitness/sessions/${base.id}`, {
        method: 'PUT',
        body: base,
      });
      location.assign(`/fitness/${saved.id}`);
    } catch (err) {
      setError(errorText(err, locale));
      setPending(false);
    }
  }
  const t = translator(locale),
    [query, setQuery] = useState(''),
    [filterOpen, setFilterOpen] = useState(false),
    [body, setBody] = useState(''),
    [target, setTarget] = useState(''),
    [equipment, setEquipment] = useState(''),
    [mode, setMode] = useState('all'),
    [page, setPage] = useState(0);
  const [items, setItems] = useState<Exercise[]>([]),
    [more, setMore] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [detail, setDetail] = useState<Exercise | null>(null);
  const [filters, setFilters] = useState<{
    bodyParts: string[];
    targets: string[];
    equipment: string[];
  }>({ bodyParts: [], targets: [], equipment: [] });
  useEffect(() => {
    setReady(true);
  }, []);
  useEffect(() => {
    if (!filterOpen || filters.bodyParts.length) return;
    api<typeof filters>('/api/fitness/exercises/filters')
      .then(setFilters)
      .catch((e) => setError(errorText(e, locale)));
  }, [filterOpen, locale]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        q: query,
        bodyPart: body,
        target,
        equipment,
        mode,
        page: String(page),
      });
      api<{ items: Exercise[]; hasMore: boolean }>(`/api/fitness/exercises?${params}`, {
        signal: controller.signal,
      })
        .then((result) => {
          if (controller.signal.aborted) return;
          setItems(result.items);
          setMore(result.hasMore);
          setError('');
        })
        .catch((e) => {
          if (e.name !== 'AbortError') setError(errorText(e, locale));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, body, target, equipment, mode, page, locale]);
  async function favorite(exercise: Exercise) {
    try {
      const result = await api<{ favorite: boolean }>(
        `/api/fitness/exercises/${exercise.id}/favorite`,
        { method: 'POST', body: { favorite: !exercise.favorite } },
      );
      setItems(items.map((x) => (x.id === exercise.id ? { ...x, ...result } : x)));
    } catch (e) {
      setError(errorText(e, locale));
    }
  }
  const selectFilter = (setter: (v: string) => void, value: string) => {
    setter(value);
    setPage(0);
  };
  return (
    <div className="exercise-search">
      <div hidden={!!detail}>
        <label className="search-field">
          <Search size={17} />
          <input
            disabled={!ready}
            aria-label={t('common.search')}
            placeholder={t('common.search')}
            value={query}
            onChange={(e) => {
              setLoading(true);
              selectFilter(setQuery, e.target.value);
            }}
          />
        </label>
        <details className="filter-panel" onToggle={(e) => setFilterOpen(e.currentTarget.open)}>
          <summary>
            {t('quiet.filters')}
            {[body, target, equipment].filter(Boolean).length > 0 &&
              ' · ' + [body, target, equipment].filter(Boolean).length}
          </summary>
          <div className="filter-row">
            {(
              [
                [t('fitness.bodyPart'), body, setBody, filters.bodyParts],
                [t('fitness.target'), target, setTarget, filters.targets],
                [t('fitness.equipment'), equipment, setEquipment, filters.equipment],
              ] as const
            ).map(([label, value, setter, options]) => (
              <label key={label} className="field">
                <span className="small muted">{label}</span>
                <select value={value} onChange={(e) => selectFilter(setter, e.target.value)}>
                  <option value="">{t('common.all')}</option>
                  {options.map((v) => (
                    <option key={v} value={v}>
                      {taxonomyLabel(v, locale)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </details>
        {owner && (
          <div className="section-tabs">
            {(['all', 'recent', 'frequent', 'favorites'] as const).map((value) => (
              <button
                type="button"
                key={value}
                className={mode === value ? 'active' : ''}
                onClick={() => selectFilter(setMode, value)}
              >
                {value === 'all' ? t('fitness.allExercises') : t(`fitness.${value}`)}
              </button>
            ))}
          </div>
        )}
        {error && (
          <p className="form-message error" role="alert">
            {error}
          </p>
        )}
        <div aria-live="polite" className="exercise-results">
          {loading ? (
            <p className="muted small">{t('common.loading')}</p>
          ) : items.length === 0 ? (
            <div className="empty">
              <Dumbbell size={30} />
              <p>{t('fitness.noExercises')}</p>
            </div>
          ) : (
            items.map((exercise) => (
              <div className="exercise-row" key={exercise.id}>
                <div className="exercise-preview">
                  <>
                    {exercise.image ? (
                      <img
                        src={exercise.image}
                        alt={exerciseName(exercise, locale)}
                        width={96}
                        height={96}
                        loading="lazy"
                      />
                    ) : (
                      <MuscleFigure target={exercise.target} locale={locale} />
                    )}
                  </>
                </div>
                <button
                  type="button"
                  className="exercise-open"
                  aria-pressed={
                    selecting
                      ? selectedIds.includes(exercise.id) ||
                        selected.some((x) => x.id === exercise.id)
                      : undefined
                  }
                  onClick={() => (selecting ? choose(exercise) : setDetail(exercise))}
                >
                  <span>
                    <strong>{exerciseName(exercise, locale)}</strong>
                    <small>
                      {taxonomyLabel(exercise.target, locale)} ·{' '}
                      {taxonomyLabel(exercise.equipment, locale)}
                    </small>
                  </span>
                </button>
                {owner && !selecting && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('fitness.favorite')}
                    aria-pressed={exercise.favorite}
                    onClick={() => favorite(exercise)}
                  >
                    <Heart size={18} fill={exercise.favorite ? 'currentColor' : 'none'} />
                  </Button>
                )}
                {selecting && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    aria-label={`${t('common.add')} ${exerciseName(exercise, locale)}`}
                    onClick={() => choose(exercise)}
                  >
                    {selectedIds.includes(exercise.id) ||
                    selected.some((x) => x.id === exercise.id) ? (
                      <Check size={18} />
                    ) : (
                      <Plus size={18} />
                    )}
                  </Button>
                )}
                {selecting && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`${t('record.details')} ${exerciseName(exercise, locale)}`}
                    onClick={() => setDetail(exercise)}
                  >
                    <Info size={18} />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
        <div className="form-actions">
          {page > 0 && (
            <Button type="button" variant="ghost" onClick={() => setPage(page - 1)}>
              {t('common.previous')}
            </Button>
          )}
          {more && (
            <Button type="button" variant="ghost" onClick={() => setPage(page + 1)}>
              {t('common.next')}
            </Button>
          )}
        </div>
        {onSelectMany && (
          <div className="picker-footer">
            <Button
              type="button"
              disabled={!selected.length}
              onClick={() => onSelectMany(selected)}
            >
              {t('record.addSelected')} {selected.length}
            </Button>
          </div>
        )}
      </div>
      {detail && (
        <div className="form">
          <Button type="button" variant="ghost" onClick={() => setDetail(null)}>
            <ArrowLeft size={16} />
            {t('common.previous')}
          </Button>
          <h3>{exerciseName(detail, locale)}</h3>
          {detail.images?.length ? (
            <div className="exercise-poses">
              {detail.images.map((src, i) => (
                <figure key={src}>
                  <img
                    src={src}
                    alt={`${exerciseName(detail, locale)} ${i + 1}`}
                    width={480}
                    height={480}
                    loading="lazy"
                  />
                  <figcaption>{t(i === 0 ? 'record.poseStart' : 'record.poseEnd')}</figcaption>
                </figure>
              ))}
            </div>
          ) : null}
          {detail.attribution && <p className="small muted">{detail.attribution}</p>}
          <MuscleFigure
            target={detail.target}
            secondary={detail.secondary_muscles}
            locale={locale}
          />
          <div className="stats-inline">
            <div className="stat">
              <span>{t('fitness.target')}</span>
              <p>{taxonomyLabel(detail.target, locale)}</p>
            </div>
            <div className="stat">
              <span>{t('fitness.equipment')}</span>
              <p>{taxonomyLabel(detail.equipment, locale)}</p>
            </div>
          </div>
          <div>
            <h3>{t('fitness.secondary')}</h3>
            <p className="muted small">
              {detail.secondary_muscles.map((m) => taxonomyLabel(m, locale)).join(' · ') || '—'}
            </p>
          </div>
          <div>
            <h3>{t('fitness.instructions')}</h3>
            <ol className="instruction-list">
              {(locale === 'zh-CN' ? detail.instructions_zh : detail.instructions_en).map(
                (text, i) => (
                  <li key={i}>{text}</li>
                ),
              )}
            </ol>
          </div>
          {selecting && (
            <Button
              type="button"
              onClick={() => {
                choose(detail);
                setDetail(null);
              }}
            >
              <Plus size={16} />
              {t('fitness.addExercise')}
            </Button>
          )}
          {owner && !selecting && (
            <Button type="button" disabled={pending} onClick={() => void join(detail)}>
              {t('record.joinWorkout')}
            </Button>
          )}
        </div>
      )}
      <Dialog
        open={targets !== null}
        onOpenChange={(open) => !open && setTargets(null)}
        title={t('record.joinWorkout')}
        locale={locale}
      >
        <div className="form">
          {targets?.map((w) => (
            <Button
              key={w.id}
              type="button"
              disabled={pending}
              onClick={() => joining && void attach(joining, w)}
            >
              {w.title}
            </Button>
          ))}
          <Button type="button" disabled={pending} onClick={() => joining && void attach(joining)}>
            {t('record.startAnother')}
          </Button>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </div>
      </Dialog>
    </div>
  );
}
