import { useEffect, useState, lazy, Suspense } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import type { Locale, Preferences, Workout } from '../../types/domain';
import { translator } from '../../lib/i18n';
import { api, errorText } from '../../lib/api';
import { useUnsaved } from '../../lib/use-unsaved';
import { zonedInput, zonedISO } from '../../lib/fitness-recording';
const WorkoutEditor = lazy(() => import('./WorkoutEditor'));
export default function WorkoutActions({
  locale,
  preferences,
  workout,
}: {
  locale: Locale;
  preferences: Preferences;
  workout?: Workout;
}) {
  const t = translator(locale),
    [open, setOpen] = useState(false),
    [dirty, setDirty] = useState(false),
    [intent, setIntent] = useState<'live' | 'backfill' | 'quick'>('live'),
    [pending, setPending] = useState(false),
    [error, setError] = useState(''),
    [active, setActive] = useState<Workout[]>([]);
  const [title, setTitle] = useState(''),
    [start, setStart] = useState(() =>
      zonedInput(new Date(Date.now() - 3600000).toISOString(), preferences.timezone),
    ),
    [end, setEnd] = useState(() => zonedInput(new Date().toISOString(), preferences.timezone));
  useEffect(() => {
    if (new URLSearchParams(location.search).get('new') === '1') setOpen(true);
  }, []);
  const allowNavigation = useUnsaved(dirty && open && !workout);
  async function launch(value: typeof intent) {
    setDirty(false);
    setIntent(value);
    setOpen(true);
    setError('');
    if (!workout)
      try {
        const result = await api<{ items: Workout[] }>('/api/fitness/sessions?status=active');
        setActive(result.items);
      } catch (e) {
        setError(errorText(e, locale));
      }
  }
  async function create() {
    setPending(true);
    setError('');
    try {
      const w: Workout = {
        id: crypto.randomUUID(),
        user_id: '',
        title: title.trim() || t('record.defaultTitle'),
        mode: intent === 'quick' ? 'quick' : 'detailed',
        status: intent === 'live' ? 'active' : 'draft',
        body_parts: [],
        start_at:
          intent === 'live' ? new Date().toISOString() : zonedISO(start, preferences.timezone),
        end_at: intent === 'live' ? null : zonedISO(end, preferences.timezone),
        timezone: preferences.timezone,
        note: '',
        visibility: 'private',
        exercises: [],
        updated_at: '',
      };
      if (w.end_at && w.end_at < w.start_at) throw new Error('INVALID_INPUT');
      const saved = await api<Workout>('/api/fitness/sessions', { method: 'POST', body: w });
      allowNavigation();
      location.assign(`/fitness/${saved.id}`);
    } catch (e) {
      setError(
        e instanceof Error && e.message === 'INVALID_INPUT'
          ? t('record.invalidTime')
          : errorText(e, locale),
      );
      setPending(false);
    }
  }
  async function remove() {
    if (!workout || !confirm(t('common.confirmDelete'))) return;
    setPending(true);
    try {
      await api(`/api/fitness/sessions/${workout.id}`, { method: 'DELETE' });
      location.assign('/fitness?view=history');
    } catch (e) {
      setError(errorText(e, locale));
      setPending(false);
    }
  }
  return (
    <>
      <div className="form-actions" style={{ padding: 0 }}>
        {workout ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('common.delete')}
              onClick={remove}
              disabled={pending}
            >
              <Trash2 size={17} />
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Pencil size={15} />
              {t('common.edit')}
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => void launch('quick')}>
              {t('fitness.quick')}
            </Button>
            <Button variant="secondary" onClick={() => void launch('backfill')}>
              {t('record.backfill')}
            </Button>
            <Button onClick={() => void launch('live')}>
              <Plus size={16} />
              {t('fitness.start')}
            </Button>
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {open && workout && (
        <Dialog
          open
          onOpenChange={(value) => {
            if (!value && (!dirty || confirm(t('common.unsaved')))) setOpen(false);
          }}
          title={t('common.edit')}
          locale={locale}
          wide
        >
          <Suspense fallback={<p>{t('common.loading')}</p>}>
            <WorkoutEditor
              initial={workout}
              onDirtyChange={setDirty}
              locale={locale}
              preferences={preferences}
              onClose={() => setOpen(false)}
            />
          </Suspense>
        </Dialog>
      )}
      {open && !workout && (
        <Dialog
          open
          onOpenChange={(value) => {
            if (value || !dirty || confirm(t('common.unsaved'))) setOpen(value);
          }}
          title={t(
            intent === 'live'
              ? 'fitness.start'
              : intent === 'backfill'
                ? 'record.backfill'
                : 'fitness.quick',
          )}
          locale={locale}
        >
          <form
            className="form"
            onChangeCapture={() => setDirty(true)}
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            {intent === 'live' && active.length > 0 && (
              <div className="resume-list">
                <p>{t('record.existing')}</p>
                {active.map((w) => (
                  <a className="button button-secondary" href={`/fitness/${w.id}`} key={w.id}>
                    {t('record.resume')} · {w.title}
                  </a>
                ))}
              </div>
            )}
            <label className="field">
              <span>{t('fitness.type')}</span>
              <input
                value={title}
                maxLength={120}
                placeholder={t('record.defaultTitle')}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            {intent !== 'live' && (
              <div className="form-row">
                <label className="field">
                  <span>
                    {t('common.start')} · {preferences.timezone}
                  </span>
                  <input
                    type="datetime-local"
                    required
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>
                    {t('common.end')} · {preferences.timezone}
                  </span>
                  <input
                    type="datetime-local"
                    required
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </label>
              </div>
            )}
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <Button type="submit" disabled={pending}>
              {pending
                ? t('common.saving')
                : t(
                    intent === 'live' && active.length
                      ? 'record.startAnother'
                      : 'record.openRecord',
                  )}
            </Button>
          </form>
        </Dialog>
      )}
    </>
  );
}
