import { useState } from 'react';
import type { Locale, Workout } from '../../types/domain';
import { translator } from '../../lib/i18n';
import { zonedInput, zonedISO } from '../../lib/fitness-recording';
import { workoutDay } from '../../lib/analytics';
export default function WorkoutTiming({
  workout,
  locale,
  onApply,
}: {
  workout: Workout;
  locale: Locale;
  onApply: (patch: Partial<Workout>) => void;
}) {
  const t = translator(locale),
    [error, setError] = useState('');
  return (
    <details className="record-more">
      <summary>{t('simple.preciseTime')}</summary>
      <div className="form-row">
        {(['start_at', 'end_at'] as const).map((key) => (
          <label className="field" key={key}>
            <span>{t(key === 'start_at' ? 'common.start' : 'common.end')}</span>
            <input
              type="datetime-local"
              value={
                workout.time_precision === 'date' || !workout[key]
                  ? ''
                  : zonedInput(workout[key]!, workout.timezone)
              }
              onChange={(event) => {
                try {
                  if (!event.target.value) {
                    if (key === 'start_at')
                      onApply({
                        time_precision: 'date',
                        workout_date: workoutDay(workout, workout.timezone),
                        end_at: null,
                        duration_seconds: null,
                      });
                    else onApply({ end_at: null });
                    setError('');
                    return;
                  }
                  if (key === 'end_at' && workout.time_precision === 'date') {
                    setError(t('record.invalidTime'));
                    return;
                  }
                  const value = zonedISO(event.target.value, workout.timezone);
                  // An explicitly selected time is saved; never prefill a fictional time.
                  onApply({
                    [key]: value,
                    time_precision: 'exact',
                    workout_date: null,
                    duration_seconds: null,
                  });
                  setError('');
                } catch {
                  setError(t('record.invalidTime'));
                }
              }}
            />
          </label>
        ))}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </details>
  );
}
