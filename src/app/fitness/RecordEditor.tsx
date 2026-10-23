import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown, ChevronUp, Ellipsis, Plus, Trash2, X } from 'lucide-react';
import { Press, Sheet, spring, Segmented } from '../core/ui';
import { useApp } from '../core/app-state';
import { t, zh, errorMessage, locale } from '../core/i18n';
import { kgTo, round1, toKgFrom, fmtVolume, partsTitle, type Part } from '../core/format';
import { api } from '../../lib/api';
import { taxonomyLabel } from '../../lib/i18n';
import { trainingPart, trainingParts, zonedISO } from '../../lib/fitness-recording';
import type { RecordingType } from '../../types/domain';
import { ExercisePicker, ExerciseThumb } from './ExercisePicker';
import { DateDurationFields } from './parts';
import { haptic } from '../core/haptics';
import {
  blank,
  createWorkout,
  fromExercise,
  kind,
  putWorkout,
  refreshFitness,
  type FitnessSet,
  type SessionExercise,
  type Workout,
} from './data';

const filled = (s: FitnessSet) =>
  s.weight !== null || s.reps !== null || s.duration !== null || s.distance !== null;

/** A plain form for a training record: when, how long, which exercises and sets. */
export function RecordEditor({
  initial,
  date: initialDate,
  minutes: initialMinutes,
  isNew,
  hint,
  onSaved,
}: {
  initial: Workout;
  date: string;
  minutes: number;
  isNew: boolean;
  /** Body parts picked in the check-in sheet, used to pre-filter the exercise library. */
  hint?: Part[];
  onSaved: (saved: Workout) => void;
}) {
  const { prefs, toast } = useApp();
  const [w, setW] = useState(initial);
  const [date, setDate] = useState(initialDate);
  const [minutes, setMinutes] = useState(initialMinutes);
  const [picker, setPicker] = useState(false);
  useEffect(() => {
    // A new empty record goes straight to choosing exercises, after the push animation.
    if (!isNew || initial.exercises.length) return;
    const timer = setTimeout(() => setPicker(true), 450);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [busy, setBusy] = useState(false);
  // Keep the automatic name in sync with the exercises until the user types their own.
  const autoTitle = useRef(
    isNew || !initial.title || initial.title === partsTitle(initial.body_parts),
  );

  const parts = trainingParts.filter((p) => w.exercises.some((e) => trainingPart(e.target) === p));
  const title = autoTitle.current
    ? parts.length
      ? partsTitle(parts)
      : t('力量训练', 'Strength')
    : w.title;
  const sets = w.exercises.flatMap((e) => e.sets.filter(filled));
  const volume = w.exercises.reduce(
    (n, e) =>
      n +
      (kind(e) === 'weight' ? e.sets.reduce((m, s) => m + (s.weight ?? 0) * (s.reps ?? 0), 0) : 0),
    0,
  );

  const update = (fn: (w: Workout) => Workout) => setW((cur) => fn(cur));
  const updateExercise = (id: string, fn: (e: SessionExercise) => SessionExercise) =>
    update((cur) => ({ ...cur, exercises: cur.exercises.map((e) => (e.id === id ? fn(e) : e)) }));

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
  };

  async function save() {
    if (!sets.length || busy) return;
    setBusy(true);
    try {
      const exercises = w.exercises
        .map((e) => ({ ...e, sets: e.sets.filter(filled).map((s) => ({ ...s, completed: true })) }))
        .filter((e) => e.sets.length);
      const record: Workout = {
        ...w,
        title,
        mode: 'detailed',
        status: 'completed',
        body_parts: parts,
        exercises,
        time_precision: 'date',
        workout_date: date,
        start_at: zonedISO(`${date}T12:00`, prefs.timezone),
        end_at: null,
        duration_seconds: minutes ? minutes * 60 : null,
      };
      const saved = isNew ? await createWorkout(record) : await putWorkout(record);
      refreshFitness();
      haptic();
      toast(t('已保存', 'Saved'));
      onSaved(saved);
    } catch (error) {
      toast(errorMessage(error), 'error');
      setBusy(false);
    }
  }

  return (
    <div className="editor">
      <input
        className="title-input"
        value={title}
        maxLength={120}
        onChange={(e) => {
          autoTitle.current = false;
          update((cur) => ({ ...cur, title: e.target.value }));
        }}
        aria-label={t('名称', 'Name')}
      />
      <div className="editor-meta">
        {t(`${sets.length} 组`, `${sets.length} sets`)}
        {volume > 0 && <> · {fmtVolume(volume, prefs.weightUnit)}</>}
      </div>

      <DateDurationFields date={date} onDate={setDate} minutes={minutes} onMinutes={setMinutes} />

      <div className="form-label">{t('动作', 'Exercises')}</div>
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
          />
        ))}
      </AnimatePresence>
      <Press className="btn block add-ex-btn" onClick={() => setPicker(true)}>
        <Plus />
        {w.exercises.length
          ? t('再加一个动作', 'Add another exercise')
          : t('选择动作', 'Choose exercises')}
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

      <div className="editor-bar">
        <Press className="btn btn-fit lg block" disabled={!sets.length || busy} onClick={save}>
          {busy ? (
            <span className="spinner" />
          ) : sets.length ? (
            <>
              <Check strokeWidth={2.6} />
              {t('保存记录', 'Save')}
            </>
          ) : (
            t('填写至少一组', 'Fill in at least one set')
          )}
        </Press>
      </div>

      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        onPick={addExercises}
        hint={hint}
      />
    </div>
  );
}

const typeLabels: Record<Exclude<RecordingType, 'auto'>, [string, string]> = {
  weight: ['重量×次数', 'Weight × reps'],
  reps: ['仅次数', 'Reps'],
  duration: ['时长', 'Time'],
  cardio: ['距离+时长', 'Distance'],
};

function ExerciseCard({
  e,
  index,
  count,
  onChange,
  onRemove,
  onMove,
}: {
  e: SessionExercise;
  index: number;
  count: number;
  onChange: (fn: (e: SessionExercise) => SessionExercise) => void;
  onRemove: () => void;
  onMove: (d: number) => void;
}) {
  const { prefs } = useApp();
  const [menu, setMenu] = useState(false);
  const k = kind(e);
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
          <div className="ex-meta">{taxonomyLabel(e.target, locale())}</div>
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
            onDelete={() =>
              onChange((cur) => ({ ...cur, sets: cur.sets.filter((x) => x.id !== s.id) }))
            }
          />
        ))}
      </AnimatePresence>
      <button
        className="add-set"
        onClick={() => {
          haptic();
          onChange((cur) => ({ ...cur, sets: [...cur.sets, blank(cur.sets.at(-1))] }));
        }}
        disabled={e.sets.length >= 100}
      >
        <Plus />
        {t('加一组（沿用上一组）', 'Add set (copies last)')}
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
  onDelete,
}: {
  s: FitnessSet;
  n: number;
  k: ReturnType<typeof kind>;
  onField: (patch: Partial<FitnessSet>) => void;
  onDelete: () => void;
}) {
  const { prefs } = useApp();
  const distanceFactor = prefs.distanceUnit === 'mile' ? 1609.344 : 1000;
  return (
    <motion.div
      className={`set-grid row k-${k}`}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
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
      <button className="set-remove" onClick={onDelete} aria-label={t('删除这一组', 'Delete set')}>
        <X />
      </button>
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
