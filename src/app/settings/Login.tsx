import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { Screen, Press } from '../core/ui';
import { useApp } from '../core/app-state';
import { useRouter } from '../core/router';
import { t, errorMessage } from '../core/i18n';
import { api } from '../../lib/api';
import type { Preferences, User } from '../../types/domain';

export function Login() {
  const { setUser, replacePrefs, toast, owner } = useApp();
  const { navigate } = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  if (owner) queueMicrotask(() => navigate('/', { root: true, replace: true }));

  async function submit(e: { preventDefault: () => void }) {
    e.preventDefault();
    if (!username || !password) return;
    setBusy(true);
    try {
      const { user } = await api<{ user: User }>('/api/auth/login', {
        method: 'POST',
        body: { username, password },
      });
      const { preferences } = await api<{ preferences: Preferences }>('/api/settings');
      replacePrefs(preferences);
      setUser(user);
      toast(t(`欢迎回来，${user.username}`, `Welcome back, ${user.username}`));
      navigate('/', { root: true, replace: true });
    } catch (error) {
      setShake((n) => n + 1);
      toast(errorMessage(error), 'error');
      setBusy(false);
    }
  }
  return (
    <Screen title={t('登录', 'Sign in')} large={false} tabbar={false} backFallback="/">
      <div className="login">
        <motion.div
          className="login-orb"
          animate={{ rotate: 360 }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
        />
        <motion.img
          src="/brand-cat.png"
          alt=""
          className="login-logo"
          initial={{ scale: 0.6, opacity: 0, rotate: -10 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        />
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          Fubao
        </motion.h1>
        <motion.p
          className="muted"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.18 }}
        >
          {t('记录训练，收藏旅行。', 'Train. Travel. Remember.')}
        </motion.p>
        <motion.form
          key={shake}
          onSubmit={submit}
          className="login-form"
          initial={shake ? { x: 0 } : { opacity: 0, y: 16 }}
          animate={shake ? { x: [0, -12, 10, -6, 4, 0] } : { opacity: 1, y: 0 }}
          transition={
            shake ? { duration: 0.4 } : { delay: 0.22, duration: 0.5, ease: [0.16, 1, 0.3, 1] }
          }
        >
          <input
            className="input"
            autoComplete="username"
            autoCapitalize="none"
            placeholder={t('用户名', 'Username')}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            placeholder={t('密码', 'Password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Press
            type="submit"
            className="btn btn-primary block lg"
            disabled={busy || !username || !password}
          >
            {busy ? <span className="spinner" /> : t('登录', 'Sign in')}
            {!busy && <ArrowRight />}
          </Press>
        </motion.form>
      </div>
    </Screen>
  );
}
