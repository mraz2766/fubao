import { useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ChevronRight,
  Download,
  Globe2,
  Info,
  KeyRound,
  Languages,
  LogOut,
  Moon,
  Ruler,
  Target,
  CalendarDays,
  Upload,
  Clock,
  Minus,
  Plus,
} from 'lucide-react';
import { Screen, Press, Segmented, Sheet, ConfirmSheet } from '../core/ui';
import { useApp } from '../core/app-state';
import { useRouter } from '../core/router';
import { invalidate } from '../core/query';
import { t, errorMessage } from '../core/i18n';
import { api } from '../../lib/api';
import { spots } from '../travel/data';
import type { Preferences } from '../../types/domain';

const zones = [
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Taipei',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Singapore',
  'Asia/Bangkok',
  'Asia/Dubai',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Australia/Sydney',
  'UTC',
];

function Row({
  icon,
  color,
  label,
  children,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  children?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={`list-row ${onClick ? 'tappable' : ''} ${danger ? 'danger-text' : ''}`}
      onClick={onClick}
    >
      <span className="row-icon" style={{ background: color }}>
        {icon}
      </span>
      <span className="grow">{label}</span>
      {children}
      {onClick && !children && <ChevronRight className="chev" />}
    </Tag>
  );
}

export function Settings() {
  const { user, owner, prefs, updatePrefs, setUser, toast } = useApp();
  const { navigate } = useRouter();
  const [password, setPassword] = useState(false);
  const [logout, setLogout] = useState(false);
  const [importing, setImporting] = useState(false);
  const set = (patch: Partial<Preferences>) =>
    updatePrefs(patch).catch((e) => toast(errorMessage(e), 'error'));
  return (
    <Screen title={t('我的', 'Me')} narrow>
      <motion.div
        className="profile card"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <img src="/icon.svg" alt="" className="avatar" />
        <div className="grow">
          <div className="profile-name">{user?.username}</div>
          <div className="faint small">
            {t('所有记录仅自己可见', 'All records are visible only to you')}
          </div>
        </div>
      </motion.div>

      <div className="section">
        <div className="list-label">{t('外观', 'Appearance')}</div>
        <div className="list">
          <Row icon={<Languages />} color="#2f7cf6" label={t('语言', 'Language')}>
            <Segmented
              className="seg-compact"
              value={prefs.language}
              options={[
                { value: 'zh-CN', label: '中文' },
                { value: 'en-US', label: 'EN' },
              ]}
              onChange={(language) => set({ language })}
            />
          </Row>
          <Row icon={<Moon />} color="#5b5bd6" label={t('主题', 'Theme')}>
            <Segmented
              className="seg-compact"
              value={prefs.theme}
              options={[
                { value: 'system', label: t('自动', 'Auto') },
                { value: 'light', label: t('浅色', 'Light') },
                { value: 'dark', label: t('深色', 'Dark') },
              ]}
              onChange={(theme) => set({ theme })}
            />
          </Row>
        </div>
      </div>

      <div className="section">
        <div className="list-label">{t('训练', 'Training')}</div>
        <div className="list">
          {owner && (
            <Row icon={<Target />} color="var(--fit)" label={t('每周目标', 'Weekly goal')}>
              <div className="stepper">
                <button
                  onClick={() => set({ weeklyGoal: Math.max(1, prefs.weeklyGoal - 1) })}
                  aria-label="-"
                >
                  <Minus />
                </button>
                <motion.b
                  key={prefs.weeklyGoal}
                  className="num"
                  initial={{ y: -8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                >
                  {prefs.weeklyGoal}
                </motion.b>
                <button
                  onClick={() => set({ weeklyGoal: Math.min(21, prefs.weeklyGoal + 1) })}
                  aria-label="+"
                >
                  <Plus />
                </button>
              </div>
            </Row>
          )}
          <Row icon={<Ruler />} color="#f2a233" label={t('重量单位', 'Weight')}>
            <Segmented
              className="seg-compact"
              value={prefs.weightUnit}
              options={[
                { value: 'kg', label: 'kg' },
                { value: 'lb', label: 'lb' },
              ]}
              onChange={(weightUnit) => set({ weightUnit })}
            />
          </Row>
          <Row icon={<Ruler />} color="#0f9b8e" label={t('距离单位', 'Distance')}>
            <Segmented
              className="seg-compact"
              value={prefs.distanceUnit}
              options={[
                { value: 'km', label: 'km' },
                { value: 'mile', label: 'mi' },
              ]}
              onChange={(distanceUnit) => set({ distanceUnit })}
            />
          </Row>
          <Row icon={<CalendarDays />} color="#ff2d6f" label={t('每周开始于', 'Week starts')}>
            <Segmented
              className="seg-compact"
              value={prefs.weekStart}
              options={[
                { value: 1, label: t('周一', 'Mon') },
                { value: 0, label: t('周日', 'Sun') },
              ]}
              onChange={(weekStart) => set({ weekStart })}
            />
          </Row>
          {owner && (
            <Row icon={<Clock />} color="#8e8c86" label={t('时区', 'Time zone')}>
              <select
                className="inline-select"
                value={prefs.timezone}
                onChange={(e) => set({ timezone: e.target.value })}
              >
                {[...new Set([prefs.timezone, ...zones])].map((z) => (
                  <option key={z} value={z}>
                    {z.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </Row>
          )}
        </div>
      </div>

      {owner && (
        <div className="section">
          <div className="list-label">{t('数据与账户', 'Data & account')}</div>
          <div className="list">
            <Row
              icon={<Download />}
              color="#22b26a"
              label={t('导出备份（JSON）', 'Export backup (JSON)')}
              onClick={() => {
                location.href = '/api/data/export';
              }}
            />
            <Row
              icon={<Upload />}
              color="#2f7cf6"
              label={t('从备份恢复', 'Restore from backup')}
              onClick={() => setImporting(true)}
            />
            <Row
              icon={<KeyRound />}
              color="#5f5e59"
              label={t('修改密码', 'Change password')}
              onClick={() => setPassword(true)}
            />
            <Row
              icon={<LogOut />}
              color="var(--danger)"
              label={t('退出登录', 'Sign out')}
              onClick={() => setLogout(true)}
              danger
            />
          </div>
          <p className="list-foot">
            {t(
              '备份不包含照片文件；照片仍保存在私有存储中。',
              'Backups do not include photo files; photos stay in private storage.',
            )}
          </p>
        </div>
      )}

      <div className="section">
        <div className="list">
          <Row
            icon={<Info />}
            color="#161614"
            label={t('关于与致谢', 'About & credits')}
            onClick={() => navigate('/settings/about')}
          />
        </div>
      </div>

      <PasswordSheet
        open={password}
        onClose={() => setPassword(false)}
        onDone={() => setUser(null)}
      />
      <ImportSheet open={importing} onClose={() => setImporting(false)} />
      <ConfirmSheet
        open={logout}
        title={t('退出登录？', 'Sign out?')}
        confirm={t('退出', 'Sign out')}
        danger
        onClose={() => setLogout(false)}
        onConfirm={async () => {
          try {
            await api('/api/auth/logout', { method: 'POST', body: {} });
          } catch {
            /* Session already gone. */
          }
          setLogout(false);
          setUser(null);
          navigate('/', { root: true });
        }}
      />
    </Screen>
  );
}

function PasswordSheet({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useApp();
  const { navigate } = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('修改密码', 'Change password')}
      footer={
        <Press
          className="btn btn-primary block lg"
          disabled={!current || next.length < 5 || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api('/api/auth/password', {
                method: 'POST',
                body: { currentPassword: current, newPassword: next },
              });
              toast(t('密码已更新，请重新登录', 'Password changed — sign in again'));
              onClose();
              history.replaceState(null, '', '/');
              onDone();
            } catch (e) {
              toast(errorMessage(e), 'error');
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <span className="spinner" /> : t('更新密码', 'Update password')}
        </Press>
      }
    >
      <div className="stack">
        <label className="field">
          <span>{t('当前密码', 'Current password')}</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </label>
        <label className="field">
          <span>{t('新密码（至少 5 位）', 'New password (5+ characters)')}</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </label>
        <p className="faint small">
          {t('更新后所有设备需要重新登录。', 'All devices will be signed out.')}
        </p>
      </div>
    </Sheet>
  );
}

interface Preview {
  sessions: { new: number; skip: number };
  templates: { new: number; skip: number };
  trips: { new: number; skip: number };
  wishlist: { new: number; skip: number };
  favorites: number;
}
interface Backup {
  fitness: { sessions: unknown[]; templates: unknown[]; favorites: unknown[] };
  travel: { entries: unknown[]; wishlist: unknown[] };
}

function ImportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useApp();
  const [backup, setBackup] = useState<Backup | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; failed: number } | null>(
    null,
  );
  const input = useRef<HTMLInputElement>(null);
  const reset = () => {
    setBackup(null);
    setPreview(null);
    setProgress(null);
  };
  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Backup;
      setPreview(await api<Preview>('/api/data/preview', { method: 'POST', body: parsed }));
      setBackup(parsed);
    } catch (e) {
      toast(
        e instanceof SyntaxError
          ? t('文件不是有效的 JSON', 'Not a valid JSON file')
          : errorMessage(e),
        'error',
      );
    }
  };
  const run = async () => {
    if (!backup) return;
    const items = [
      ...backup.fitness.sessions.map((value) => ({ kind: 'session', value })),
      ...backup.fitness.templates.map((value) => ({ kind: 'template', value })),
      ...backup.travel.entries.map((value) => ({ kind: 'trip', value })),
      ...backup.travel.wishlist.map((value) => ({ kind: 'wishlist', value })),
      ...backup.fitness.favorites.map((value) => ({ kind: 'favorite', value })),
    ];
    let failed = 0;
    setProgress({ done: 0, total: items.length, failed });
    for (let i = 0; i < items.length; i++) {
      try {
        await api('/api/data/import', { method: 'POST', body: items[i] });
      } catch {
        failed++;
      }
      setProgress({ done: i + 1, total: items.length, failed });
    }
    invalidate('/api/');
    toast(
      failed
        ? t(`完成，${failed} 条未导入`, `Done, ${failed} failed`)
        : t('恢复完成', 'Restore complete'),
      failed ? 'error' : 'ok',
    );
  };
  const rows: [string, { new: number; skip: number } | number][] = preview
    ? [
        [t('训练', 'Workouts'), preview.sessions],
        [t('模板', 'Templates'), preview.templates],
        [t('旅程', 'Trips'), preview.trips],
        [t('想去', 'Wishlist'), preview.wishlist],
        [t('收藏动作', 'Saved exercises'), preview.favorites],
      ]
    : [];
  const finished = progress && progress.done === progress.total;
  return (
    <Sheet
      open={open}
      onClose={() => (reset(), onClose())}
      dismissible={!progress || progress.done === progress.total}
      title={t('从备份恢复', 'Restore from backup')}
      footer={
        preview ? (
          <Press
            className="btn btn-primary block lg"
            disabled={!!progress && !finished}
            onClick={finished ? () => (reset(), onClose()) : run}
          >
            {finished
              ? t('完成', 'Done')
              : progress
                ? `${progress.done}/${progress.total}`
                : t('开始恢复', 'Restore')}
          </Press>
        ) : (
          <Press className="btn btn-primary block lg" onClick={() => input.current?.click()}>
            <Upload />
            {t('选择备份文件', 'Choose backup file')}
          </Press>
        )
      }
    >
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => pick(e.target.files?.[0])}
      />
      {!preview && (
        <p className="muted">
          {t(
            '已存在的记录会自动跳过，不会覆盖。',
            'Existing records are skipped, never overwritten.',
          )}
        </p>
      )}
      {preview && (
        <div className="list">
          {rows.map(([label, v]) => (
            <div key={label} className="list-row">
              <span className="grow">{label}</span>
              <span className="value num">
                {typeof v === 'number'
                  ? v
                  : t(`新增 ${v.new} · 跳过 ${v.skip}`, `${v.new} new · ${v.skip} skip`)}
              </span>
            </div>
          ))}
        </div>
      )}
      {progress && (
        <div className="progress-track" style={{ marginTop: 16 }}>
          <motion.i
            animate={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }}
          />
        </div>
      )}
    </Sheet>
  );
}

export function About() {
  return (
    <Screen title={t('关于', 'About')} tabbar={false} narrow>
      <div className="card pad about-hero">
        <img src="/icon.svg" alt="" className="avatar lg" />
        <h2>Fubao</h2>
        <p className="muted">
          {t('一个人的训练与旅行手账。', 'A personal journal for training and travel.')}
        </p>
        <p className="faint small" style={{ marginTop: 8 }}>
          {t(
            '添加到 iOS 主屏幕：在 Safari 中点「分享」→「添加到主屏幕」。',
            'On iOS: Safari → Share → Add to Home Screen.',
          )}
        </p>
      </div>
      <div className="section">
        <div className="list-label">{t('数据来源', 'Data sources')}</div>
        <div className="list">
          {[
            [
              'Exercises Dataset · MIT',
              'https://github.com/hasaneyldrm/exercises-dataset/blob/main/LICENSE',
            ],
            ['Free Exercise DB · Unlicense', '/licenses/free-exercise-db.txt'],
            [
              'Countries States Cities · ODbL',
              'https://github.com/dr5hn/countries-states-cities-database/blob/master/LICENSE',
            ],
            [
              t('下载派生地点数据（ODbL）', 'Download derived location data (ODbL)'),
              '/api/locations/export',
            ],
            ['Natural Earth · Public Domain', 'https://www.naturalearthdata.com/'],
            ['heic-to · LGPL-3.0-or-later', '/licenses/heic-to.txt'],
            ['GPL-3.0 terms', '/licenses/gpl-3.0.txt'],
            ['Motion · MIT', 'https://github.com/motiondivision/motion/blob/main/LICENSE.md'],
            ['Lucide · ISC', 'https://lucide.dev/license'],
          ].map(([label, href]) => (
            <a
              key={label}
              className="list-row tappable"
              href={href}
              target="_blank"
              rel="noreferrer"
            >
              <span className="grow">{label}</span>
              <ChevronRight className="chev" />
            </a>
          ))}
        </div>
      </div>
      <div className="section">
        <div className="list-label">{t('风景照片', 'Scenery photos')}</div>
        <div className="list">
          {spots.map((s) => (
            <a
              key={s.id}
              className="list-row tappable"
              href={s.image.source}
              target="_blank"
              rel="noreferrer"
            >
              <img src={s.image.thumbnail} alt="" className="place-img" />
              <span className="grow">
                <span style={{ display: 'block', fontWeight: 600 }}>{t(s.name_zh, s.name_en)}</span>
                <span className="faint small">
                  {s.image.artist} · {s.image.license}
                </span>
              </span>
              <Globe2 className="chev" />
            </a>
          ))}
        </div>
      </div>
    </Screen>
  );
}
