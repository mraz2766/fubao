import { lazy, Suspense, useEffect, useRef, useState, Component, type ReactNode } from 'react';
import { Dialog } from '../ui/dialog';
import StoryIcon from '../illustrations/StoryIcon';
import { queueSaveFeedback } from '../../lib/feedback';
import { api, errorText } from '../../lib/api';
import { translator } from '../../lib/i18n';
import { dayKey } from '../../lib/analytics';
import { zonedISO } from '../../lib/fitness-recording';
import type { Locale, Preferences, Trip, Workout } from '../../types/domain';
const WorkoutEditor = lazy(() => import('../../features/fitness/WorkoutEditor'));
const TravelEditor = lazy(() => import('../../features/travel/TravelEditor'));
type Entry = { kind: 'workout' | 'travel'; id?: string };
class EditorBoundary extends Component<
  { children: ReactNode; message: string },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div role="alert">
        <p>{this.props.message}</p>
        <button className="button button-secondary" onClick={() => location.reload()}>
          ↻ {document.documentElement.lang.startsWith('zh') ? '重新加载' : 'Reload'}
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function AppComposer({
  locale,
  preferences,
  owner,
}: {
  locale: Locale;
  preferences: Preferences;
  owner: boolean;
}) {
  const t = translator(locale),
    zh = locale === 'zh-CN';
  const [entry, setEntry] = useState<Entry | 'choose' | null>(null);
  const [initial, setInitial] = useState<Workout | Trip | null>(null);
  const [error, setError] = useState('');
  const dirty = useRef(false),
    busy = useRef(false),
    generation = useRef(0);
  const trigger = useRef<HTMLElement | null>(null);
  const markDirty = (value: boolean) => {
    dirty.current = value;
  };
  function close() {
    if (busy.current || (dirty.current && !confirm(t('common.unsaved')))) return;
    generation.current++;
    dirty.current = false;
    setEntry(null);
    setInitial(null);
    const url = new URL(location.href);
    url.searchParams.delete('compose');
    url.searchParams.delete('edit');
    history.replaceState(history.state, '', url);
    requestAnimationFrame(() => trigger.current?.focus());
  }
  function saved(record: Workout | Trip) {
    if (entry && entry !== 'choose') queueSaveFeedback(entry.kind, record.id, location.pathname);
    dirty.current = false;
    const url = new URL(location.href);
    url.searchParams.delete('compose');
    url.searchParams.delete('edit');
    history.replaceState(history.state, '', url);
    location.reload();
  }
  async function launch(next: Entry | 'choose') {
    if (!owner) {
      location.assign('/login');
      return;
    }
    if (dirty.current && !confirm(t('common.unsaved'))) return;
    dirty.current = false;
    setError('');
    setInitial(null);
    setEntry(next);
    const version = ++generation.current;
    if (next === 'choose') return;
    if (next.id) {
      try {
        const result = await api<Workout | Trip>(
          `/api/${next.kind === 'workout' ? 'fitness/sessions' : 'travel/entries'}/${next.id}`,
        );
        if (generation.current === version) setInitial(result);
      } catch (e) {
        if (generation.current === version) setError(errorText(e, locale));
      }
    } else if (next.kind === 'workout') {
      const today = dayKey(new Date(), preferences.timezone);
      setInitial({
        id: crypto.randomUUID(),
        mutation_id: crypto.randomUUID(),
        user_id: '',
        title: t('record.defaultTitle'),
        mode: 'quick',
        status: 'draft',
        body_parts: [],
        workout_date: today,
        time_precision: 'date',
        duration_seconds: null,
        start_at: zonedISO(today + 'T12:00', preferences.timezone),
        end_at: null,
        timezone: preferences.timezone,
        note: '',
        visibility: 'private',
        exercises: [],
        updated_at: '',
      });
    }
  }
  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      )
        return;
      const target = (event.target as Element)?.closest<HTMLElement>('[data-compose], a[href]');
      if (!target) return;
      let next: Entry | 'choose' | null = target.dataset.compose === 'choose' ? 'choose' : null;
      if (
        target instanceof HTMLAnchorElement &&
        target.origin === location.origin &&
        !target.target &&
        !target.hasAttribute('download')
      ) {
        const match = target.pathname.match(/^\/(fitness|travel)\/(new|([^/]+)\/edit)\/?$/);
        // A scenic spot link carries a location suggestion; preserve its query through the fallback route.
        if (match && !target.search)
          next = { kind: match[1] === 'fitness' ? 'workout' : 'travel', id: match[3] };
      }
      if (next) {
        event.preventDefault();
        trigger.current = target;
        void launch(next);
      }
    };
    document.addEventListener('click', click);
    const params = new URLSearchParams(location.search),
      kind = params.get('compose');
    if (kind === 'workout' || kind === 'travel')
      void launch({ kind, id: params.get('edit') ?? undefined });
    return () => {
      document.removeEventListener('click', click);
      generation.current++;
    };
  }, []);
  const title =
    entry === 'choose'
      ? zh
        ? '记下这一刻'
        : 'Make a memory'
      : entry?.id
        ? t('common.edit')
        : entry?.kind === 'workout'
          ? t('ia.newWorkout')
          : t('ia.newTrip');
  return (
    <Dialog
      open={!!entry}
      onOpenChange={(open) => !open && close()}
      title={title}
      locale={locale}
      wide={entry !== 'choose'}
    >
      {entry === 'choose' ? (
        <div className="create-choices">
          <button onClick={() => void launch({ kind: 'workout' })}>
            <StoryIcon kind="fitness" size={34} />
            <span>
              {zh ? '记录训练' : 'Record workout'}
              <small>{zh ? '今天，也为自己动一动' : 'A little movement for today'}</small>
            </span>
            <span aria-hidden="true">›</span>
          </button>
          <button onClick={() => void launch({ kind: 'travel' })}>
            <StoryIcon kind="travel" size={34} />
            <span>
              {zh ? '新增旅行' : 'Add a trip'}
              <small>{zh ? '留住照片，记下沿途' : 'Keep the places and little moments'}</small>
            </span>
            <span aria-hidden="true">›</span>
          </button>
        </div>
      ) : (
        entry && (
          <div className="app-composer">
            {error ? (
              <div role="alert">
                <p>{error}</p>
                <button className="button" onClick={() => void launch(entry)}>
                  {t('common.retry')}
                </button>
              </div>
            ) : (
              <EditorBoundary
                key={`${entry.kind}-${entry.id ?? 'new'}`}
                message={
                  zh ? '暂时无法加载，请重新加载后再试。' : 'Unable to load. Reload and try again.'
                }
              >
                <Suspense fallback={<p role="status">{t('common.loading')}</p>}>
                  {entry.kind === 'workout' ? (
                    initial ? (
                      <WorkoutEditor
                        locale={locale}
                        preferences={preferences}
                        initial={initial as Workout}
                        fresh={!entry.id}
                        manual
                        onDirtyChange={markDirty}
                        onPendingChange={(v) => {
                          busy.current = v;
                        }}
                        onClose={() => {
                          dirty.current = false;
                          close();
                        }}
                        onSaved={saved}
                      />
                    ) : (
                      <p role="status">{t('common.loading')}</p>
                    )
                  ) : !entry.id || initial ? (
                    <TravelEditor
                      locale={locale}
                      initial={(initial ?? undefined) as Trip | undefined}
                      inline
                      onDirtyChange={markDirty}
                      onPendingChange={(v) => {
                        busy.current = v;
                      }}
                      onClose={() => {
                        dirty.current = false;
                        close();
                      }}
                      onSaved={saved}
                    />
                  ) : (
                    <p role="status">{t('common.loading')}</p>
                  )}
                </Suspense>
              </EditorBoundary>
            )}
          </div>
        )
      )}
    </Dialog>
  );
}
