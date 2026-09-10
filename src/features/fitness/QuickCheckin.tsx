import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { Check, ArrowUpRight } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { translator } from '../../lib/i18n';
import { api, errorText } from '../../lib/api';
import { shiftDay } from '../../lib/analytics';
import { trainingParts } from '../../lib/fitness-recording';
import type { Locale, Preferences, Workout } from '../../types/domain';
const WorkoutEditor = lazy(() => import('./WorkoutEditor'));
export default function QuickCheckin({
  locale,
  preferences,
  today,
  order,
  weekCount,
  weekStart,
}: {
  locale: Locale;
  preferences: Preferences;
  today: string;
  order: string[];
  weekCount: number;
  weekStart: string;
}) {
  const t = translator(locale);
  const [date, setDate] = useState(today),
    [allParts, setAllParts] = useState(false),
    [customDate, setCustomDate] = useState(false),
    [saved, setSaved] = useState<Workout | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [ready, setReady] = useState(false),
    [editing, setEditing] = useState(false),
    [dirty, setDirty] = useState(false);
  const [receipts, setReceipts] = useState<Workout[]>([]);
  const lock = useRef(false),
    attempt = useRef<{ id: string; mutation_id: string; date: string; part: string } | null>(null);
  useEffect(() => setReady(true), []);
  async function checkin(part: string) {
    if (lock.current || saved) return;
    lock.current = true;
    setBusy(true);
    setError('');
    attempt.current ??= { id: crypto.randomUUID(), mutation_id: crypto.randomUUID(), date, part };
    try {
      const result = await api<Workout>('/api/fitness/checkin', {
        method: 'POST',
        body: attempt.current,
      });
      setSaved(result);
      setReceipts((previous) => [...previous, result]);
      attempt.current = null;
      // Refresh the server-rendered summary only when the user next navigates.
    } catch (e) {
      setError(errorText(e, locale));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function undo() {
    if (!saved || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await api(`/api/fitness/sessions/${saved.id}`, { method: 'DELETE' });
      setReceipts((previous) => previous.filter((w) => w.id !== saved.id));
      setSaved(null);
    } catch (e) {
      setError(errorText(e, locale));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="quick-checkin" aria-label={t('fitness.quick')}>
      <p className="muted small">
        {t('dashboard.week')} ·{' '}
        {weekCount +
          receipts.filter(
            (w) =>
              w.workout_date &&
              w.workout_date >= weekStart &&
              w.workout_date < shiftDay(weekStart, 7),
          ).length}{' '}
        {t('common.times')} · {t('quiet.goal')} {preferences.weeklyGoal} {t('common.times')}
      </p>
      <div className="card-heading">
        <div>
          <h2>{t(saved ? 'simple.checkedIn' : 'simple.checkinTitle')}</h2>
        </div>
      </div>
      {!saved ? (
        <>
          <div className="part-options date-options">
            {[today, shiftDay(today, -1)].map((d, i) => (
              <Button
                key={d}
                variant="secondary"
                aria-pressed={date === d && !customDate}
                disabled={busy || !!attempt.current}
                onClick={() => {
                  setDate(d);
                  setCustomDate(false);
                }}
              >
                {t(i === 0 ? 'simple.today' : 'simple.yesterday')}
              </Button>
            ))}
            <Button
              variant="ghost"
              disabled={busy || !!attempt.current}
              aria-pressed={customDate}
              onClick={() => setCustomDate(true)}
            >
              {t('simple.chooseDate')}
            </Button>
            {customDate && (
              <label className="field">
                <span className="sr-only">{t('simple.chooseDate')}</span>
                <input
                  type="date"
                  value={date}
                  max={today}
                  disabled={busy || !!attempt.current}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
            )}
          </div>
          <div className="checkin-options">
            {(allParts ? order : order.slice(0, 4)).map((part) => (
              <button
                type="button"
                key={part}
                className="checkin-option"
                disabled={
                  !ready || busy || !date || (!!attempt.current && attempt.current.part !== part)
                }
                onClick={() => void checkin(part)}
              >
                <span>{t(`fitness.${part as (typeof trainingParts)[number]}`)}</span>
                <ArrowUpRight size={17} aria-hidden="true" />
              </button>
            ))}
          </div>
          {order.length > 4 && (
            <Button variant="ghost" aria-expanded={allParts} onClick={() => setAllParts(!allParts)}>
              {t(allParts ? 'quiet.back' : 'quiet.allParts')}
            </Button>
          )}
        </>
      ) : (
        <div className="checkin-result" role="status">
          <Check size={26} />
          <div>
            <strong>{saved.title}</strong>
            <p className="muted small">
              {saved.workout_date} · {t('common.private')}
            </p>
          </div>
          <div className="form-actions">
            <Button onClick={() => setEditing(true)}>{t('simple.supplement')}</Button>
            <Button variant="ghost" disabled={busy} onClick={() => void undo()}>
              {t('simple.undo')}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setSaved(null);
                setError('');
              }}
            >
              {t('simple.another')}
            </Button>
          </div>
        </div>
      )}
      {busy && (
        <p role="status" className="muted small">
          {t('common.saving')}
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}{' '}
          <Button
            variant="ghost"
            onClick={() => (attempt.current ? void checkin(attempt.current.part) : void undo())}
          >
            {t('record.retry')}
          </Button>
        </p>
      )}
      {editing && saved && (
        <Dialog
          open
          title={t('simple.supplement')}
          locale={locale}
          wide
          onOpenChange={(v) => {
            if (!v && (!dirty || confirm(t('common.unsaved')))) {
              setEditing(false);
              location.assign('/fitness');
            }
          }}
        >
          <Suspense fallback={<p>{t('common.loading')}</p>}>
            <WorkoutEditor
              initial={saved}
              locale={locale}
              preferences={preferences}
              onDirtyChange={setDirty}
              onClose={() => {
                setEditing(false);
                location.assign('/fitness');
              }}
            />
          </Suspense>
        </Dialog>
      )}
    </section>
  );
}
