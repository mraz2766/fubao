import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from 'motion/react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Ellipsis,
  Minus,
  Plus,
  SkipForward,
  Trash2,
  Timer,
} from 'lucide-react';
import { Press, Sheet, spring, ConfirmSheet, Switch, Segmented } from '../core/ui';
import { useApp } from '../core/app-state';
import { t, zh, errorMessage, locale } from '../core/i18n';
import { clock, kgTo, round1, toKgFrom, fmtVolume, fmtDuration } from '../core/format';
import { ApiFailure, api } from '../../lib/api';
import { taxonomyLabel } from '../../lib/i18n';
import type { RecordingType } from '../../types/domain';
import { ExercisePicker, ExerciseThumb } from './ExercisePicker';
import {
  blank,
  fromExercise,
  kind,
  putWorkout,
  removeWorkout,
  saveTemplate,
  workoutStats,
  type FitnessSet,
  type SessionExercise,
  type Workout,
} from './data';
import { useTicker } from './LiveBanner';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/** Debounced, serialized autosave carrying the server revision forward. */
function useAutosave(onConflict: () => void) {
  const pending = useRef<Workout | null>(null);
  const inflight = useRef<Promise<void> | null>(null);
  const revision = useRef<number | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [state, setState] = useState<SaveState>('idle');
  const flush = useCallback(async (): Promise<Workout | null> => {
    clearTimeout(timer.current);
    if (inflight.current) await inflight.current;
    const next = pending.current;
    if (!next) return null;
    pending.current = null;
    setState('saving');
    let saved: Workout | null = null;
    inflight.current = (async () => {
      try {
        saved = await putWorkout({ ...next, revision: revision.current ?? next.revision });
        revision.current = saved.revision;
        setState('saved');
      } catch (error) {
        setState('error');
        if (error instanceof ApiFailure && error.code === 'CONFLICT') onConflict();
        else pending.current ??= next;
        throw error;
      }
    })().finally(() => (inflight.current = null));
    await inflight.current;
    if (pending.current) return flush();
    return saved;
  }, [onConflict]);
  const schedule = useCallback(
    (w: Workout) => {
      pending.current = w;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush().catch(() => {}), 800);
    },
    [flush],
  );
  useEffect(() => () => clearTimeout(timer.current), []);
  return { schedule, flush, state, revision };
}

export function WorkoutEditor({
  initial,
  mode,
  onDone,
  onDiscarded,
  onConflict,
}: {
  initial: Workout;
  mode: 'live' | 'edit';
  onDone: (saved: Workout, celebrate: boolean) => void;
  onDiscarded: () => void;
  onConflict: () => void;
}) {
  const { prefs, toast } = useApp();
  const [w, setW] = useState(initial);
  const autosave = useAutosave(onConflict);
  const first = useRef(true);
  const [picker, setPicker] = useState(false);
  const [finish, setFinish] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [rest, setRest] = useState<{ until: number; total: number } | null>(null);
  const now = useTicker(mode === 'live');
  autosave.revision.current ??= initial.revision;

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    autosave.schedule(w);
  }, [w]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (fn: (w: Workout) => Workout) => setW((cur) => fn(cur));
  const updateExercise = (id: string, fn: (e: SessionExercise) => SessionExercise) =>
    update((cur) => ({ ...cur, exercises: cur.exercises.map((e) => (e.id === id ? fn(e) : e)) }));

  const restSeconds = () => Number(localStorage.getItem('fubao.rest') ?? 90) || 90;
  const onSetDone = (done: boolean) => {
    if (done && mode === 'live') {
      const total = restSeconds();
      setRest({ until: Date.now() + total * 1000, total });
    }
  };

  const addExercises = async (list: Parameters<typeof fromExercise>[0][]) => {
    const lasts = await Promise.all(
      list.map((ex) =>
        api<{ set: FitnessSet | null }>(`/api/fitness/exercises/${ex.id}/last-set`)
          .then((r) => r.set)
          .catch(() => null),
      ),
    );
    update((cur) => ({
      ...cur,
      exercises: [...cur.exercises, ...list.map((ex, i) => fromExercise(ex, lasts[i]))],
    }));
    setTimeout(() => {
      const cards = document.querySelectorAll('.ex-card');
      cards[cards.length - list.length]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  };

  const elapsed = (now - Date.parse(w.start_at)) / 1000;
  const stats = workoutStats(w);
  const totalSets = w.exercises.reduce((n, e) => n + e.sets.length, 0);

  return (
    <div className="editor">
      <div className="editor-head">
        {mode === 'live' ? (
          <>
            <div className="eyebrow live-eyebrow">
              <span className="live-pulse" />
              {t('训练中', 'Live')}
            </div>
            <div className="live-timer num">{clock(elapsed)}</div>
          </>
        ) : (
          <div className="eyebrow">{t('编辑训练', 'Editing')}</div>
        )}
        <input
          className="title-input"
          value={w.title}
          maxLength={120}
          onChange={(e) => update((cur) => ({ ...cur, title: e.target.value }))}
          aria-label={t('训练名称', 'Workout name')}
        />
        <div className="editor-meta">
          <span className="num">
            {stats.sets}/{totalSets}
          </span>{' '}
          {t('组完成', 'sets done')}
          {stats.volume > 0 && <> · {fmtVolume(stats.volume, prefs.weightUnit)}</>}
          <SaveDot state={autosave.state} />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {w.exercises.map((e, i) => (
          <ExerciseCard
            key={e.id}
            e={e}
            index={i}
            count={w.exercises.length}
            onChange={(fn) => updateExercise(e.id, fn)}
            onRemove={() =>
              update((cur) => ({ ...cur, exercises: cur.exercises.filter((x) => x.id !== e.id) }))
            }
            onMove={(d) =>
              update((cur) => {
                const list = [...cur.exercises];
                const [item] = list.splice(i, 1);
                list.splice(i + d, 0, item!);
                return { ...cur, exercises: list };
              })
            }
            onSetDone={onSetDone}
          />
        ))}
      </AnimatePresence>

      {!w.exercises.length && (
        <motion.div
          className="editor-empty"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p>{t('从动作库添加今天要练的动作', 'Add exercises from the library')}</p>
        </motion.div>
      )}

      <Press className="btn block add-ex-btn" onClick={() => setPicker(true)}>
        <Plus />
        {t('添加动作', 'Add exercise')}
      </Press>

      <label className="field" style={{ marginTop: 22 }}>
        <span>{t('备注', 'Notes')}</span>
        <textarea
          className="textarea"
          value={w.note}
          maxLength={5000}
          placeholder={t('状态、感受、下次要注意的…', 'How did it feel?')}
          onChange={(e) => update((cur) => ({ ...cur, note: e.target.value }))}
        />
      </label>

      {mode === 'live' && (
        <Press
          className="btn block btn-ghost danger-text"
          style={{ marginTop: 12 }}
          onClick={() => setDiscard(true)}
        >
          {t('放弃本次训练', 'Discard workout')}
        </Press>
      )}

      <div className="editor-bar">
        <AnimatePresence>
          {rest && <RestTimer key={rest.until} rest={rest} onChange={setRest} />}
        </AnimatePresence>
        <Press
          className="btn btn-fit lg block"
          onClick={async () => {
            if (mode === 'live') return setFinish(true);
            try {
              onDone((await autosave.flush()) ?? w, false);
            } catch (error) {
              toast(errorMessage(error), 'error');
            }
          }}
        >
          <Check strokeWidth={2.6} />
          {mode === 'live' ? t('完成训练', 'Finish') : t('完成编辑', 'Done')}
        </Press>
      </div>

      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={addExercises} />
      <FinishSheet
        open={finish}
        w={w}
        elapsed={elapsed}
        onClose={() => setFinish(false)}
        onConfirm={async (patch, template) => {
          try {
            await autosave.flush().catch(() => {});
            const done: Workout = {
              ...w,
              ...patch,
              status: 'completed',
              end_at: new Date().toISOString(),
              revision: autosave.revision.current ?? w.revision,
            };
            const saved = await putWorkout(done);
            if (template) {
              await saveTemplate(done.title, done).catch(() =>
                toast(t('模板保存失败', 'Template not saved'), 'error'),
              );
            }
            setFinish(false);
            onDone(saved, true);
          } catch (error) {
            if (error instanceof ApiFailure && error.code === 'CONFLICT') onConflict();
            toast(errorMessage(error), 'error');
          }
        }}
      />
      <ConfirmSheet
        open={discard}
        title={t('放弃本次训练？', 'Discard this workout?')}
        text={t('已记录的组会被删除。', 'Logged sets will be deleted.')}
        confirm={t('放弃训练', 'Discard')}
        danger
        onClose={() => setDiscard(false)}
        onConfirm={async () => {
          await removeWorkout(w.id);
          setDiscard(false);
          onDiscarded();
        }}
      />
    </div>
  );
}

function SaveDot({ state }: { state: SaveState }) {
  if (state === 'idle') return null;
  return (
    <span className={`save-dot ${state}`}>
      {state === 'saving'
        ? t('保存中', 'Saving')
        : state === 'saved'
          ? t('已保存', 'Saved')
          : t('未保存', 'Not saved')}
    </span>
  );
}

const typeLabels: Record<Exclude<RecordingType, 'auto'>, [string, string]> = {
  weight: ['重量×次数', 'Weight × reps'],
  reps: ['仅次数', 'Reps'],
  duration: ['计时', 'Time'],
  cardio: ['距离+时间', 'Distance'],
};

function ExerciseCard({
  e,
  index,
  count,
  onChange,
  onRemove,
  onMove,
  onSetDone,
}: {
  e: SessionExercise;
  index: number;
  count: number;
  onChange: (fn: (e: SessionExercise) => SessionExercise) => void;
  onRemove: () => void;
  onMove: (d: number) => void;
  onSetDone: (done: boolean) => void;
}) {
  const { prefs } = useApp();
  const [menu, setMenu] = useState(false);
  const k = kind(e);
  const done = e.sets.filter((s) => s.completed).length;
  const setField = (id: string, patch: Partial<FitnessSet>) =>
    onChange((cur) => ({
      ...cur,
      sets: cur.sets.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  return (
    <motion.section
      layout
      className="ex-card card"
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, height: 0, marginTop: 0 }}
      transition={{ ...spring, opacity: { duration: 0.2 } }}
    >
      <header className="ex-card-head">
        <ExerciseThumb id={e.exercise_id} image={e.image} target={e.target} size={44} />
        <div className="grow">
          <div className="ex-name">{zh() ? e.name_zh || e.name_en : e.name_en}</div>
          <div className="ex-meta">
            {taxonomyLabel(e.target, locale())} ·{' '}
            {t(`${done}/${e.sets.length} 组`, `${done}/${e.sets.length} sets`)}
          </div>
        </div>
        <Press
          className="icon-btn sm filled"
          onClick={() => setMenu(true)}
          aria-label={t('更多', 'More')}
        >
          <Ellipsis />
        </Press>
      </header>
      <div className={`set-grid head k-${k}`}>
        <span>{t('组', 'Set')}</span>
        {k === 'weight' && <span>{prefs.weightUnit}</span>}
        {(k === 'weight' || k === 'reps') && <span>{t('次', 'Reps')}</span>}
        {k === 'duration' && <span>{t('秒', 'Sec')}</span>}
        {k === 'cardio' && (
          <>
            <span>{prefs.distanceUnit}</span>
            <span>{t('分钟', 'Min')}</span>
          </>
        )}
        <span />
      </div>
      <AnimatePresence initial={false}>
        {e.sets.map((s, i) => (
          <SetRow
            key={s.id}
            s={s}
            n={i + 1}
            k={k}
            onField={(patch) => setField(s.id, patch)}
            onToggle={() => {
              setField(s.id, { completed: !s.completed });
              onSetDone(!s.completed);
            }}
            onDelete={() =>
              onChange((cur) => ({ ...cur, sets: cur.sets.filter((x) => x.id !== s.id) }))
            }
          />
        ))}
      </AnimatePresence>
      <button
        className="add-set"
        onClick={() => onChange((cur) => ({ ...cur, sets: [...cur.sets, blank(cur.sets.at(-1))] }))}
        disabled={e.sets.length >= 100}
      >
        <Plus />
        {t('添加一组', 'Add set')}
      </button>
      <Sheet
        open={menu}
        onClose={() => setMenu(false)}
        title={zh() ? e.name_zh || e.name_en : e.name_en}
      >
        <div className="form-label" style={{ marginTop: 0 }}>
          {t('记录方式', 'Log as')}
        </div>
        <Segmented
          value={k}
          options={(Object.keys(typeLabels) as (keyof typeof typeLabels)[]).map((key) => ({
            value: key,
            label: t(typeLabels[key][0], typeLabels[key][1]),
          }))}
          onChange={(v) => onChange((cur) => ({ ...cur, recording_type: v }))}
        />
        <div className="list" style={{ marginTop: 18 }}>
          <button
            className="list-row tappable"
            disabled={index === 0}
            onClick={() => (onMove(-1), setMenu(false))}
          >
            <ChevronUp className="faint" />
            <span className="grow">{t('上移', 'Move up')}</span>
          </button>
          <button
            className="list-row tappable"
            disabled={index === count - 1}
            onClick={() => (onMove(1), setMenu(false))}
          >
            <ChevronDown className="faint" />
            <span className="grow">{t('下移', 'Move down')}</span>
          </button>
          <button
            className="list-row tappable danger-text"
            onClick={() => (setMenu(false), onRemove())}
          >
            <Trash2 />
            <span className="grow">{t('移除动作', 'Remove exercise')}</span>
          </button>
        </div>
      </Sheet>
    </motion.section>
  );
}

function SetRow({
  s,
  n,
  k,
  onField,
  onToggle,
  onDelete,
}: {
  s: FitnessSet;
  n: number;
  k: ReturnType<typeof kind>;
  onField: (patch: Partial<FitnessSet>) => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { prefs } = useApp();
  const x = useMotionValue(0);
  const reveal = useTransform(x, [-90, -20, 0], [1, 0.4, 0]);
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -140 || info.velocity.x < -700) onDelete();
    else animate(x, info.offset.x < -50 ? -84 : 0, spring);
  };
  const distanceFactor = prefs.distanceUnit === 'mile' ? 1609.344 : 1000;
  return (
    <motion.div
      className="set-wrap"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
    >
      <motion.button
        className="set-delete"
        style={{ opacity: reveal }}
        onClick={onDelete}
        aria-label={t('删除这一组', 'Delete set')}
      >
        <Trash2 />
      </motion.button>
      <motion.div
        className={`set-grid row k-${k} ${s.completed ? 'done' : ''}`}
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -200, right: 0 }}
        dragElastic={{ left: 0.4, right: 0 }}
        onDragEnd={onDragEnd}
      >
        <span className="set-n num">{n}</span>
        {k === 'weight' && (
          <NumberCell
            value={s.weight === null ? null : round1(kgTo(s.weight, prefs.weightUnit))}
            onChange={(v) => onField({ weight: v === null ? null : toKgFrom(v, prefs.weightUnit) })}
            max={prefs.weightUnit === 'lb' ? 4400 : 2000}
            label={t('重量', 'Weight')}
          />
        )}
        {(k === 'weight' || k === 'reps') && (
          <NumberCell
            value={s.reps}
            integer
            min={1}
            max={10000}
            onChange={(v) => onField({ reps: v })}
            label={t('次数', 'Reps')}
          />
        )}
        {k === 'duration' && (
          <NumberCell
            value={s.duration}
            integer
            min={1}
            max={604800}
            onChange={(v) => onField({ duration: v })}
            label={t('秒', 'Seconds')}
          />
        )}
        {k === 'cardio' && (
          <>
            <NumberCell
              value={s.distance === null ? null : round1(s.distance / distanceFactor)}
              onChange={(v) => onField({ distance: v === null ? null : v * distanceFactor })}
              label={t('距离', 'Distance')}
              max={10000}
            />
            <NumberCell
              value={s.duration === null ? null : Math.round(s.duration / 60)}
              integer
              onChange={(v) => onField({ duration: v === null ? null : v * 60 })}
              label={t('分钟', 'Minutes')}
              min={1}
              max={10080}
            />
          </>
        )}
        <motion.button
          className={`set-check ${s.completed ? 'on' : ''}`}
          onClick={onToggle}
          whileTap={{ scale: 0.82 }}
          aria-pressed={s.completed}
          aria-label={t('完成这一组', 'Complete set')}
        >
          <motion.svg viewBox="0 0 24 24" width="18" height="18">
            <motion.path
              key={String(s.completed)}
              d="M5 12.5l4.2 4.2L19 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: s.completed ? 0 : 1 }}
              animate={{ pathLength: 1, opacity: s.completed ? 1 : 0.35 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
            />
          </motion.svg>
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

function NumberCell({
  value,
  onChange,
  integer,
  min = 0,
  max,
  label,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  integer?: boolean;
  min?: number;
  max?: number;
  label: string;
}) {
  const [text, setText] = useState(value === null ? '' : String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value === null ? '' : String(value));
  }, [value]);
  return (
    <input
      className="set-input num"
      inputMode={integer ? 'numeric' : 'decimal'}
      enterKeyHint="done"
      aria-label={label}
      value={text}
      placeholder="–"
      onFocus={(e) => {
        focused.current = true;
        e.currentTarget.select();
      }}
      onBlur={() => {
        focused.current = false;
        setText(value === null ? '' : String(value));
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(',', '.').replace(/[^\d.]/g, '');
        setText(raw);
        if (raw === '') return onChange(null);
        const v = integer ? Math.round(Number(raw)) : Number(raw);
        if (Number.isFinite(v) && v >= min && (max === undefined || v <= max))
          onChange(v === 0 && integer ? null : v);
      }}
    />
  );
}

function RestTimer({
  rest,
  onChange,
}: {
  rest: { until: number; total: number };
  onChange: (r: { until: number; total: number } | null) => void;
}) {
  const now = useTicker(true);
  const left = Math.max(0, Math.ceil((rest.until - now) / 1000));
  useEffect(() => {
    if (left > 0) return;
    navigator.vibrate?.([120, 60, 120]);
    const id = setTimeout(() => onChange(null), 1600);
    return () => clearTimeout(id);
  }, [left === 0]); // eslint-disable-line react-hooks/exhaustive-deps
  const adjust = (d: number) => {
    const total = Math.max(15, rest.total + d);
    localStorage.setItem('fubao.rest', String(total));
    onChange({ until: rest.until + d * 1000, total });
  };
  const progress = left / rest.total;
  return (
    <motion.div
      className={`rest-pill ${left === 0 ? 'over' : ''}`}
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.92 }}
      transition={spring}
    >
      <div className="rest-progress" style={{ transform: `scaleX(${progress})` }} />
      <Timer className="rest-icon" />
      <div className="grow">
        <div className="rest-label">
          {left ? t('组间休息', 'Rest') : t('开始下一组！', 'Next set!')}
        </div>
        <div className="rest-time num">{clock(left)}</div>
      </div>
      <button className="icon-btn sm" onClick={() => adjust(-15)} aria-label="-15s">
        <Minus />
      </button>
      <button className="icon-btn sm" onClick={() => adjust(15)} aria-label="+15s">
        <Plus />
      </button>
      <button className="icon-btn sm" onClick={() => onChange(null)} aria-label={t('跳过', 'Skip')}>
        <SkipForward />
      </button>
    </motion.div>
  );
}

function FinishSheet({
  open,
  w,
  elapsed,
  onClose,
  onConfirm,
}: {
  open: boolean;
  w: Workout;
  elapsed: number;
  onClose: () => void;
  onConfirm: (patch: Partial<Workout>, template: boolean) => Promise<void>;
}) {
  const { prefs } = useApp();
  const [title, setTitle] = useState(w.title);
  const [pub, setPub] = useState(w.visibility === 'public');
  const [template, setTemplate] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setTitle(w.title);
      setPub(w.visibility === 'public');
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const stats = workoutStats(w);
  const incomplete = w.exercises.some((e) => e.sets.some((s) => !s.completed));
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('完成训练', 'Finish workout')}
      footer={
        <Press
          className="btn btn-fit block lg"
          disabled={busy || !stats.sets}
          onClick={async () => {
            setBusy(true);
            await onConfirm(
              {
                title: title.trim() || w.title,
                visibility: pub ? 'public' : 'private',
                exercises: w.exercises
                  .map((e) => ({ ...e, sets: e.sets.filter((s) => s.completed) }))
                  .filter((e) => e.sets.length),
              },
              template,
            );
            setBusy(false);
          }}
        >
          {busy ? <span className="spinner" /> : t('保存训练', 'Save workout')}
        </Press>
      }
    >
      <div className="finish-stats">
        <div>
          <b className="num">{clock(elapsed)}</b>
          <span>{t('时长', 'Time')}</span>
        </div>
        <div>
          <b className="num">{stats.sets}</b>
          <span>{t('完成组', 'Sets')}</span>
        </div>
        <div>
          <b className="num">{stats.volume ? fmtVolume(stats.volume, prefs.weightUnit) : '–'}</b>
          <span>{t('容量', 'Volume')}</span>
        </div>
      </div>
      {!stats.sets && (
        <p className="danger-text small" style={{ marginBottom: 12 }}>
          {t('请至少完成一组再保存。', 'Complete at least one set to save.')}
        </p>
      )}
      {incomplete && (
        <p className="faint small" style={{ marginBottom: 12 }}>
          {t('未勾选完成的组不会保存。', 'Unchecked sets will not be saved.')}
        </p>
      )}
      <label className="field">
        <span>{t('名称', 'Name')}</span>
        <input
          className="input"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <div className="list" style={{ marginTop: 16 }}>
        <div className="list-row">
          <span className="grow">
            {t('公开展示', 'Public')}
            <span className="faint small" style={{ display: 'block' }}>
              {t('访客可以看到这次训练', 'Visitors can see this workout')}
            </span>
          </span>
          <Switch on={pub} onChange={setPub} label={t('公开展示', 'Public')} />
        </div>
        <div className="list-row">
          <span className="grow">{t('存为训练模板', 'Save as template')}</span>
          <Switch
            on={template}
            onChange={setTemplate}
            label={t('存为训练模板', 'Save as template')}
          />
        </div>
      </div>
      {elapsed > 0 && (
        <p className="faint small" style={{ marginTop: 12 }}>
          {t('训练时长 ', 'Duration ')}
          {fmtDuration(elapsed)}
        </p>
      )}
    </Sheet>
  );
}
