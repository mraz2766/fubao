import { useState } from 'react';
import { motion } from 'motion/react';
import { Clock, Dumbbell, Layers, Pencil, Trash2, Zap, Flame } from 'lucide-react';
import { Screen, Press, ConfirmSheet, Skeleton, Empty, Sheet } from '../core/ui';
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
  today,
  type Part,
} from '../core/format';
import { taxonomyLabel } from '../../lib/i18n';
import { knownWorkoutSeconds, workoutDay } from '../../lib/analytics';
import { RecordEditor } from './RecordEditor';
import { ExerciseThumb } from './ExercisePicker';
import { CheckinSheet } from './CheckinSheet';
import {
  keys,
  kind,
  newWorkout,
  removeWorkout,
  saveTemplate,
  uid,
  workoutStats,
  type Workout,
  type WorkoutTemplate,
} from './data';

/** `/fitness/new?date=&minutes=&template=` — a fresh record, saved only when the user taps Save. */
export function NewRecordScreen({ params }: { params: URLSearchParams }) {
  const { prefs } = useApp();
  const { navigate } = useRouter();
  const templateId = params.get('template');
  const { data: templates, loading } = useQuery<{ items: WorkoutTemplate[] }>(
    templateId ? keys.templates : null,
  );
  const [blank] = useState(() => newWorkout(prefs));
  if (templateId && loading)
    return (
      <Screen title="" large={false} tabbar={false} narrow>
        <Skeleton h={200} r={20} />
      </Screen>
    );
  const template = templates?.items.find((x) => x.id === templateId);
  const initial: Workout = template
    ? {
        ...blank,
        title: template.name,
        exercises: template.exercises.map((e) => ({
          ...e,
          id: uid(),
          sets: e.sets.map((s) => ({ ...s, id: uid(), completed: false })),
        })),
      }
    : blank;
  return (
    <Screen title={t('记录训练', 'Log training')} large={false} tabbar={false} narrow>
      <RecordEditor
        initial={initial}
        isNew
        hint={(params.get('parts') ?? '').split(',').filter(Boolean) as Part[]}
        date={params.get('date') ?? today(prefs)}
        minutes={Number(params.get('minutes')) || 0}
        onSaved={(saved) => {
          setQueryData(keys.session(saved.id), () => saved);
          navigate(`/fitness/${saved.id}`, { replace: true, mode: 'tab' });
        }}
      />
    </Screen>
  );
}

export function WorkoutScreen({ id }: { id: string }) {
  const { prefs } = useApp();
  const { back } = useRouter();
  const { data: w, error, loading } = useQuery<Workout>(keys.session(id));
  const [editing, setEditing] = useState(false);

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

  // Unfinished records from the earlier live-workout flow are finished here as plain records.
  if (editing || (w.status !== 'completed' && w.mode === 'detailed'))
    return (
      <Screen title={t('编辑训练', 'Edit training')} large={false} tabbar={false} narrow>
        <RecordEditor
          key={`${w.id}-${w.revision}`}
          initial={w}
          isNew={false}
          date={workoutDay(w, prefs.timezone)}
          minutes={Math.round((knownWorkoutSeconds(w) ?? 0) / 60)}
          onSaved={(saved) => {
            setQueryData(keys.session(id), () => saved);
            setEditing(false);
          }}
        />
      </Screen>
    );

  return <WorkoutDetail w={w} onEdit={() => setEditing(true)} onDeleted={() => back('/fitness')} />;
}

function WorkoutDetail({
  w,
  onEdit,
  onDeleted,
}: {
  w: Workout;
  onEdit: () => void;
  onDeleted: () => void;
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
