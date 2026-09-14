import { useRef, useState, lazy, Suspense } from 'react';
import { MapPin, Check, Pencil } from 'lucide-react';
import type { Locale, Trip } from '../../types/domain';
import { translator } from '../../lib/i18n';
import { tripName } from '../../lib/travel-presentation';
import TravelEditor from './TravelEditor';
const TravelExtras = lazy(() => import('./TravelExtras'));
export default function TravelJournal({
  locale,
  initial = [],
  owner = false,
}: {
  locale: Locale;
  initial?: Trip[];
  owner?: boolean;
}) {
  const t = translator(locale),
    [serial, setSerial] = useState(0),
    [items, setItems] = useState(initial),
    [saved, setSaved] = useState(false),
    [editing, setEditing] = useState<Trip | undefined>();
  const [extras, setExtras] = useState<'map' | 'wishlist' | null>(null),
    dirty = useRef(false),
    composer = useRef<HTMLElement>(null);
  return (
    <>
      {owner && (
        <section className="inline-composer travel-inline" id="record" ref={composer}>
          <h2>
            <MapPin size={20} />
            {t(editing ? 'common.edit' : 'inline.trip')}
          </h2>
          {saved && (
            <p role="status" className="journal-success">
              <Check size={17} />
              {t('inline.saved')}
            </p>
          )}
          <TravelEditor
            key={serial}
            locale={locale}
            inline
            initial={editing}
            onDirtyChange={(value) => {
              dirty.current = value;
              if (value) setSaved(false);
            }}
            onClose={() => {}}
            onSaved={(trip) => {
              setItems((old) => [trip, ...old.filter((x) => x.id !== trip.id)]);
              setSaved(true);
              setEditing(undefined);
              setSerial((n) => n + 1);
            }}
          />
        </section>
      )}
      <section className="travel-grid journal-section">
        {items.map((trip) => (
          <article className="travel-card" key={trip.id}>
            <a href={`/travel/${trip.id}`}>
              <div className="travel-cover">
                <img
                  src={`/api/media/${trip.photos[0]?.id}/thumbnail`}
                  width={480}
                  height={360}
                  alt={tripName(trip, locale)}
                  loading="lazy"
                />
              </div>
              <h3>{tripName(trip, locale)}</h3>
            </a>
            {trip.start_date && <p className="muted">{trip.start_date}</p>}
            {trip.description && <p>{trip.description}</p>}
            {owner && (
              <button
                className="button button-ghost"
                onClick={() => {
                  if (dirty.current && !confirm(t('common.unsaved'))) return;
                  setEditing(trip);
                  setSaved(false);
                  setSerial((n) => n + 1);
                  composer.current?.scrollIntoView({ block: 'start' });
                }}
              >
                <Pencil size={15} />
                {t('common.edit')}
              </button>
            )}
          </article>
        ))}
      </section>
      {!items.length && <p className="muted">{t('travel.noTrips')}</p>}
      <div className="journal-tools">
        {(['map', 'wishlist'] as const).map((kind) => (
          <button
            className="button button-ghost"
            key={kind}
            aria-expanded={extras === kind}
            onClick={() => setExtras((value) => (value === kind ? null : kind))}
          >
            {t(kind === 'map' ? 'inline.map' : 'travel.wishlist')}
          </button>
        ))}
        <a href="/travel?view=discover">{t('travel.discover')}</a>
      </div>
      {extras && (
        <Suspense fallback={<p role="status">{t('common.loading')}</p>}>
          <TravelExtras key={extras} locale={locale} owner={owner} kind={extras} />
        </Suspense>
      )}
    </>
  );
}
