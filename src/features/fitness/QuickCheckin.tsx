import { useEffect, useRef, useState } from 'react';
import { Check, Plus, ArrowUpRight } from 'lucide-react';
import { SuccessMark } from '../../components/ui/success-mark';
import { claimGoalFeedback } from '../../lib/feedback';
import { Button } from '../../components/ui/button';
import { translator } from '../../lib/i18n';
import { api, ApiFailure, errorText } from '../../lib/api';
import { knownWorkoutSeconds, shiftDay, workoutDay } from '../../lib/analytics';
import { useUnsaved } from '../../lib/use-unsaved';
import type { Locale, Preferences, Workout } from '../../types/domain';
import type { FitnessDay } from '../../types/fitness-overview';

type Choice = { parts: string[]; duration: number | null };
type Attempt = { path: string; method: string; body?: unknown; choice: Choice };
export default function QuickCheckin({
  locale,
  preferences,
  today,
  order,
  initialDay,
  weekStart,
  feedbackScope,
}: {
  locale: Locale;
  preferences: Preferences;
  today: string;
  order: string[];
  initialDay: FitnessDay;
  weekStart: string;
  feedbackScope: string;
}) {
  const t = translator(locale);
  const [date, setDate] = useState(today),
    [allParts, setAllParts] = useState(false),
    [customDate, setCustomDate] = useState(false);
  const [day, setDay] = useState(initialDay),
    [saved, setSaved] = useState(initialDay.current);
  const initialChoice = {
    parts: initialDay.current?.body_parts ?? [],
    duration: initialDay.current?.duration_seconds ?? null,
  };
  const [choice, setChoice] = useState<Choice>(initialChoice),
    [state, setState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [error, setError] = useState<unknown>(null),
    [hint, setHint] = useState(''),
    [loading, setLoading] = useState(false),
    [ready, setReady] = useState(false),
    [celebrate, setCelebrate] = useState(false);
  const [goalPulse, setGoalPulse] = useState(false);
  const confirmed = useRef(initialDay.current),
    desired = useRef(initialChoice),
    running = useRef(false),
    retry = useRef<Attempt | null>(null),
    failed = useRef(false),
    generation = useRef(0),
    requestNumber = useRef(0);
  const dirty =
    state === 'saving' || (state === 'error' && (retry.current !== null || failed.current));
  useUnsaved(dirty);
  useEffect(() => setReady(true), []);
  useEffect(() => {
    if (day.weekCount >= preferences.weeklyGoal)
      setGoalPulse(claimGoalFeedback(feedbackScope, weekStart));
  }, [day.weekCount, preferences.weeklyGoal, feedbackScope, weekStart]);
  async function readDay(d: string, restore: boolean) {
    const serial = ++requestNumber.current;
    const result = await api<FitnessDay>(`/api/fitness/day?date=${encodeURIComponent(d)}`);
    if (serial !== requestNumber.current) return;
    setDay(result);
    if (restore) {
      confirmed.current = result.current;
      setSaved(result.current);
      desired.current = {
        parts: result.current?.body_parts ?? [],
        duration: result.current?.duration_seconds ?? null,
      };
      setChoice(desired.current);
      setCelebrate(false);
    }
  }
  async function selectDate(d: string) {
    if (!d || running.current || failed.current) return;
    setLoading(true);
    setError(null);
    setHint('');
    try {
      await readDay(d, true);
      setDate(d);
      setState('saved');
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const resume = (event: PageTransitionEvent) => {
      if (event.persisted && !running.current && !failed.current) void selectDate(date);
    };
    window.addEventListener('pageshow', resume);
    return () => window.removeEventListener('pageshow', resume);
  }, [date]);
  async function flush() {
    if (running.current) return;
    if (error instanceof ApiFailure && error.code === 'CONFLICT') return;
    running.current = true;
    if (confirmed.current) setCelebrate(false);
    failed.current = false;
    setState('saving');
    setError(null);
    try {
      while (true) {
        const target = desired.current,
          previous = confirmed.current;
        if (
          !retry.current &&
          previous &&
          JSON.stringify(previous.body_parts) === JSON.stringify(target.parts) &&
          (previous.duration_seconds ?? null) === target.duration
        )
          break;
        if (!retry.current) {
          retry.current = previous
            ? {
                path: `/api/fitness/sessions/${previous.id}`,
                method: 'PATCH',
                choice: structuredClone(target),
                body: {
                  revision: previous.revision,
                  mutation_id: crypto.randomUUID(),
                  body_parts: target.parts,
                  ...(previous.time_precision === 'date'
                    ? { duration_seconds: target.duration }
                    : {}),
                },
              }
            : {
                path: '/api/fitness/checkin',
                method: 'POST',
                choice: { parts: [target.parts[0]], duration: null },
                body: {
                  id: crypto.randomUUID(),
                  mutation_id: crypto.randomUUID(),
                  date,
                  part: target.parts[0],
                },
              };
        }
        const attempt = retry.current;
        const result = await api<Workout>(attempt.path, {
          method: attempt.method,
          body: attempt.body,
        });
        confirmed.current = result;
        setSaved(result);
        retry.current = null;
        if (!previous) setCelebrate(true);
      }
      setState('saved');
      // Update visible receipts immediately, then reconcile counts and list against D1.
      if (confirmed.current)
        setDay((d) => ({
          ...d,
          recent: [
            confirmed.current!,
            ...d.recent.filter((w) => w.id !== confirmed.current!.id),
          ].slice(0, 5),
        }));
    } catch (e) {
      failed.current = true;
      setError(e);
      setState('error');
    } finally {
      running.current = false;
    }
    if (!failed.current) {
      const gen = generation.current;
      try {
        await readDay(date, false);
      } catch (e) {
        if (gen === generation.current) setError(e);
      }
    }
  }
  function choose(next: Choice) {
    desired.current = next;
    setChoice(next);
    generation.current++;
    setHint('');
    if (!failed.current) void flush();
  }
  async function undo() {
    if (!confirmed.current || dirty || !confirm(t('common.confirmDelete'))) return;
    const id = confirmed.current.id;
    setLoading(true);
    setError(null);
    try {
      await api(`/api/fitness/sessions/${id}`, { method: 'DELETE' });
      await readDay(date, true);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }
  const visibleParts = allParts ? order : order.filter((p, i) => i < 4 || choice.parts.includes(p));
  return (
    <>
      <section className="quick-checkin" id="checkin" aria-label={t('fitness.quick')}>
        <div className="checkin-heading">
          <h2>{t(saved ? 'simple.checkedIn' : 'simple.checkinTitle')}</h2>
          <span className="small muted">
            {t('dashboard.week')} {day.weekCount} · {t('quiet.goal')} {preferences.weeklyGoal}
          </span>
        </div>
        <div className="part-options date-options">
          {[today, shiftDay(today, -1)].map((d, i) => (
            <Button
              key={d}
              variant="secondary"
              aria-pressed={date === d && !customDate}
              disabled={dirty || loading}
              onClick={() => {
                setCustomDate(false);
                void selectDate(d);
              }}
            >
              {t(i === 0 ? 'simple.today' : 'simple.yesterday')}
            </Button>
          ))}
          <Button
            variant="ghost"
            disabled={dirty || loading}
            aria-pressed={customDate}
            onClick={() => setCustomDate(!customDate)}
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
                disabled={dirty || loading}
                onChange={(e) => void selectDate(e.target.value)}
              />
            </label>
          )}
        </div>
        <div className="checkin-options" aria-busy={state === 'saving' || loading}>
          {visibleParts.map((part) => {
            const selected = choice.parts.includes(part);
            return (
              <button
                type="button"
                key={part}
                className={`checkin-option ${selected ? 'selected' : ''}`}
                aria-pressed={selected}
                disabled={!ready || loading}
                onClick={(event) => {
                  if (event.detail > 1) return;
                  if (selected && choice.parts.length === 1) {
                    setHint(t('flow.lastItem'));
                    return;
                  }
                  choose({
                    ...desired.current,
                    parts: selected
                      ? desired.current.parts.filter((p) => p !== part)
                      : [...desired.current.parts, part],
                  });
                }}
              >
                <span>{t(`fitness.${part}` as 'fitness.back')}</span>
                <span className="choice-mark">
                  {selected ? (
                    <Check size={17} aria-hidden="true" />
                  ) : (
                    <Plus size={16} aria-hidden="true" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
        {order.length > 4 && (
          <Button variant="ghost" aria-expanded={allParts} onClick={() => setAllParts(!allParts)}>
            {t(allParts ? 'quiet.back' : 'quiet.allParts')}
          </Button>
        )}
        {(saved || dirty) && (
          <div className="checkin-result">
            <span className="checkin-save small" role="status">
              {state === 'saved' && <SuccessMark animate={celebrate} />}
              {t(
                state === 'saved'
                  ? 'common.saved'
                  : state === 'saving'
                    ? 'common.saving'
                    : 'flow.saveFailed',
              )}
            </span>
            {saved && (
              <>
                <a
                  className="button button-primary"
                  aria-disabled={dirty || loading}
                  onClick={(e) => {
                    if (dirty || loading) e.preventDefault();
                  }}
                  href={dirty || loading ? undefined : `/fitness/${saved.id}?edit=1&add=1`}
                  tabIndex={dirty || loading ? -1 : undefined}
                >
                  <Plus size={16} />
                  {t('fitness.addExercise')}
                </a>
                <details className="checkin-more">
                  <summary>{t('simple.more')}</summary>
                  <div className="checkin-more-content">
                    {saved.time_precision === 'date' && (
                      <div className="part-options" aria-label={t('fitness.duration')}>
                        {[null, 15, 30, 45, 60, 90].map((minutes) => (
                          <Button
                            key={minutes ?? 'none'}
                            variant="secondary"
                            aria-pressed={
                              choice.duration === (minutes === null ? null : minutes * 60)
                            }
                            disabled={loading}
                            onClick={() =>
                              choose({
                                ...desired.current,
                                duration: minutes === null ? null : minutes * 60,
                              })
                            }
                          >
                            {minutes === null
                              ? t('simple.notRecorded')
                              : `${minutes} ${t('common.minutes')}`}
                          </Button>
                        ))}
                        <label className="field">
                          <span>{t('flow.customMinutes')}</span>
                          <input
                            type="number"
                            min="1"
                            max="10080"
                            inputMode="numeric"
                            value={choice.duration === null ? '' : choice.duration / 60}
                            disabled={loading}
                            onChange={(e) => {
                              const n = e.target.value === '' ? null : Number(e.target.value);
                              if (n === null || (Number.isFinite(n) && n > 0 && n <= 10080))
                                choose({
                                  ...desired.current,
                                  duration: n === null ? null : Math.round(n * 60),
                                });
                            }}
                          />
                        </label>
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      disabled={dirty || loading}
                      onClick={() => {
                        confirmed.current = null;
                        setSaved(null);
                        desired.current = { parts: [], duration: null };
                        setChoice(desired.current);
                        setCelebrate(false);
                        setError(null);
                      }}
                    >
                      {t('simple.another')}
                    </Button>
                    <Button variant="ghost" disabled={dirty || loading} onClick={() => void undo()}>
                      {t('simple.undo')}
                    </Button>
                  </div>
                </details>
              </>
            )}
          </div>
        )}
        {hint && (
          <p className="small muted" role="status">
            {hint}
          </p>
        )}
        {error !== null && (
          <div className="form-message error" role="alert">
            {errorText(error, locale)}{' '}
            {error instanceof ApiFailure && error.code === 'CONFLICT' ? (
              <Button
                variant="ghost"
                onClick={async () => {
                  if (!confirm(t('common.unsaved'))) return;
                  retry.current = null;
                  failed.current = false;
                  setLoading(true);
                  try {
                    await readDay(date, true);
                    setError(null);
                    setState('saved');
                  } catch (e) {
                    setError(e);
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                {t('record.reload')}
              </Button>
            ) : (
              <Button
                variant="ghost"
                disabled={loading}
                onClick={() => {
                  if (failed.current || retry.current) void flush();
                  else void selectDate(date);
                }}
              >
                {t('record.retry')}
              </Button>
            )}
          </div>
        )}
        {day.weekCount >= preferences.weeklyGoal && (
          <span className="goal-badge">
            <SuccessMark animate={goalPulse} />
            {t('dashboard.goalReached')}
          </span>
        )}
      </section>
      <section className="daily-recent">
        <div className="card-heading">
          <h2>{t('simple.recent')}</h2>
          <a className="text-link" href="/fitness?view=history">
            {t('common.all')} →
          </a>
        </div>
        {day.recent.map((w) => (
          <a className="resume-entry" key={w.id} href={`/fitness/${w.id}`}>
            <span>
              <strong>{w.title}</strong>
              <span className="small muted"> · {workoutDay(w, preferences.timezone)}</span>
            </span>
            <span className="small muted">
              {knownWorkoutSeconds(w) !== null
                ? `${Math.round(knownWorkoutSeconds(w)! / 60)} ${t('common.minutes')}`
                : ''}
              <ArrowUpRight size={16} />
            </span>
          </a>
        ))}
        {!day.recent.length && <p className="muted">{t('dashboard.noWorkout')}</p>}
      </section>
    </>
  );
}
