import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronRight,
  Dumbbell,
  Flame,
  Play,
  Plus,
  Trophy,
  Zap,
  Layers,
  Trash2,
} from 'lucide-react';
import { Screen, Press, Ring, CountUp, Reveal, Empty, Skeleton, ConfirmSheet } from '../core/ui';
import { useApp } from '../core/app-state';
import { useRouter } from '../core/router';
import { useQuery } from '../core/query';
import { t, zh, errorMessage } from '../core/i18n';
import { fmtDate, fmtDuration, kgTo, round1, today } from '../core/format';
import { CheckinSheet } from './CheckinSheet';
import { MonthCalendar, SessionRow, WeekStrip, DaySessions } from './parts';
import {
  createWorkout,
  deleteTemplate,
  keys,
  newWorkout,
  startTemplate,
  type Analytics,
  type Page,
  type PeriodSummary,
  type Workout,
  type WorkoutTemplate,
} from './data';
import { LiveBanner } from './LiveBanner';

export function useStartWorkout() {
  const { prefs, toast } = useApp();
  const { navigate } = useRouter();
  const [busy, setBusy] = useState(false);
  const start = async (templateId?: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const w = templateId
        ? await startTemplate(templateId)
        : await createWorkout(newWorkout(prefs));
      navigate(`/fitness/${w.id}`);
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  };
  return { start, busy };
}

export function FitnessHero({ compact = false }: { compact?: boolean }) {
  const { prefs, owner } = useApp();
  const todayKey = today(prefs);
  const { data: week } = useQuery<PeriodSummary>(keys.week(todayKey));
  const { data: analytics } = useQuery<Analytics>(keys.analytics);
  const [checkin, setCheckin] = useState(false);
  const { start, busy } = useStartWorkout();
  const count = week?.count ?? 0,
    goal = week?.goal ?? prefs.weeklyGoal;
  const reached = count >= goal;
  return (
    <div className="card fit-hero">
      <div className="fit-hero-glow" />
      <div className="fit-hero-top">
        <Ring value={week ? count / goal : 0} size={compact ? 108 : 124} stroke={compact ? 13 : 15}>
          <div className="ring-center">
            <div className="ring-num num">
              <CountUp value={count} />
              <span>/{goal}</span>
            </div>
            <div className="ring-cap">{t('本周', 'this week')}</div>
          </div>
        </Ring>
        <div className="fit-hero-stats">
          <div className="hero-headline">
            {!week
              ? ' '
              : reached
                ? t('本周目标达成 🎉', 'Weekly goal reached 🎉')
                : t(`还差 ${goal - count} 次达成目标`, `${goal - count} to go this week`)}
          </div>
          <div className="mini-stats">
            <div>
              <Flame className="ic-fit" />
              <b className="num">
                <CountUp value={analytics?.summary.current ?? 0} />
              </b>
              <span>{t('天连续', 'day streak')}</span>
            </div>
            <div>
              <Trophy className="ic-gold" />
              <b className="num">
                <CountUp value={analytics?.summary.monthCount ?? 0} />
              </b>
              <span>{t('本月', 'this month')}</span>
            </div>
          </div>
          {!!analytics?.summary.weekSeconds && (
            <div className="faint small">
              {t('本周训练 ', 'Trained ')}
              {fmtDuration(analytics.summary.weekSeconds)}
            </div>
          )}
        </div>
      </div>
      <WeekStrip summary={week} />
      {owner && (
        <div className="fit-hero-actions">
          <Press className="btn btn-fit lg" onClick={() => setCheckin(true)}>
            <Zap strokeWidth={2.4} />
            {t('打卡', 'Check in')}
          </Press>
          <Press className="btn lg" onClick={() => start()} disabled={busy}>
            {busy ? <span className="spinner" /> : <Play strokeWidth={2.4} />}
            {t('开始训练', 'Start workout')}
          </Press>
        </div>
      )}
      <CheckinSheet open={checkin} onClose={() => setCheckin(false)} />
    </div>
  );
}

export function FitnessHome() {
  const { owner, prefs } = useApp();
  const { navigate } = useRouter();
  const { data: recent, loading } = useQuery<Page<Workout>>(keys.sessions(0));
  const { data: analytics } = useQuery<Analytics>(keys.analytics);
  const { data: templates } = useQuery<{ items: WorkoutTemplate[] }>(owner ? keys.templates : null);
  const [day, setDay] = useState<{
    date: string;
    sessions: PeriodSummary['days'][number]['sessions'];
  } | null>(null);
  const { start } = useStartWorkout();
  const [removing, setRemoving] = useState<WorkoutTemplate | null>(null);
  const records = analytics?.records.slice(0, 5) ?? [];

  return (
    <Screen title={t('健身', 'Fitness')} subtitle={t('每一次都算数', 'Every rep counts')}>
      <LiveBanner />
      <div className="grid-2">
        <Reveal>
          <FitnessHero />
        </Reveal>
        <Reveal delay={0.06}>
          <MonthCalendar
            selected={day?.date ?? null}
            onSelect={(date, d) =>
              setDay((cur) => (cur?.date === date ? null : { date, sessions: d?.sessions ?? [] }))
            }
          />
          <AnimatePresence>
            {day && <DaySessions key={day.date} date={day.date} sessions={day.sessions} />}
          </AnimatePresence>
        </Reveal>
      </div>

      {owner && !!templates?.items.length && (
        <section className="section">
          <div className="section-head">
            <h2>{t('训练模板', 'Templates')}</h2>
          </div>
          <div className="h-scroll">
            {templates.items.map((tpl, i) => (
              <motion.div
                key={tpl.id}
                className="tpl-card card"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
              >
                <div className="tpl-icon">
                  <Layers />
                </div>
                <div className="tpl-name ellipsis">{tpl.name}</div>
                <div className="faint small ellipsis">
                  {tpl.exercises
                    .slice(0, 3)
                    .map((e) => (zh() ? e.name_zh || e.name_en : e.name_en))
                    .join(' · ')}
                </div>
                <div className="hstack" style={{ marginTop: 12 }}>
                  <Press className="btn sm btn-primary" onClick={() => start(tpl.id)}>
                    <Play />
                    {t('开始', 'Start')}
                  </Press>
                  <Press
                    className="icon-btn sm"
                    onClick={() => setRemoving(tpl)}
                    aria-label={t('删除模板', 'Delete template')}
                  >
                    <Trash2 />
                  </Press>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <div className="grid-2 section">
        <section>
          <div className="section-head">
            <h2>{t('最近训练', 'Recent')}</h2>
            <Press className="link" onClick={() => navigate('/fitness/history')}>
              {t('全部', 'All')}
              <ChevronRight />
            </Press>
          </div>
          {loading ? (
            <Skeleton h={220} r={20} />
          ) : recent?.items.length ? (
            <div className="list">
              {recent.items.slice(0, 6).map((w, i) => (
                <SessionRow key={w.id} w={w} index={i} />
              ))}
            </div>
          ) : (
            <div className="card">
              <Empty
                icon={<Dumbbell />}
                title={t('还没有训练记录', 'No workouts yet')}
                text={
                  owner
                    ? t(
                        '点「打卡」，十秒记下今天的训练。',
                        'Tap “Check in” to log today in seconds.',
                      )
                    : undefined
                }
              />
            </div>
          )}
        </section>
        <section>
          <div className="section-head">
            <h2>{t('个人纪录', 'Personal records')}</h2>
          </div>
          {records.length ? (
            <div className="list">
              {records.map((r, i) => (
                <motion.div
                  key={r.exerciseId}
                  className="list-row"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <span className="pr-rank num">{i + 1}</span>
                  <span className="grow">
                    <span className="ellipsis" style={{ display: 'block', fontWeight: 600 }}>
                      {zh() ? r.name_zh || r.name_en : r.name_en}
                    </span>
                    <span className="faint small">
                      {fmtDate(r.date.slice(0, 10), {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </span>
                  <span className="pr-value num">
                    {round1(kgTo(r.weight, prefs.weightUnit))}
                    <small>{prefs.weightUnit}</small>
                  </span>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="card">
              <Empty
                icon={<Trophy />}
                title={t('纪录会出现在这里', 'Records show up here')}
                text={t('开始一次训练，记录重量和次数。', 'Start a workout and log weight × reps.')}
              />
            </div>
          )}
          {owner && (
            <Press className="btn block" style={{ marginTop: 14 }} onClick={() => start()}>
              <Plus />
              {t('新的力量训练', 'New strength workout')}
            </Press>
          )}
        </section>
      </div>
      <ConfirmSheet
        open={!!removing}
        title={t('删除这个模板？', 'Delete this template?')}
        text={removing?.name}
        confirm={t('删除', 'Delete')}
        danger
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (removing) await deleteTemplate(removing.id);
          setRemoving(null);
        }}
      />
    </Screen>
  );
}
