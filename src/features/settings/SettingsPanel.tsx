import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { ArrowUp, ArrowDown, Download, Upload, LogOut, Check } from 'lucide-react';
import type { Locale, Preferences, Widget } from '../../types/domain';
import { translator } from '../../lib/i18n';
import { api, errorText } from '../../lib/api';
import { preferencesSchema } from '../../lib/schemas';
import { Button } from '../../components/ui/button';
import { useUnsaved } from '../../lib/use-unsaved';
import { SettingsSaveQueue, type SettingsPatch } from '../../lib/settings-patch';
interface BackupFile {
  fitness: {
    sessions: Record<string, unknown>[];
    templates: Record<string, unknown>[];
    favorites: string[];
  };
  travel: { entries: Record<string, unknown>[]; wishlist: Record<string, unknown>[] };
  settings: { preferences: Preferences; widgets: Widget[] };
}
interface Preview {
  sessions: { new: number; skip: number };
  templates: { new: number; skip: number };
  trips: { new: number; skip: number };
  wishlist: { new: number; skip: number };
  favorites: number;
}
function applyLocal(p: Preferences) {
  try {
    localStorage.setItem('fubao.preferences', JSON.stringify(p));
  } catch {}
  document.cookie = `fubao.locale=${p.language}; Path=/; Max-Age=31536000; SameSite=Lax`;
  document.cookie = `fubao.display=${encodeURIComponent(JSON.stringify({ theme: p.theme, weightUnit: p.weightUnit, distanceUnit: p.distanceUnit, weekStart: p.weekStart, mapStyle: p.mapStyle }))}; Path=/; Max-Age=31536000; SameSite=Lax`;
  document.documentElement.dataset.preferredTheme = p.theme;
  document.documentElement.dataset.theme =
    p.theme === 'dark' ||
    (p.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
      ? 'dark'
      : 'light';
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute(
      'content',
      document.documentElement.dataset.theme === 'dark' ? '#151618' : '#f6f7f8',
    );
}
export default function SettingsPanel({
  locale,
  initial,
  initialWidgets,
  owner,
}: {
  locale: Locale;
  initial: Preferences;
  initialWidgets: Widget[];
  owner: boolean;
}) {
  const t = translator(locale),
    [preferences, setPreferences] = useState(initial),
    [widgets, setWidgets] = useState(initialWidgets),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [dirty, setDirty] = useState(false),
    [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle'),
    [saveError, setSaveError] = useState(''),
    [timezoneInput, setTimezoneInput] = useState(initial.timezone),
    [dragging, setDragging] = useState<string | null>(null);
  const [backup, setBackup] = useState<BackupFile | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [restoreSettings, setRestoreSettings] = useState(false),
    [progress, setProgress] = useState(''),
    [results, setResults] = useState<{ id: string; status: string }[]>([]);
  const allowNavigation = useUnsaved(dirty);
  useEffect(() => {
    if (!owner) {
      try {
        const parsed = preferencesSchema.safeParse({
          ...initial,
          ...JSON.parse(localStorage.getItem('fubao.preferences') ?? '{}'),
        });
        if (parsed.success) {
          setPreferences(parsed.data);
          latest.current = parsed.data;
        }
      } catch {}
    }
  }, [owner]);
  const latest = useRef(preferences);
  const queue = useRef<SettingsSaveQueue | null>(null);
  if (!queue.current)
    queue.current = new SettingsSaveQueue(
      async (patch) => {
        await api('/api/settings', { method: 'PATCH', body: patch });
      },
      (state, failure) => {
        setSaveState(state);
        setSaveError(failure ? errorText(failure, locale) : '');
        setDirty(state !== 'saved');
      },
      () => {
        applyLocal(latest.current);
        if (latest.current.language !== locale) {
          allowNavigation();
          location.reload();
        }
      },
    );
  function persist(patch: SettingsPatch) {
    if (owner) {
      setDirty(true);
      queue.current!.enqueue(patch);
    } else {
      applyLocal(latest.current);
      setSaveState('saved');
      if (latest.current.language !== locale) {
        allowNavigation();
        location.reload();
      }
    }
  }
  const update = (patch: SettingsPatch['preferences']) => {
    if (
      Object.entries(patch ?? {}).every(
        ([key, value]) => latest.current[key as keyof Preferences] === value,
      )
    )
      return;
    const next = { ...latest.current, ...patch };
    if (!preferencesSchema.safeParse(next).success) return;
    latest.current = next;
    setPreferences(next);
    if (patch?.theme) {
      document.documentElement.dataset.preferredTheme = patch.theme;
      document.documentElement.dataset.theme =
        patch.theme === 'dark' ||
        (patch.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
          ? 'dark'
          : 'light';
    }
    persist({ preferences: patch });
  };
  function changeWidget(key: Widget['key'], patch: Partial<Pick<Widget, 'visible' | 'size'>>) {
    setWidgets((previous) => previous.map((w) => (w.key === key ? { ...w, ...patch } : w)));
    persist({ widgets: [{ key, ...patch }] });
  }
  function reorder(from: number, to: number) {
    if (to < 0 || to >= widgets.length) return;
    const next = [...widgets],
      item = next.splice(from, 1)[0];
    next.splice(to, 0, item);
    setWidgets(next.map((w, i) => ({ ...w, order: i })));
    persist({ order: next.map((w) => w.key) });
  }
  async function logout() {
    setPending(true);
    try {
      await api('/api/auth/logout', { method: 'POST', body: {} });
      location.assign('/');
    } catch (e) {
      setError(errorText(e, locale));
      setPending(false);
    }
  }
  async function password(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setPending(true);
    setError('');
    try {
      await api('/api/auth/password', {
        method: 'POST',
        body: {
          currentPassword: data.get('currentPassword'),
          newPassword: data.get('newPassword'),
        },
      });
      location.assign('/login');
    } catch (e) {
      setError(errorText(e, locale));
      setPending(false);
    }
  }
  async function previewFile(file: File) {
    setError('');
    setPreview(null);
    setBackup(null);
    setResults([]);
    if (file.size > 20 * 1024 * 1024) {
      setError(t('error.INVALID_BACKUP'));
      return;
    }
    setPending(true);
    try {
      const parsed = JSON.parse(await file.text());
      const result = await api<Preview>('/api/data/preview', { method: 'POST', body: parsed });
      setBackup(parsed);
      setPreview(result);
    } catch (e) {
      setError(errorText(e, locale));
    } finally {
      setPending(false);
    }
  }
  async function runImport() {
    if (!backup || !confirm(t('settings.importConfirm'))) return;
    setPending(true);
    setError('');
    const entries = [
      ...backup.fitness.sessions.map((value) => ({ kind: 'session', value })),
      ...backup.fitness.templates.map((value) => ({ kind: 'template', value })),
      ...backup.travel.entries.map((value) => ({ kind: 'trip', value })),
      ...backup.travel.wishlist.map((value) => ({ kind: 'wishlist', value })),
      ...backup.fitness.favorites.map((value) => ({ kind: 'favorite', value })),
    ];
    const outcomes: { id: string; status: string }[] = [];
    for (let i = 0; i < entries.length; i++) {
      setProgress(`${i + 1} / ${entries.length}`);
      const item = entries[i],
        id = typeof item.value === 'string' ? item.value : String(item.value.id);
      try {
        const result = await api<{ status: string }>('/api/data/import', {
          method: 'POST',
          body: item,
        });
        outcomes.push({ id, status: result.status });
      } catch (e) {
        outcomes.push({ id, status: errorText(e, locale) });
      }
      setResults([...outcomes]);
    }
    if (restoreSettings) {
      try {
        await api('/api/settings', { method: 'PUT', body: backup.settings });
        latest.current = backup.settings.preferences;
        setPreferences(backup.settings.preferences);
        setTimezoneInput(backup.settings.preferences.timezone);
        setWidgets(backup.settings.widgets);
        applyLocal(backup.settings.preferences);
      } catch (e) {
        setError(errorText(e, locale));
      }
    }
    setProgress('');
    setPending(false);
    setMessage(t('common.saved'));
  }
  return (
    <div className="settings-layout">
      {!owner && (
        <p className="muted small" style={{ marginBottom: 28 }}>
          {t('settings.localHint')}
        </p>
      )}
      <div className="settings-save-status" aria-live="polite" role="status">
        {saveState === 'saving' && t('common.saving')}
        {saveState === 'saved' && (
          <>
            <Check size={14} />
            {t('common.saved')}
          </>
        )}
        {saveState === 'error' && (
          <span className="error">
            {saveError}{' '}
            <Button variant="ghost" onClick={() => void queue.current!.flush()}>
              {t('common.retry')}
            </Button>
          </span>
        )}
      </div>
      <section className="settings-section settings-primary">
        <div className="setting-row">
          <span>{t('settings.appearance')}</span>
          <div className="segmented">
            {(['light', 'dark', 'system'] as const).map((v) => (
              <button
                type="button"
                key={v}
                aria-pressed={preferences.theme === v}
                className={preferences.theme === v ? 'active' : ''}
                onClick={() => update({ theme: v })}
              >
                {t(('settings.' + v) as 'settings.light')}
              </button>
            ))}
          </div>
        </div>
        <label className="setting-row">
          <span>{t('settings.language')}</span>
          <select
            aria-label={t('settings.language')}
            value={preferences.language}
            onChange={(e) => update({ language: e.target.value as Locale })}
          >
            <option value="zh-CN">简体中文</option>
            <option value="en-US">English</option>
          </select>
        </label>
      </section>
      <details className="settings-group">
        <summary>
          <span>{t('quiet.general')}</span>
          <small>
            {preferences.weightUnit} · {preferences.distanceUnit} ·{' '}
            {t(preferences.weekStart ? 'settings.monday' : 'settings.sunday')}
          </small>
        </summary>
        <div className="settings-section">
          <label className="setting-row">
            <span>{t('fitness.weight')}</span>
            <select
              aria-label={t('fitness.weight')}
              value={preferences.weightUnit}
              onChange={(e) => update({ weightUnit: e.target.value as 'kg' | 'lb' })}
            >
              <option value="kg">kg</option>
              <option value="lb">lb</option>
            </select>
          </label>
          <label className="setting-row">
            <span>{t('fitness.distance')}</span>
            <select
              aria-label={t('fitness.distance')}
              value={preferences.distanceUnit}
              onChange={(e) => update({ distanceUnit: e.target.value as 'km' | 'mile' })}
            >
              <option value="km">km</option>
              <option value="mile">mile</option>
            </select>
          </label>
          <label className="setting-row">
            <span>{t('settings.weekStart')}</span>
            <select
              aria-label={t('settings.weekStart')}
              value={preferences.weekStart}
              onChange={(e) => update({ weekStart: Number(e.target.value) as 0 | 1 })}
            >
              <option value={1}>{t('settings.monday')}</option>
              <option value={0}>{t('settings.sunday')}</option>
            </select>
          </label>
          {owner && (
            <label className="field">
              <span>{t('settings.timezone')}</span>
              <input
                value={timezoneInput}
                list="timezones"
                onChange={(e) => {
                  setTimezoneInput(e.target.value);
                  if (preferencesSchema.shape.timezone.safeParse(e.target.value).success)
                    update({ timezone: e.target.value });
                }}
                onBlur={() => setTimezoneInput(latest.current.timezone)}
              />
              <datalist id="timezones">
                {['UTC', ...Intl.supportedValuesOf('timeZone')].map((zone) => (
                  <option value={zone} key={zone} />
                ))}
              </datalist>
            </label>
          )}
        </div>
      </details>
      {owner && (
        <>
          <details className="settings-group">
            <summary>
              <span>{t('settings.goal')}</span>
              <small>
                {preferences.weeklyGoal} {t('common.times')}
              </small>
            </summary>
            <div className="settings-section">
              <label className="setting-row">
                <span>{t('settings.goal')}</span>
                <select
                  aria-label={t('settings.goal')}
                  value={preferences.weeklyGoal}
                  onChange={(e) => update({ weeklyGoal: Number(e.target.value) })}
                >
                  {Array.from({ length: 21 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n} {t('common.times')}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </details>
          <details className="settings-group">
            <summary>
              <span>{t('settings.dashboard')}</span>
              <small>
                {widgets.filter((w) => w.visible).length} / {widgets.length}
              </small>
            </summary>
            <div className="settings-section">
              {widgets.map((w, i) => (
                <div
                  key={w.key}
                  className="widget-setting"
                  draggable
                  onDragStart={() => setDragging(w.key)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    const from = widgets.findIndex((x) => x.key === dragging);
                    if (from >= 0) reorder(from, i);
                    setDragging(null);
                  }}
                >
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={w.visible}
                      onChange={(e) => changeWidget(w.key, { visible: e.target.checked })}
                    />
                    {t(('dashboard.' + w.key) as 'dashboard.fitness')}
                  </label>
                  <div className="widget-controls">
                    <select
                      aria-label={
                        t(('dashboard.' + w.key) as 'dashboard.fitness') + ' ' + t('settings.size')
                      }
                      value={w.size}
                      onChange={(e) =>
                        changeWidget(w.key, { size: e.target.value as Widget['size'] })
                      }
                    >
                      {(['small', 'medium', 'large'] as const).map((v) => (
                        <option key={v} value={v}>
                          {t(('settings.' + v) as 'settings.small')}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={i === 0}
                      aria-label={
                        t('common.up') + ' ' + t(('dashboard.' + w.key) as 'dashboard.fitness')
                      }
                      onClick={() => reorder(i, i - 1)}
                    >
                      <ArrowUp size={16} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={i === widgets.length - 1}
                      aria-label={
                        t('common.down') + ' ' + t(('dashboard.' + w.key) as 'dashboard.fitness')
                      }
                      onClick={() => reorder(i, i + 1)}
                    >
                      <ArrowDown size={16} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </details>
        </>
      )}
      <div aria-live="polite">
        {message && (
          <p className="form-message">
            <Check size={14} style={{ display: 'inline' }} /> {message}
          </p>
        )}
        {error && (
          <p className="form-message error" role="alert">
            {error}
          </p>
        )}
      </div>
      {owner && (
        <>
          <details className="settings-group">
            <summary>{t('settings.data')}</summary>
            <section className="settings-section">
              <p className="small muted">{t('settings.backupHint')}</p>
              <div className="data-actions">
                <a className="button button-secondary" href="/api/data/export" download>
                  <Download size={16} />
                  {t('settings.export')}
                </a>
                <label className="button button-secondary import-button">
                  <Upload size={16} />
                  {t('settings.import')}
                  <input
                    type="file"
                    accept="application/json,.json"
                    disabled={pending || dirty}
                    onChange={(e) => {
                      if (e.target.files?.[0]) previewFile(e.target.files[0]);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
              {preview && (
                <div className="import-preview">
                  <h3>{t('settings.preview')}</h3>
                  <p className="small muted">{t('settings.importHint')}</p>
                  <dl className="import-counts">
                    {(
                      [
                        ['sessions', 'fitness.history'],
                        ['templates', 'fitness.templates'],
                        ['trips', 'travel.timeline'],
                        ['wishlist', 'travel.wishlist'],
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key}>
                        <dt>{t(label)}</dt>
                        <dd>
                          +{preview[key].new} / {locale === 'zh-CN' ? '跳过' : 'skip'}{' '}
                          {preview[key].skip}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={restoreSettings}
                      onChange={(e) => setRestoreSettings(e.target.checked)}
                    />
                    {t('settings.restoreSettings')}
                  </label>
                  <Button disabled={pending || dirty} onClick={runImport}>
                    {pending ? progress || t('common.loading') : t('settings.importConfirm')}
                  </Button>
                </div>
              )}
              {results.length > 0 && (
                <details className="import-results">
                  <summary>
                    {t('settings.importResult')} ({results.length})
                  </summary>
                  {results.map((r, i) => (
                    <p className="small" key={i}>
                      {r.id}:{' '}
                      {r.status === 'imported'
                        ? t('common.saved')
                        : r.status === 'skipped'
                          ? locale === 'zh-CN'
                            ? '已跳过'
                            : 'Skipped'
                          : r.status}
                    </p>
                  ))}
                </details>
              )}
            </section>
          </details>
          <details className="settings-group">
            <summary>{t('settings.account')}</summary>
            <section className="settings-section">
              <form className="form" onSubmit={password}>
                <div className="form-row">
                  <label className="field">
                    <span>{t('settings.currentPassword')}</span>
                    <input
                      type="password"
                      name="currentPassword"
                      autoComplete="current-password"
                      required
                      maxLength={256}
                    />
                  </label>
                  <label className="field">
                    <span>{t('settings.newPassword')}</span>
                    <input
                      type="password"
                      name="newPassword"
                      autoComplete="new-password"
                      required
                      minLength={5}
                      maxLength={256}
                    />
                  </label>
                </div>
                <div className="form-actions">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={logout}
                    disabled={pending || dirty}
                  >
                    <LogOut size={15} />
                    {t('auth.logout')}
                  </Button>
                  <Button type="submit" variant="secondary" disabled={pending || dirty}>
                    {t('settings.password')}
                  </Button>
                </div>
              </form>
            </section>
          </details>
        </>
      )}
      <section className="settings-section">
        <h2>{t('settings.about')}</h2>
        <p className="small muted">Fubao · 0.1.0</p>
        <a href="/about" className="text-link">
          {t('settings.sources')}
        </a>
        {!owner && (
          <p>
            <a href="/login" className="text-link">
              {t('auth.login')}
            </a>
          </p>
        )}
      </section>
    </div>
  );
}
