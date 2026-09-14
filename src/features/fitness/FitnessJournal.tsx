import { useRef, useState } from 'react';
import { Check, Clock3, Pencil } from 'lucide-react';
import type { Locale, Preferences, Workout } from '../../types/domain';
import { translator } from '../../lib/i18n';
import { fitnessSummary, knownWorkoutSeconds, workoutDay } from '../../lib/analytics';
import { zonedISO } from '../../lib/fitness-recording';
import { api, errorText } from '../../lib/api';
import WorkoutEditor from './WorkoutEditor';
import StoryIcon from '../../components/illustrations/StoryIcon';
export default function FitnessJournal({
  locale,
  preferences,
  initial,
}: {
  locale: Locale;
  preferences: Preferences;
  initial: Workout[];
}) {
  const t = translator(locale);
  const [items, setItems] = useState(initial),
    [saved, setSaved] = useState(false),
    [error, setError] = useState('');
  const [editing, setEditing] = useState<Workout | null>(null),
    [loading, setLoading] = useState(false);
  const [serial, setSerial] = useState(0);
  const summary = fitnessSummary(items, preferences);
  const draft = (): Workout => ({
    id: crypto.randomUUID(),
    mutation_id: crypto.randomUUID(),
    user_id: '',
    title: t('record.defaultTitle'),
    mode: 'quick',
    status: 'draft',
    body_parts: [],
    workout_date: summary.today,
    time_precision: 'date',
    duration_seconds: null,
    start_at: zonedISO(summary.today + 'T12:00', preferences.timezone),
    end_at: null,
    timezone: preferences.timezone,
    note: '',
    visibility: 'private',
    exercises: [],
    updated_at: '',
  });
  const [current, setCurrent] = useState(draft);
  const editor = useRef<HTMLElement>(null);
  const complete = (workout: Workout) => {
    setItems((old) =>
      [workout, ...old.filter((w) => w.id !== workout.id)].sort((a, b) =>
        b.start_at.localeCompare(a.start_at),
      ),
    );
    setSaved(true);
    setEditing(null);
    setCurrent(draft());
    setSerial((n) => n + 1);
  };
  async function edit(id: string) {
    if (!confirmIfDirty()) return;
    setLoading(true);
    setError('');
    try {
      const full = await api<Workout>(`/api/fitness/sessions/${id}`);
      setEditing(full);
      setSerial((n) => n + 1);
      setSaved(false);
      editor.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
    } catch (e) {
      setError(errorText(e, locale));
    } finally {
      setLoading(false);
    }
  }
  const dirty = useRef(false);
  function confirmIfDirty() {
    return !dirty.current || confirm(t('common.unsaved'));
  }
  const completed = items.filter((w) => w.status === 'completed');
  const week = completed.filter((w) => {
    const day = workoutDay(w, preferences.timezone);
    return day >= summary.weekStart && day <= summary.today;
  });
  const month = completed.filter(
    (w) => workoutDay(w, preferences.timezone).slice(0, 7) === summary.today.slice(0, 7),
  );
  const recent = month.filter((w) => !week.some((x) => x.id === w.id)).slice(0, 5);
  const monthSeconds = month.reduce((sum, w) => sum + (knownWorkoutSeconds(w) ?? 0), 0);
  const seconds = week.reduce((sum, w) => sum + (knownWorkoutSeconds(w) ?? 0), 0);
  function rows(records: Workout[]) {
    return records.map((w) => (
      <button
        type="button"
        className="journal-row"
        key={w.id}
        disabled={loading}
        onClick={() => void edit(w.id)}
      >
        <StoryIcon kind="fitness" size={23} />
        <span>
          <strong>{w.title}</strong>
          <small>
            {workoutDay(w, preferences.timezone)}
            {knownWorkoutSeconds(w) !== null
              ? ` · ${Math.round(knownWorkoutSeconds(w)! / 60)} ${t('common.minutes')}`
              : ''}
          </small>
        </span>
        <Pencil size={16} />
      </button>
    ));
  }
  return (
    <>
      <section id="record" className="inline-composer fitness-composer" ref={editor}>
        <h2>
          <StoryIcon kind="fitness" size={28} />
          {editing ? t('common.edit') : t('story.today')}
        </h2>
        {saved && (
          <p className="journal-success" role="status">
            <Check size={17} />
            {t('inline.saved')}
          </p>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <WorkoutEditor
          key={serial}
          locale={locale}
          preferences={preferences}
          initial={editing ?? current}
          fresh={!editing}
          inline
          onDirtyChange={(value) => {
            dirty.current = value;
            if (value) setSaved(false);
          }}
          onSaved={complete}
          onClose={() => {
            setEditing(null);
            setSerial((n) => n + 1);
          }}
        />
      </section>
      {items.some((w) => w.status !== 'completed') && (
        <section className="journal-section">
          <h2>{t('record.resume')}</h2>
          {rows(items.filter((w) => w.status !== 'completed'))}
        </section>
      )}
      <section className="journal-section">
        <h2>{t('inline.week')}</h2>
        <p className="small muted">
          <Clock3 size={14} /> {week.length} {t('common.times')}
          {week.some((w) => knownWorkoutSeconds(w) !== null)
            ? ` · ${Math.round(seconds / 60)} ${t('common.minutes')}`
            : ''}
        </p>
        {week.length ? rows(week) : <p className="muted">{t('story.noWeek')}</p>}
      </section>
      {
        <section className="journal-section">
          <h2>{t('story.month')}</h2>
          <p className="small muted">
            {month.length} {t('common.times')}
            {month.some((w) => knownWorkoutSeconds(w) !== null)
              ? ` · ${Math.round(monthSeconds / 60)} ${t('common.minutes')}`
              : ''}
          </p>
          {rows(recent)}
        </section>
      }
      <nav className="journal-tools">
        <a href="/fitness?view=history">{t('fitness.history')}</a>
        <a href="/fitness?view=analytics">{t('fitness.analytics')}</a>
        <a href="/fitness?view=templates">{t('fitness.templates')}</a>
        <a href="/fitness?view=library">{t('fitness.library')}</a>
      </nav>
    </>
  );
}
