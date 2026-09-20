import {
  exerciseCategories,
  equipmentGroups,
  equipmentGroupLabels,
} from '../../lib/exercise-categories';
import type { TrainingPart } from '../../lib/fitness-recording';
import { useEffect, useState } from 'react';
import { Search, Heart, Plus, Dumbbell, Info, Check, ArrowLeft } from 'lucide-react';
import type { Exercise, Locale, Workout, Preferences } from '../../types/domain';
import { translator, exerciseName, taxonomyLabel } from '../../lib/i18n';
import { api, errorText } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import MuscleFigure from './MuscleFigure';
import { blankSet, recordingType, trainingParts } from '../../lib/fitness-recording';
import { defaultPreferences } from '../../types/domain';
export default function ExerciseSearch({
  locale,
  onSelect,
  owner = false,
  onSelectMany,
  selectedIds = [],
  onExisting,
  preferences = defaultPreferences,
  trainingItems = [],
  compact = false,
}: {
  locale: Locale;
  onSelect?: (exercise: Exercise) => void;
  owner?: boolean;
  onSelectMany?: (exercises: Exercise[]) => void;
  selectedIds?: string[];
  onExisting?: (id: string) => void;
  preferences?: Preferences;
  trainingItems?: string[];
  compact?: boolean;
}) {
  const relatedParts = trainingParts.filter((part) => trainingItems.includes(part));
  const zh = locale === 'zh-CN';
  const [category, setCategory] = useState<TrainingPart | ''>(
    relatedParts.length === 1 ? relatedParts[0] : '',
  );
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
      location.assign(`/fitness/${saved.id}/edit`);
    } catch (err) {
      setError(errorText(err, locale));
      setPending(false);
    }
  }
  const t = translator(locale),
    [query, setQuery] = useState(''),
    [equipment, setEquipment] = useState(''),
    [favoritesOnly, setFavoritesOnly] = useState(false),
    [mode, setMode] = useState('recommended'),
    [page, setPage] = useState(0),
    [retry, setRetry] = useState(0);
  const [items, setItems] = useState<Exercise[]>([]),
    [more, setMore] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [detail, setDetail] = useState<Exercise | null>(null);
  const browsing = !!category || !!query.trim() || mode === 'usual';
  useEffect(() => {
    setReady(true);
  }, []);
  useEffect(() => {
    if (!browsing) {
      setItems([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setError('');
    setLoading(true);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        q: query,
        category,
        equipmentGroup: equipment,
        favorites: favoritesOnly ? '1' : '',
        mode,
        page: String(page),
      });
      api<{ items: Exercise[]; hasMore: boolean }>(`/api/fitness/exercises?${params}`, {
        signal: controller.signal,
      })
        .then((result) => {
          if (controller.signal.aborted) return;
          setItems((previous) =>
            page === 0
              ? result.items
              : [
                  ...new Map(
                    [...previous, ...result.items].map((item) => [item.id, item]),
                  ).values(),
                ],
          );
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
  }, [query, category, equipment, favoritesOnly, mode, page, locale, browsing, retry]);
  async function favorite(exercise: Exercise) {
    try {
      const result = await api<{ favorite: boolean }>(
        `/api/fitness/exercises/${exercise.id}/favorite`,
        { method: 'POST', body: { favorite: !exercise.favorite } },
      );
      setItems(items.map((x) => (x.id === exercise.id ? { ...x, ...result } : x)));
      setDetail((current) => (current?.id === exercise.id ? { ...current, ...result } : current));
    } catch (e) {
      setError(errorText(e, locale));
    }
  }
  const selectFilter = (setter: (v: string) => void, value: string) => {
    setter(value);
    setItems([]);
    setLoading(true);
    setPage(0);
  };
  function showCategories() {
    setCategory('');
    setMode('recommended');
    setQuery('');
    setEquipment('');
    setFavoritesOnly(false);
    setPage(0);
  }
  function chooseCategory(part: TrainingPart) {
    setItems([]);
    setLoading(true);
    setCategory(part);
    setMode('recommended');
    setQuery('');
    setEquipment('');
    setFavoritesOnly(false);
    setPage(0);
  }
  return (
    <div className={compact ? 'exercise-search compact-exercises' : 'exercise-search'}>
      <div hidden={!!detail}>
        <div className="exercise-navigation">
          {browsing ? (
            <Button type="button" variant="ghost" onClick={showCategories}>
              <ArrowLeft size={16} />
              {zh ? '全部部位' : 'Body parts'}
            </Button>
          ) : (
            <h3>{zh ? '按部位选择' : 'Choose a body part'}</h3>
          )}
          {owner && mode !== 'usual' && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setCategory('');
                setQuery('');
                setEquipment('');
                setFavoritesOnly(false);
                setItems([]);
                setLoading(true);
                setMode('usual');
                setPage(0);
              }}
            >
              {zh ? '常用' : 'My exercises'}
            </Button>
          )}
        </div>
        {browsing && (
          <h3 className="exercise-category-title">
            {category
              ? t(`fitness.${category}`)
              : mode === 'usual'
                ? zh
                  ? '常用动作'
                  : 'My exercises'
                : zh
                  ? '搜索结果'
                  : 'Search results'}
          </h3>
        )}
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
              if (e.target.value.trim()) setMode('recommended');
            }}
          />
        </label>
        {!browsing && (
          <div className="exercise-category-grid">
            {[...exerciseCategories]
              .sort((a, b) => Number(relatedParts.includes(b)) - Number(relatedParts.includes(a)))
              .map((part) => (
                <button type="button" key={part} onClick={() => chooseCategory(part)}>
                  <span>{t(`fitness.${part}`)}</span>
                  <span aria-hidden="true">›</span>
                </button>
              ))}
          </div>
        )}
        {browsing && (
          <details className="filter-panel">
            <summary>
              {zh ? '器械与收藏' : 'Equipment & favorites'}
              {equipment
                ? ' · ' +
                  equipmentGroupLabels[equipment as keyof typeof equipmentGroupLabels][zh ? 0 : 1]
                : ''}
              {favoritesOnly ? (zh ? ' · 已收藏' : ' · Favorites') : ''}
            </summary>
            <div className="filter-row">
              <label className="field">
                <span>{t('fitness.equipment')}</span>
                <select
                  value={equipment}
                  onChange={(event) => selectFilter(setEquipment, event.target.value)}
                >
                  <option value="">{zh ? '不限器械' : 'Any equipment'}</option>
                  {equipmentGroups.map((group) => (
                    <option key={group} value={group}>
                      {equipmentGroupLabels[group][zh ? 0 : 1]}
                    </option>
                  ))}
                </select>
              </label>
              {owner && (
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={favoritesOnly}
                    onChange={(event) => {
                      setFavoritesOnly(event.target.checked);
                      setItems([]);
                      setLoading(true);
                      setPage(0);
                    }}
                  />
                  {zh ? '只看收藏' : 'Favorites only'}
                </label>
              )}
            </div>
          </details>
        )}
        {error && (
          <p className="form-message error" role="alert">
            {error}
            <Button type="button" variant="ghost" onClick={() => setRetry((n) => n + 1)}>
              {t('common.retry')}
            </Button>
          </p>
        )}
        {browsing && (
          <div aria-live="polite" className="exercise-results">
            {loading && page === 0 ? (
              <p className="muted small">{t('common.loading')}</p>
            ) : items.length === 0 ? (
              <div className="empty">
                <Dumbbell size={30} />
                <p>{t('fitness.noExercises')}</p>
                {(category || equipment || favoritesOnly || mode === 'usual') && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={
                      equipment || favoritesOnly
                        ? () => {
                            setEquipment('');
                            setFavoritesOnly(false);
                            setPage(0);
                          }
                        : showCategories
                    }
                  >
                    {equipment || favoritesOnly
                      ? zh
                        ? '清除筛选'
                        : 'Clear filters'
                      : zh
                        ? '选择其他部位'
                        : 'Browse body parts'}
                  </Button>
                )}
              </div>
            ) : (
              items.map((exercise) => (
                <div
                  className="exercise-row"
                  key={exercise.id}
                  data-selected={selecting && selected.some((x) => x.id === exercise.id)}
                >
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
                      selecting && !selectedIds.includes(exercise.id)
                        ? selected.some((x) => x.id === exercise.id)
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
                      {selecting && selectedIds.includes(exercise.id) && (
                        <small className="exercise-added">{t('record.inWorkout')}</small>
                      )}
                    </span>
                    {selecting &&
                      compact &&
                      (selected.some((x) => x.id === exercise.id) ? (
                        <Check
                          size={18}
                          aria-hidden="true"
                          style={{ marginLeft: 'auto', flexShrink: 0 }}
                        />
                      ) : (
                        <Plus
                          size={18}
                          aria-hidden="true"
                          style={{ marginLeft: 'auto', flexShrink: 0 }}
                        />
                      ))}
                  </button>
                  {selecting && !compact && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      aria-label={`${t(selectedIds.includes(exercise.id) ? 'record.locateExercise' : 'common.add')} ${exerciseName(exercise, locale)}`}
                      aria-pressed={
                        selectedIds.includes(exercise.id)
                          ? undefined
                          : selected.some((x) => x.id === exercise.id)
                      }
                      onClick={() => choose(exercise)}
                    >
                      {selectedIds.includes(exercise.id) ? (
                        <ArrowLeft size={18} />
                      ) : selected.some((x) => x.id === exercise.id) ? (
                        <Check size={18} />
                      ) : (
                        <Plus size={18} />
                      )}
                    </Button>
                  )}
                  {selecting && !compact && (
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
        )}
        {browsing && more && (
          <Button
            className="exercise-load-more"
            type="button"
            variant="ghost"
            disabled={loading || !!error}
            onClick={() => {
              setLoading(true);
              setPage(page + 1);
            }}
          >
            {loading ? t('common.loading') : zh ? '加载更多' : 'Load more'}
          </Button>
        )}
        {onSelectMany && selected.length > 0 && (
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
            <Button type="button" variant="secondary" onClick={() => void favorite(detail)}>
              <Heart size={16} fill={detail.favorite ? 'currentColor' : 'none'} />
              {zh
                ? detail.favorite
                  ? '取消收藏'
                  : '收藏动作'
                : detail.favorite
                  ? 'Unfavorite'
                  : 'Favorite'}
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
