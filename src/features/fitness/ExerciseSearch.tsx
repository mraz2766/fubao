import { useEffect, useState } from 'react';
import {
  Search,
  Heart,
  Plus,
  Dumbbell,
  Activity,
  Footprints,
  HeartPulse,
  BicepsFlexed,
} from 'lucide-react';
import type { Exercise, Locale } from '../../types/domain';
import { translator, exerciseName, taxonomyLabel } from '../../lib/i18n';
import { api, errorText } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import MuscleFigure from './MuscleFigure';
export default function ExerciseSearch({
  locale,
  onSelect,
  owner = false,
}: {
  locale: Locale;
  onSelect?: (exercise: Exercise) => void;
  owner?: boolean;
}) {
  const t = translator(locale),
    [query, setQuery] = useState(''),
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
    api<typeof filters>('/api/fitness/exercises/filters')
      .then(setFilters)
      .catch((e) => setError(errorText(e, locale)));
  }, [locale]);
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
      <label className="search-field">
        <Search size={17} />
        <input
          aria-label={t('common.search')}
          placeholder={t('common.search')}
          value={query}
          onChange={(e) => selectFilter(setQuery, e.target.value)}
        />
      </label>
      <div className="muscle-shortcuts">
        {[
          ['', Dumbbell],
          ['back', Activity],
          ['chest', BicepsFlexed],
          ['upper legs', Footprints],
          ['shoulders', BicepsFlexed],
          ['cardio', HeartPulse],
        ].map(([part, Icon]) => {
          const MuscleIcon = Icon as typeof Dumbbell;
          return (
            <button
              type="button"
              key={String(part)}
              className={body === part ? 'active' : ''}
              onClick={() => selectFilter(setBody, String(part))}
            >
              <MuscleIcon size={22} />
              <span>{part ? taxonomyLabel(String(part), locale) : t('common.all')}</span>
            </button>
          );
        })}
      </div>
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
                <MuscleFigure target={exercise.target} locale={locale} />
              </div>
              <button type="button" className="exercise-open" onClick={() => setDetail(exercise)}>
                <span>
                  <strong>{exerciseName(exercise, locale)}</strong>
                  <small>
                    {taxonomyLabel(exercise.target, locale)} ·{' '}
                    {taxonomyLabel(exercise.equipment, locale)}
                  </small>
                </span>
              </button>
              {owner && !onSelect && (
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
              {onSelect && (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  aria-label={`${t('common.add')} ${exerciseName(exercise, locale)}`}
                  onClick={() => onSelect(exercise)}
                >
                  <Plus size={18} />
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
      <Dialog
        open={!!detail}
        onOpenChange={(open) => !open && setDetail(null)}
        title={detail ? exerciseName(detail, locale) : ''}
        locale={locale}
      >
        {detail && (
          <div className="form">
            <MuscleFigure target={detail.target} locale={locale} />
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
            {onSelect && (
              <Button
                type="button"
                onClick={() => {
                  onSelect(detail);
                  setDetail(null);
                }}
              >
                <Plus size={16} />
                {t('fitness.addExercise')}
              </Button>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
