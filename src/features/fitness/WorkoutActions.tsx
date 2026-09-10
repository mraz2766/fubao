import { useEffect, useState, lazy, Suspense } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import type { Locale, Preferences, Workout } from '../../types/domain';
import { translator } from '../../lib/i18n';
import { api, errorText } from '../../lib/api';
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
    [pending, setPending] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    if (new URLSearchParams(location.search).get('new') === '1') setOpen(true);
  }, []);
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
        {workout && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('common.delete')}
            onClick={remove}
            disabled={pending}
          >
            <Trash2 size={17} />
          </Button>
        )}
        <Button onClick={() => setOpen(true)}>
          {workout ? <Pencil size={15} /> : <Plus size={16} />}{' '}
          {workout ? t('common.edit') : t('fitness.new')}
        </Button>
      </div>
      {error && (
        <p className="form-message error" role="alert">
          {error}
        </p>
      )}
      {open && (
        <Suspense fallback={<p role="status">{t('common.loading')}</p>}>
          <WorkoutEditor
            locale={locale}
            preferences={preferences}
            initial={workout}
            onClose={() => setOpen(false)}
          />
        </Suspense>
      )}
    </>
  );
}
