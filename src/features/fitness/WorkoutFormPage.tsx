import WorkoutEditor from './WorkoutEditor';
import type { Locale, Preferences, Workout } from '../../types/domain';
export default function WorkoutFormPage({
  locale,
  preferences,
  initial,
  fresh = false,
}: {
  locale: Locale;
  preferences: Preferences;
  initial: Workout;
  fresh?: boolean;
}) {
  return (
    <div className="task-form">
      <WorkoutEditor
        locale={locale}
        preferences={preferences}
        initial={initial}
        inline
        manual
        fresh={fresh}
        onClose={() => location.assign(fresh ? '/fitness' : `/fitness/${initial.id}`)}
        onSaved={(w) => location.assign(`/fitness/${w.id}`)}
      />
    </div>
  );
}
