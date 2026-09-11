import { useEffect, useRef, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import type { Locale, Preferences, Workout } from '../../types/domain';
import { translator } from '../../lib/i18n';
import { api, errorText } from '../../lib/api';
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
    [ready, setReady] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(''),
    [active, setActive] = useState<Workout[]>([]);
  const lock = useRef(false),
    attempt = useRef<Workout | null>(null);
  useEffect(() => {
    setReady(true);
  }, []);
  async function create() {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError('');
    attempt.current ??= {
      id: crypto.randomUUID(),
      mutation_id: crypto.randomUUID(),
      user_id: '',
      title: t('record.defaultTitle'),
      mode: 'detailed',
      status: 'active',
      body_parts: [],
      start_at: new Date().toISOString(),
      end_at: null,
      time_precision: 'exact',
      timezone: preferences.timezone,
      note: '',
      visibility: 'private',
      exercises: [],
      updated_at: '',
    };
    try {
      const saved = await api<Workout>('/api/fitness/sessions', {
        method: 'POST',
        body: attempt.current,
      });
      location.assign(`/fitness/${saved.id}`);
    } catch (e) {
      setError(errorText(e, locale));
      setPending(false);
      lock.current = false;
    }
  }
  async function launch() {
    if (lock.current) return;
    setPending(true);
    setError('');
    try {
      const result = await api<{ items: Workout[] }>('/api/fitness/sessions?status=active');
      setActive(result.items);
      setOpen(true);
      setPending(false);
    } catch (e) {
      setError(errorText(e, locale));
      setPending(false);
    }
  }
  async function remove() {
    if (!workout || !confirm(t('common.confirmDelete'))) return;
    setPending(true);
    try {
      await api(`/api/fitness/sessions/${workout.id}`, { method: 'DELETE' });
      location.assign('/fitness');
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
            <details className="view-menu action-menu">
              <summary aria-label={t('simple.more')}>···</summary>
              <div className="action-menu-content">
                <Button
                  variant="ghost"

                  aria-label={t('common.delete')}
                  onClick={() => void remove()}
                  disabled={pending || !ready}
                >
                  <Trash2 size={17} /> {t('common.delete')}
                </Button>
              </div>
            </details>
            <Button
              disabled={!ready}
              onClick={() => location.assign(`/fitness/${workout.id}?edit=1`)}
            >
              <Pencil size={15} />
              {t('simple.supplement')}
            </Button>
          </>
        ) : (
          <Button variant="secondary" disabled={pending || !ready} onClick={() => void launch()}>
            <Plus size={16} />
            {t('fitness.start')}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {open && (
        <Dialog
          open
          title={t(workout ? 'simple.supplement' : 'fitness.start')}
          locale={locale}
          wide={!!workout}
          onOpenChange={(v) => {
            setOpen(v);
          }}
        >
          <div className="form">
            {active.length > 0 && <p>{t('record.existing')}</p>}
            {active.map((w) => (
              <a className="button button-secondary" key={w.id} href={`/fitness/${w.id}`}>
                {t('record.resume')} · {w.title}
              </a>
            ))}
            <Button variant="ghost" disabled={pending} onClick={() => void create()}>
              {t(active.length ? 'record.startAnother' : 'fitness.start')}
            </Button>
            <a className="button button-secondary" href="/fitness?view=templates">
              {t('flow.templateChoice')}
            </a>
          </div>
        </Dialog>
      )}
    </>
  );
}
