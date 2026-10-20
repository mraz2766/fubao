import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Clock, Dumbbell, Layers, Lock, Globe, Pencil, Trash2, Zap, Flame } from 'lucide-react';
import {
  Screen,
  Press,
  Switch,
  ConfirmSheet,
  Skeleton,
  Empty,
  CountUp,
  spring,
  Sheet,
} from '../core/ui';
import { useApp } from '../core/app-state';
import { useRouter } from '../core/router';
import { useQuery, setQueryData } from '../core/query';
import { t, zh, errorMessage, locale } from '../core/i18n';
import {
  fmtDate,
  fmtDuration,
  fmtVolume,
  kgTo,
  partInfo,
  partLabel,
  round1,
  type Part,
} from '../core/format';
import { taxonomyLabel } from '../../lib/i18n';
import { workoutDay } from '../../lib/analytics';
import { WorkoutEditor } from './WorkoutEditor';
import { ExerciseThumb } from './ExercisePicker';
import { CheckinSheet } from './CheckinSheet';
import {
  keys,
  kind,
  putWorkout,
  refreshFitness,
  removeWorkout,
  saveTemplate,
  workoutStats,
  type Workout,
} from './data';

export function WorkoutScreen({ id, edit }: { id: string; edit?: boolean }) {
  const { owner, toast } = useApp();
  const { back, navigate } = useRouter();
  const { data: w, error, loading, reload } = useQuery<Workout>(keys.session(id));
  const [editing, setEditing] = useState(!!edit);
  const [celebrate, setCelebrate] = useState<Workout | null>(null);
  const live = !!w && owner && w.status !== 'completed';

  const onConflict = () => {
    toast(t('记录已在别处更新，已重新载入', 'Updated elsewhere — reloaded'), 'error');
    reload();
  };

  if (loading)
    return (
      <Screen title="" large={false} tabbar={false}>
        <div className="stack" style={{ paddingTop: 12 }}>
          <Skeleton h={160} r={24} />
          <Skeleton h={120} r={20} />
          <Skeleton h={120} r={20} />
        </div>
      </Screen>
    );
  if (error || !w)
    return (
      <Screen title={t('训练', 'Workout')} large={false} tabbar={false}>
        <Empty
          icon={<Dumbbell />}
          title={t('记录不存在或不可访问', 'Not found')}
          text={errorMessage(error)}
        />
      </Screen>
    );

  if (live || (editing && owner && w.mode === 'detailed'))
    return (
      <Screen title={w.title} large={false} tabbar={false} narrow>
        <WorkoutEditor
          key={`${w.id}-${w.revision}-${live}`}
          initial={w}
          mode={live ? 'live' : 'edit'}
          onConflict={onConflict}
          onDiscarded={() => {
            back('/fitness');
            toast(t('已放弃训练', 'Workout discarded'), 'info');
          }}
          onDone={(saved, party) => {
            setQueryData(keys.session(id), () => saved);
            refreshFitness();
            setEditing(false);
            if (party) setCelebrate(saved);
            else toast(t('已保存', 'Saved'));
          }}
        />
      </Screen>
    );

  return (
    <>
      <WorkoutDetail
        w={w}
        onEdit={() => setEditing(true)}
        onDeleted={() => back('/fitness')}
        navigate={navigate}
      />
      {createPortal(
        <AnimatePresence>
          {celebrate && <Celebration w={celebrate} onClose={() => setCelebrate(null)} />}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

function WorkoutDetail({
  w,
  onEdit,
  onDeleted,
}: {
  w: Workout;
  onEdit: () => void;
  onDeleted: () => void;
  navigate: (p: string) => void;
}) {
  const { owner, prefs, toast } = useApp();
  const [checkin, setCheckin] = useState(false);
  const [del, setDel] = useState(false);
  const [tpl, setTpl] = useState(false);
  const [tplName, setTplName] = useState(w.title);
  const stats = workoutStats(w);
  const day = workoutDay(w, prefs.timezone);
  const color = partInfo[(w.body_parts[0] as Part) ?? 'other']?.color ?? '#ff5b2e';
  const seconds = stats.seconds || null;

  const toggleVisibility = async (pub: boolean) => {
    try {
      const saved = await putWorkout({ ...w, visibility: pub ? 'public' : 'private' });
      setQueryData(keys.session(w.id), () => saved);
      refreshFitness();
      toast(pub ? t('已公开', 'Now public') : t('已设为私密', 'Now private'));
    } catch (error) {
      toast(errorMessage(error), 'error');
    }
  };

  return (
    <Screen
      title={w.title}
      large={false}
      tabbar={false}
      narrow
      actions={
        owner && (
          <Press
            className="btn sm"
            onClick={() => (w.mode === 'quick' ? setCheckin(true) : onEdit())}
          >
            <Pencil />
            {t('编辑', 'Edit')}
          </Press>
        )
      }
    >
      <motion.div
        className="workout-hero"
        style={{ '--c': color } as React.CSSProperties}
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="workout-hero-icon">{w.mode === 'quick' ? <Zap /> : <Dumbbell />}</div>
        <div className="eyebrow on-color">
          {fmtDate(day, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </div>
        <h1 className="workout-hero-title">{w.title}</h1>
        <div className="chips" style={{ marginTop: 12 }}>
          {w.body_parts.map((p) => (
            <span key={p} className="glass-chip">
              {partLabel(p)}
            </span>
          ))}
          <span className="glass-chip">
            {w.visibility === 'public' ? <Globe /> : <Lock />}
            {w.visibility === 'public' ? t('公开', 'Public') : t('私密', 'Private')}
          </span>
        </div>
      </motion.div>

      <div className="stat-tiles">
        {[
          {
            icon: <Clock />,
            label: t('时长', 'Duration'),
            value: seconds ? fmtDuration(seconds) : '–',
          },
          {
            icon: <Layers />,
            label: t('动作', 'Exercises'),
            value: String(w.exercises.length || '–'),
          },
          { icon: <Flame />, label: t('完成组', 'Sets'), value: String(stats.sets || '–') },
          {
            icon: <Dumbbell />,
            label: t('容量', 'Volume'),
            value: stats.volume ? fmtVolume(stats.volume, prefs.weightUnit) : '–',
          },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            className="stat-tile card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 + i * 0.05, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            {s.icon}
            <b className="num">{s.value}</b>
            <span>{s.label}</span>
          </motion.div>
        ))}
      </div>

      {w.exercises.map((e, i) => {
        const k = kind(e);
        return (
          <motion.section
            key={e.id}
            className="card pad detail-ex"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.05, duration: 0.45 }}
          >
            <div className="hstack">
              <ExerciseThumb id={e.exercise_id} image={e.image} target={e.target} size={44} />
              <div className="grow">
                <div className="ex-name">{zh() ? e.name_zh || e.name_en : e.name_en}</div>
                <div className="ex-meta">{taxonomyLabel(e.target, locale())}</div>
              </div>
            </div>
            <div className="detail-sets">
              {e.sets.map((s, j) => (
                <div key={s.id} className={`detail-set ${s.completed ? '' : 'faint'}`}>
                  <span className="set-n num">{j + 1}</span>
                  <span className="num">
                    {k === 'weight' &&
                      `${s.weight !== null ? round1(kgTo(s.weight, prefs.weightUnit)) : '–'} ${prefs.weightUnit} × ${s.reps ?? '–'}`}
                    {k === 'reps' && `${s.reps ?? '–'} ${t('次', 'reps')}`}
                    {k === 'duration' &&
                      (s.duration ? fmtDuration(s.duration) || `${s.duration}s` : '–')}
                    {k === 'cardio' &&
                      `${s.distance ? round1(s.distance / (prefs.distanceUnit === 'mile' ? 1609.344 : 1000)) : '–'} ${prefs.distanceUnit}${s.duration ? ` · ${fmtDuration(s.duration)}` : ''}`}
                  </span>
                </div>
              ))}
            </div>
          </motion.section>
        );
      })}

      {w.note && (
        <section className="card pad" style={{ marginTop: 14 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            {t('备注', 'Notes')}
          </div>
          <p style={{ whiteSpace: 'pre-wrap' }}>{w.note}</p>
        </section>
      )}

      {owner && (
        <div className="section">
          <div className="list">
            <div className="list-row">
              <span className="row-icon" style={{ background: 'var(--trav)' }}>
                <Globe />
              </span>
              <span className="grow">{t('公开展示', 'Public')}</span>
              <Switch
                on={w.visibility === 'public'}
                onChange={toggleVisibility}
                label={t('公开展示', 'Public')}
              />
            </div>
            {w.mode === 'detailed' && w.exercises.length > 0 && (
              <button
                className="list-row tappable"
                onClick={() => (setTplName(w.title), setTpl(true))}
              >
                <span className="row-icon" style={{ background: 'var(--ink)' }}>
                  <Layers />
                </span>
                <span className="grow">{t('存为训练模板', 'Save as template')}</span>
              </button>
            )}
            <button className="list-row tappable danger-text" onClick={() => setDel(true)}>
              <span className="row-icon" style={{ background: 'var(--danger)' }}>
                <Trash2 />
              </span>
              <span className="grow">{t('删除记录', 'Delete workout')}</span>
            </button>
          </div>
        </div>
      )}

      <CheckinSheet
        open={checkin}
        onClose={() => setCheckin(false)}
        editing={w}
        onSaved={(saved) => setQueryData(keys.session(w.id), () => saved)}
      />
      <ConfirmSheet
        open={del}
        title={t('删除这条训练记录？', 'Delete this workout?')}
        text={t('删除后无法恢复。', 'This cannot be undone.')}
        confirm={t('删除', 'Delete')}
        danger
        onClose={() => setDel(false)}
        onConfirm={async () => {
          try {
            await removeWorkout(w.id);
            setDel(false);
            onDeleted();
            toast(t('已删除', 'Deleted'), 'info');
          } catch (error) {
            toast(errorMessage(error), 'error');
          }
        }}
      />
      <Sheet
        open={tpl}
        onClose={() => setTpl(false)}
        title={t('存为训练模板', 'Save as template')}
        footer={
          <Press
            className="btn btn-primary block lg"
            disabled={!tplName.trim()}
            onClick={async () => {
              try {
                await saveTemplate(tplName.trim(), w);
                setTpl(false);
                toast(t('模板已保存', 'Template saved'));
              } catch (error) {
                toast(errorMessage(error), 'error');
              }
            }}
          >
            {t('保存模板', 'Save template')}
          </Press>
        }
      >
        <label className="field">
          <span>{t('模板名称', 'Template name')}</span>
          <input
            className="input"
            value={tplName}
            maxLength={120}
            onChange={(e) => setTplName(e.target.value)}
          />
        </label>
        <p className="faint small" style={{ marginTop: 10 }}>
          {t(
            '之后可在健身页一键开始同样的训练。',
            'Start the same workout from Fitness in one tap.',
          )}
        </p>
      </Sheet>
    </Screen>
  );
}

function Celebration({ w, onClose }: { w: Workout; onClose: () => void }) {
  const { prefs } = useApp();
  const stats = workoutStats(w);
  const confetti = Array.from({ length: 28 }, (_, i) => i);
  const colors = ['#ff8a3d', '#ff5b2e', '#ff2d6f', '#f2b233', '#2bd1b0', '#2f7cf6'];
  return (
    <motion.div
      className="celebrate"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onClose}
    >
      <div className="celebrate-confetti" aria-hidden>
        {confetti.map((i) => {
          const angle = (i / confetti.length) * Math.PI * 2;
          const dist = 140 + (i % 5) * 34;
          return (
            <motion.i
              key={i}
              style={{ background: colors[i % colors.length], borderRadius: i % 3 ? 2 : 99 }}
              initial={{ x: 0, y: 0, scale: 0, rotate: 0 }}
              animate={{
                x: Math.cos(angle) * dist,
                y: [0, Math.sin(angle) * dist, Math.sin(angle) * dist + 220],
                scale: [0, 1, 0.8],
                rotate: (i % 2 ? 1 : -1) * 360,
                opacity: [1, 1, 0],
              }}
              transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
            />
          );
        })}
      </div>
      <motion.div
        className="celebrate-card"
        initial={{ scale: 0.7, y: 40, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ ...spring, delay: 0.05 }}
        onClick={(e) => e.stopPropagation()}
      >
        <motion.div
          className="celebrate-medal"
          initial={{ rotate: -30, scale: 0 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.2 }}
        >
          <Flame />
        </motion.div>
        <h2>{t('训练完成！', 'Workout complete!')}</h2>
        <p className="muted">{w.title}</p>
        <div className="finish-stats">
          <div>
            <b className="num">{fmtDuration(stats.seconds) || '–'}</b>
            <span>{t('时长', 'Time')}</span>
          </div>
          <div>
            <b className="num">
              <CountUp value={stats.sets} />
            </b>
            <span>{t('组', 'Sets')}</span>
          </div>
          <div>
            <b className="num">{stats.volume ? fmtVolume(stats.volume, prefs.weightUnit) : '–'}</b>
            <span>{t('容量', 'Volume')}</span>
          </div>
        </div>
        <Press className="btn btn-fit block lg" onClick={onClose}>
          {t('太棒了', 'Nice')}
        </Press>
      </motion.div>
    </motion.div>
  );
}
