import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Dumbbell, Lock, Plane } from 'lucide-react';
import { Press, Segmented } from '../core/ui';
import { useApp } from '../core/app-state';
import { t, errorMessage } from '../core/i18n';
import { api } from '../../lib/api';
import type { Preferences, User } from '../../types/domain';

const ease = [0.16, 1, 0.3, 1] as const;

/** Everything is private: visitors only see this page and can sign in from it. */
export function Welcome() {
  const { setUser, replacePrefs, toast, prefs, updatePrefs } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  async function submit(e: { preventDefault: () => void }) {
    e.preventDefault();
    if (!username || !password || busy) return;
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
    } catch (error) {
      setShake((n) => n + 1);
      toast(errorMessage(error), 'error');
      setBusy(false);
    }
  }

  const features = [
    {
      icon: <Dumbbell />,
      tone: 'var(--fit-grad)',
      title: t('健身记录', 'Training log'),
      text: t(
        '点选部位就能打卡，也能记下动作和组数。',
        'Tap body parts to log, add sets if you like.',
      ),
    },
    {
      icon: <Plane />,
      tone: 'var(--trav-grad)',
      title: t('旅行足迹', 'Travel map'),
      text: t(
        '去过的地方点亮在地图上，照片和游记一起收好。',
        'Light up places you’ve been, keep photos and notes.',
      ),
    },
  ];

  return (
    <div className="welcome">
      <motion.div
        className="login-orb"
        animate={{ rotate: 360 }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
      />
      <div className="welcome-inner">
        <motion.img
          src="/icon.svg"
          alt=""
          className="login-logo"
          initial={{ scale: 0.6, opacity: 0, rotate: -10 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        />
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, ease }}
        >
          Fubao
        </motion.h1>
        <motion.p
          className="muted"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.14 }}
        >
          {t('一个人的训练与旅行手账', 'A private journal for training and travel')}
        </motion.p>

        <div className="welcome-features">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              className="welcome-feature card"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.07, duration: 0.6, ease }}
            >
              <span className="row-icon" style={{ background: f.tone }}>
                {f.icon}
              </span>
              <span>
                <b>{f.title}</b>
                <span className="faint small">{f.text}</span>
              </span>
            </motion.div>
          ))}
        </div>

        <motion.form
          key={shake}
          onSubmit={submit}
          className="login-form"
          initial={shake ? { x: 0 } : { opacity: 0, y: 16 }}
          animate={shake ? { x: [0, -12, 10, -6, 4, 0] } : { opacity: 1, y: 0 }}
          transition={shake ? { duration: 0.4 } : { delay: 0.34, duration: 0.6, ease }}
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
          <p className="faint small welcome-note">
            <Lock />
            {t('所有记录仅自己可见', 'All records are visible only to you')}
          </p>
        </motion.form>

        <div className="welcome-prefs">
          <Segmented
            className="seg-compact"
            value={prefs.language}
            options={[
              { value: 'zh-CN', label: '中文' },
              { value: 'en-US', label: 'EN' },
            ]}
            onChange={(language) => void updatePrefs({ language })}
          />
          <Segmented
            className="seg-compact"
            value={prefs.theme}
            options={[
              { value: 'system', label: t('自动', 'Auto') },
              { value: 'light', label: t('浅色', 'Light') },
              { value: 'dark', label: t('深色', 'Dark') },
            ]}
            onChange={(theme) => void updatePrefs({ theme })}
          />
        </div>
      </div>
    </div>
  );
}
