import { useState, type SubmitEvent } from 'react';
import type { Locale } from '../../types/domain';
import { translator } from '../../lib/i18n';
import { api, errorText } from '../../lib/api';
import { Button } from '../../components/ui/button';
export default function Login({ locale }: { locale: Locale }) {
  const t = translator(locale),
    [pending, setPending] = useState(false),
    [error, setError] = useState('');
  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError('');
    const data = new FormData(e.currentTarget);
    try {
      await api('/api/auth/login', {
        method: 'POST',
        body: { username: data.get('username'), password: data.get('password') },
      });
      location.assign('/');
    } catch (error) {
      setError(errorText(error, locale));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="card login-card">
      <span className="eyebrow">FUBAO / PERSONAL SPACE</span>
      <h1>{t('auth.title')}</h1>
      <p className="muted small">{t('auth.subtitle')}</p>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>{t('auth.username')}</span>
          <input name="username" autoComplete="username" required maxLength={80} />
        </label>
        <label className="field">
          <span>{t('auth.password')}</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={256}
          />
        </label>
        {error && (
          <p className="form-message error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? t('common.loading') : t('auth.submit')}
        </Button>
      </form>
    </div>
  );
}
