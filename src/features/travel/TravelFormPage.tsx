import TravelEditor from './TravelEditor';
import type { Locale, Trip } from '../../types/domain';
export default function TravelFormPage({ locale, initial }: { locale: Locale; initial?: Trip }) {
  return (
    <div className="task-form">
      <TravelEditor
        locale={locale}
        initial={initial}
        inline
        pageMode
        onClose={() => location.assign(initial ? `/travel/${initial.id}` : '/travel')}
        onSaved={(trip) => location.assign(`/travel/${trip.id}`)}
      />
    </div>
  );
}
